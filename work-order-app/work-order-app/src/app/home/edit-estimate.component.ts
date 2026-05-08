import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth.service';
import { AbstractStateService } from '../work-order/abstract-state.service';
import { WorkItemService, WorkItemSuggestion } from '../work-order/work-item.service';

// Designation → stage flow
const STAGE_FLOW: any = {
  'Manager': 'Manager',
  'DGM':     'DGM',
  'GM':      'GM',
  'CGM':     'CGM',
  'Director':'Director'
};

const NEXT_STAGE: any = {
  'Manager': 'DGM',
  'DGM':     'GM',
  'GM':      'CGM',
  'CGM':     'Director',
  'Director': null
};

@Component({
  selector: 'app-edit-estimate',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './edit-estimate.component.html',
  styleUrls: ['./edit-estimate.component.css']
})
export class EditEstimateComponent implements OnInit {

  private apiBase = 'http://localhost:3000/api';

  // Step 1
  workIdInput:  string  = '';
  isChecking:   boolean = false;
  checkError:   string  = '';
  workChecked:  boolean = false;
  workFound:    boolean = false;
  canEditWork:  boolean = false;
  workStage:    string  = '';
  workStatus:   string  = '';
  existingWorkId: string = '';

  // Work fields
  nameOfWork:       string = '';
  selectedDivision: string = '';
  selectedCircle:   string = '';
  selectedWard:     string = '';

