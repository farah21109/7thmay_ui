import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth.service';
import { AbstractStateService } from '../work-order/abstract-state.service';
import { WorkItemService, WorkItemSuggestion } from '../work-order/work-item.service';

@Component({
  selector: 'app-prepare-estimate',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './prepare-estimate.component.html',
  styleUrls: ['./prepare-estimate.component.css']
})
export class PrepareEstimateComponent implements OnInit {

  private apiBase = 'http://localhost:3000/api';

  // ── Step 1: Work ID check ─────────────────────────────────────
  workIdInput: string  = '';
  isChecking:  boolean = false;
  checkError:  string  = '';
  workChecked: boolean = false;

  // Result from check
  workExists:    boolean = false;
  accessLevel:   string  = '';   // 'view' | 'edit' | 'none'
  existingWorkId: string = '';
  currentStage:   string = '';
  nextStage:      string = '';

  // ── Form fields ───────────────────────────────────────────────
  nameOfWork:       string = '';
  selectedDivision: string = '';
  selectedCircle:   string = '';
  selectedWard:     string = '';

  divisions: string[] = ['Division 1', 'Division 2', 'Division 3', 'Division 4'];
  circles:   string[] = ['Circle A', 'Circle B', 'Circle C', 'Circle D'];
  wards:     string[] = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];

  gstOptions:      number[] = [0, 5, 18];
  selectedGstRate: number   = 0;

  savedItems:  any[] = [];
  currentItem: any   = this.createEmptyItem(1);
  totals = { totalAmount: 0, gst: 0, grandTotal: 0 };

  // ── Autocomplete ──────────────────────────────────────────────
  suggestions:  any[]   = [];
  showDropdown: boolean  = false;
  isLoadingSuggestions: boolean = false;
  private searchTimer: any = null;

  // ── Submission info (from DB) ────────────────────────────────
  lastSubmittedAt: string = '';
  lastSubmittedBy: string = '';
  lastFromStage:   string = '';
  lastToStage:     string = '';

  // ── Submit dialog ─────────────────────────────────────────────
  showSubmitDialog: boolean = false;
  submitRemarks:    string  = '';
  isSubmitting:     boolean = false;
  submitSuccess:    string  = '';
  submitError:      string  = '';
  submitDateTime:   string  = '';  // shown after submit

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
  get userWard()        { return this.user?.ward        || ''; }

  // Is this a new work (not found in DB)?
  get isNewWork():  boolean { return this.workChecked && !this.workExists; }
  // Existing work, view only
  get isViewOnly(): boolean { return this.workExists && this.accessLevel === 'view'; }
  // Existing work, editable at this stage
  get isEditable(): boolean { return this.workExists && this.accessLevel === 'edit'; }

  ngOnInit(): void {}

  // ── Check Work ID ─────────────────────────────────────────────
  onCheckWorkId(): void {
    if (!this.workIdInput.trim()) {
      this.checkError = 'Please enter a Work ID or Name.';
      return;
    }
    this.isChecking  = true;
    this.checkError  = '';
    this.workChecked = false;
    this.workExists  = false;
    this.savedItems  = [];

    this.http.get<any>(
      `${this.apiBase}/works/check?workId=${encodeURIComponent(this.workIdInput.trim())}&designation=${encodeURIComponent(this.userDesignation)}`
    ).subscribe({
      next: (res) => {
        this.isChecking  = false;
        this.workChecked = true;

        if (res.exists) {
          this.workExists     = true;
          this.accessLevel    = res.access;
          this.existingWorkId = res.work_id;
          this.currentStage   = res.current_stage;
          this.nextStage      = res.next_stage || '';
          this.nameOfWork     = res.name_of_work;
          this.selectedDivision = res.division || '';
          this.selectedCircle   = res.circle   || '';
          this.selectedWard     = res.ward      || '';
          // Store last submission info
          if (res.last_submitted_at) {
            const d = new Date(res.last_submitted_at);
            this.lastSubmittedAt = d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            this.lastSubmittedBy = res.last_submitted_by || '';
            this.lastFromStage   = res.last_from_stage   || '';
            this.lastToStage     = res.last_to_stage     || '';
          }

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
                amount:      i.amount,
                isMaterial:  i.is_material ? 'Yes' : 'No',
                item_id:     i.item_id
              }));
              this.currentItem = this.createEmptyItem(this.savedItems.length + 1);
              this.refreshTotals();
            }
          });
        } else {
          // New work
          this.workExists  = false;
          this.accessLevel = 'edit';
          this.nameOfWork  = this.workIdInput.trim();
        }
      },
      error: () => {
        this.isChecking  = false;
        this.workChecked = true;
        this.workExists  = false;
        this.accessLevel = 'edit';
        this.nameOfWork  = this.workIdInput.trim();
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

  // ── Row calculations ──────────────────────────────────────────
  onDimensionChange(): void {
    const item = this.currentItem;
    const filledDims = [item.length, item.breadth, item.depth].filter((v: number) => v > 0);
    let dp = filledDims.length === 0 ? 1 : filledDims.length === 1 ? filledDims[0] : filledDims.length === 2 ? filledDims[0] * filledDims[1] : filledDims[0] * filledDims[1] * filledDims[2];
    item.quantity = parseFloat(((item.numbers > 0 ? item.numbers : 1) * dp).toFixed(4));
    item.amount   = parseFloat((item.quantity * item.rate).toFixed(2));
  }
  onRateChange():     void { this.currentItem.amount = parseFloat((this.currentItem.quantity * this.currentItem.rate).toFixed(2)); }
  onQuantityChange(): void { this.currentItem.amount = parseFloat((this.currentItem.quantity * this.currentItem.rate).toFixed(2)); }

  onAdd(): void    { this.savedItems.push({ ...this.currentItem }); this.currentItem = this.createEmptyItem(this.savedItems.length + 1); this.refreshTotals(); }
  onCancel(): void { this.currentItem = this.createEmptyItem(this.savedItems.length + 1); }
  onDelete(i: number): void { this.savedItems.splice(i, 1); this.savedItems.forEach((item, idx) => item.sNo = idx + 1); this.currentItem.sNo = this.savedItems.length + 1; this.refreshTotals(); }
  onEdit(i: number): void   { this.currentItem = { ...this.savedItems[i] }; this.savedItems.splice(i, 1); this.savedItems.forEach((item, idx) => item.sNo = idx + 1); this.currentItem.sNo = this.savedItems.length + 1; this.refreshTotals(); }

  onGstRateChange():     void { this.totals.gst = parseFloat((this.totals.totalAmount * this.selectedGstRate / 100).toFixed(2)); this.totals.grandTotal = parseFloat((this.totals.totalAmount + this.totals.gst).toFixed(2)); }
  onTotalAmountChange(): void { this.onGstRateChange(); }
  refreshTotals(): void { this.totals.totalAmount = parseFloat(this.savedItems.reduce((s, i) => s + i.amount, 0).toFixed(2)); this.onGstRateChange(); }
  getRowTotal(): number { return this.savedItems.reduce((s, i) => s + i.amount, 0); }

  // ── Submit dialog ─────────────────────────────────────────────
  openSubmitDialog(): void { this.submitRemarks = ''; this.submitSuccess = ''; this.submitError = ''; this.showSubmitDialog = true; }
  closeSubmitDialog(): void { this.showSubmitDialog = false; }

  onSubmit(): void {
    this.isSubmitting = true;
    this.submitError  = '';

    this.http.post<any>(`${this.apiBase}/works/${this.existingWorkId}/submit`, {
      submittedBy:  this.userName,
      designation:  this.userDesignation,
      remarks:      this.submitRemarks
    }).subscribe({
      next: (res) => {
        this.isSubmitting  = false;
        this.submitSuccess = `Submitted to ${res.toStage} successfully!`;
        this.accessLevel   = 'view'; // now view-only for this user
        // Record submit date/time
        const now = new Date();
        this.submitDateTime   = now.toLocaleDateString('en-IN') + ' at ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        this.lastSubmittedAt  = this.submitDateTime;
        this.lastSubmittedBy  = this.userName;
        this.lastFromStage    = this.userDesignation;
        this.lastToStage      = res.toStage;
        setTimeout(() => this.closeSubmitDialog(), 2000);
      },
      error: (err) => { this.isSubmitting = false; this.submitError = err?.error?.detail || 'Submit failed.'; }
    });
  }

  // ── Generate Sheet ────────────────────────────────────────────
  onGenerateSheet(): void {
    if (this.savedItems.length === 0) { alert('Please add at least one item.'); return; }
    this.stateService.setState({
      nameOfWork:  this.nameOfWork,
      division:    this.selectedDivision,
      circle:      this.selectedCircle,
      ward:        this.selectedWard,
      savedItems:  this.savedItems,
      gstRate:     this.selectedGstRate,
      gstAmount:   this.totals.gst,
      grandTotal:  this.totals.grandTotal,
      workId:      this.existingWorkId,
      viewOnly:    false,
      canEdit:     true
    });
    this.router.navigate(['/abstract']);
  }

  goBack(): void { this.router.navigate(['/home']); }

  createEmptyItem(sNo: number): any {
    return { sNo, description: '', numbers: 1, length: 0, breadth: 0, depth: 0, quantity: 1, rate: 0, unit: '', amount: 0, isMaterial: 'No' };
  }
  trackByIndex(index: number, item: any): number { return item.sNo; }
}