  divisions: string[] = ['Division 1', 'Division 2', 'Division 3', 'Division 4'];
  circles:   string[] = ['Circle A', 'Circle B', 'Circle C', 'Circle D'];
  wards:     string[] = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];

  gstOptions: number[] = [0, 5, 18];
  selectedGstRate: number = 0;

  savedItems:  any[] = [];
  currentItem: any   = this.createEmptyItem(1);
  totals = { totalAmount: 0, gst: 0, grandTotal: 0 };

  // Autocomplete
  suggestions:  any[]   = [];
  showDropdown: boolean  = false;
  isLoadingSuggestions: boolean = false;
  private searchTimer: any = null;

  // Works list for this stage
  worksList:      any[]    = [];
  isLoadingList:  boolean  = false;
  listError:      string   = '';

  // Submit
  showSubmitDialog: boolean = false;
  submitRemarks:    string  = '';
  isSubmitting:     boolean = false;
  submitSuccess:    string  = '';
  submitError:      string  = '';
  submitDateTime:   string  = '';

  constructor(
    private auth:            AuthService,
    private http:            HttpClient,
    private router:          Router,
    private stateService:    AbstractStateService,
    private workItemService: WorkItemService
  ) {}

  get user()            { return this.auth.getSession(); }
  get userName()        { return this.user?.name        || ''; }
  get userDesignation() { return this.user?.designation || ''; }
  get myStage()         { return STAGE_FLOW[this.userDesignation] || ''; }
  get nextStage()       { return NEXT_STAGE[this.myStage] || ''; }

  ngOnInit(): void { this.loadWorksList(); }

  loadWorksList(): void {
    this.isLoadingList = true;
    this.listError     = '';
    const stage = this.myStage;
    const url   = `${this.apiBase}/works?stage=${encodeURIComponent(stage)}`;
    this.http.get<any[]>(url).subscribe({
      next: (works) => {
        this.worksList     = works;
        this.isLoadingList = false;
      },
      error: () => {
        this.listError     = 'Could not load works list.';
        this.isLoadingList = false;
      }
    });
  }

  selectWork(work: any): void {
    this.workIdInput = work.work_id;
    this.onCheckWorkId();
    // Scroll to form
    setTimeout(() => {
      const el = document.querySelector('.edit-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  }

  onCheckWorkId(): void {
    if (!this.workIdInput.trim()) { this.checkError = 'Please enter a Work ID.'; return; }

    this.isChecking  = true;
    this.checkError  = '';
    this.workChecked = false;
    this.workFound   = false;
    this.savedItems  = [];

    this.http.get<any>(`${this.apiBase}/works/check?workId=${encodeURIComponent(this.workIdInput.trim())}&designation=${encodeURIComponent(this.userDesignation)}`).subscribe({
      next: (res) => {
        this.isChecking  = false;
        this.workChecked = true;

        if (res && res.exists) {
          this.workFound      = true;
          this.existingWorkId = res.work_id;
          this.nameOfWork     = res.name_of_work;
          this.selectedDivision = res.division || '';
          this.selectedCircle   = res.circle   || '';
          this.selectedWard     = res.ward      || '';
          this.workStage        = res.current_stage || '';
          this.workStatus       = res.status        || '';

          // Can edit only if access === edit (work is at MY stage)
          this.canEditWork = res.access === 'edit';

          // Load items
          this.http.get<any[]>(`${this.apiBase}/works/${res.work_id}/items`).subscribe({
            next: (items) => {
              this.savedItems = items.map((i: any, idx: number) => ({
                sNo:         idx + 1,
                description: i.description,
                numbers:     i.numbers,
                length:      i.length,
                breadth:     i.breadth,
                depth:       i.depth,
                quantity:    i.quantity,
                unit:        i.unit,
                rate:        i.rate,
                amount:      Number(i.amount) || 0,
                isMaterial:  i.is_material ? 'Yes' : 'No',
                item_id:     i.item_id
              }));
              this.currentItem = this.createEmptyItem(this.savedItems.length + 1);
              this.refreshTotals();
            }
          });
        } else {
          this.workFound   = false;
          this.checkError  = 'Work ID not found. Use Prepare Estimate to create a new work.';
        }
      },
      error: () => {
        this.isChecking  = false;
        this.workChecked = true;
        this.workFound   = false;
        this.checkError  = 'Work ID not found.';
      }
    });
  }

  // ── Autocomplete ──────────────────────────────────────────────
  onDescriptionInput(): void {
    const val = (this.currentItem.description || '').trim();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (val.length < 2) { this.suggestions = []; this.showDropdown = false; return; }
    this.searchTimer = setTimeout(() => {
      this.isLoadingSuggestions = true;
      this.workItemService.searchItems(val).subscribe({
        next: (results) => { this.suggestions = results; this.showDropdown = results.length > 0; this.isLoadingSuggestions = false; },
        error: () => { this.suggestions = []; this.showDropdown = false; this.isLoadingSuggestions = false; }
      });
    }, 300);
  }

  onSelectSuggestion(item: WorkItemSuggestion): void {
    this.currentItem.description = item.description;
    this.currentItem.rate        = Number(item.rate);
    this.currentItem.unit        = item.unit;
    this.currentItem.amount      = parseFloat((this.currentItem.quantity * this.currentItem.rate).toFixed(2));
    this.suggestions = []; this.showDropdown = false;
  }

  closeDropdown(): void { setTimeout(() => { this.showDropdown = false; }, 250); }

  // ── Calculations ──────────────────────────────────────────────
  onDimensionChange(): void {
    const item = this.currentItem;
    const filledDims = [item.length, item.breadth, item.depth].filter((v: number) => v > 0);
    let dimProduct = filledDims.length === 0 ? 1 : filledDims.length === 1 ? filledDims[0] : filledDims.length === 2 ? filledDims[0] * filledDims[1] : filledDims[0] * filledDims[1] * filledDims[2];
    item.quantity = parseFloat(((item.numbers > 0 ? item.numbers : 1) * dimProduct).toFixed(4));
    item.amount   = parseFloat((item.quantity * item.rate).toFixed(2));
  }
  onRateChange():     void { this.currentItem.amount = parseFloat((this.currentItem.quantity * this.currentItem.rate).toFixed(2)); }
  onQuantityChange(): void { this.currentItem.amount = parseFloat((this.currentItem.quantity * this.currentItem.rate).toFixed(2)); }

  onAdd(): void { this.savedItems.push({ ...this.currentItem }); this.currentItem = this.createEmptyItem(this.savedItems.length + 1); this.refreshTotals(); }
  onCancel(): void { this.currentItem = this.createEmptyItem(this.savedItems.length + 1); }
  onDelete(i: number): void { this.savedItems.splice(i, 1); this.savedItems.forEach((item, idx) => item.sNo = idx + 1); this.currentItem.sNo = this.savedItems.length + 1; this.refreshTotals(); }
  onEdit(i: number): void { this.currentItem = { ...this.savedItems[i] }; this.savedItems.splice(i, 1); this.savedItems.forEach((item, idx) => item.sNo = idx + 1); this.currentItem.sNo = this.savedItems.length + 1; this.refreshTotals(); }

  onGstRateChange():    void { this.totals.gst = parseFloat((this.totals.totalAmount * this.selectedGstRate / 100).toFixed(2)); this.totals.grandTotal = parseFloat((this.totals.totalAmount + this.totals.gst).toFixed(2)); }
  onTotalAmountChange():void { this.onGstRateChange(); }
  refreshTotals(): void { this.totals.totalAmount = parseFloat(this.savedItems.reduce((s, i) => s + i.amount, 0).toFixed(2)); this.onGstRateChange(); }
  getRowTotal(): number { return this.savedItems.reduce((s, i) => s + i.amount, 0); }

  // ── Submit ────────────────────────────────────────────────────
  openSubmitDialog(): void { this.submitRemarks = ''; this.submitSuccess = ''; this.submitError = ''; this.showSubmitDialog = true; }
  closeSubmitDialog(): void { this.showSubmitDialog = false; }

  onSubmit(): void {
    this.isSubmitting = true;
    this.submitError  = '';

    // First save updated items
    this.http.put(`${this.apiBase}/works/${this.existingWorkId}/items`, {
      items:    this.savedItems,
      editedBy: this.userName
    }).subscribe({
      next: () => {
        // Then submit to next stage
        this.http.post<any>(`${this.apiBase}/works/${this.existingWorkId}/submit`, {
          submittedBy:  this.userName,
          designation:  this.userDesignation,
          remarks:      this.submitRemarks
        }).subscribe({
          next: (res) => {
            this.isSubmitting  = false;
            this.submitSuccess = `Submitted to ${res.toStage} successfully!`;
            this.canEditWork   = false;
            setTimeout(() => { this.closeSubmitDialog(); }, 1500);
          },
          error: (err) => { this.isSubmitting = false; this.submitError = err?.error?.detail || 'Submit failed.'; }
        });
      },
      error: (err) => { this.isSubmitting = false; this.submitError = 'Failed to save changes.'; }
    });
  }

  onGenerateSheet(): void {
    this.stateService.setState({ nameOfWork: this.nameOfWork, division: this.selectedDivision, circle: this.selectedCircle, ward: this.selectedWard, savedItems: this.savedItems, gstRate: this.selectedGstRate, gstAmount: this.totals.gst, grandTotal: this.totals.grandTotal, viewOnly: false, canEdit: true });
    this.router.navigate(['/abstract']);
  }

  goBack(): void { this.router.navigate(['/home']); }
  onLogout(): void { this.auth.logout(); this.router.navigate(['/login']); }
  createEmptyItem(sNo: number): any { return { sNo, description: '', numbers: 1, length: 0, breadth: 0, depth: 0, quantity: 1, rate: 0, unit: '', amount: 0, isMaterial: 'No' }; }
  trackByIndex(index: number, item: any): number { return item.sNo; }
}