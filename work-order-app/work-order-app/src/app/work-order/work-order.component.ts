import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { WorkOrderItem, WorkOrderTotals } from './work-order.model';
import { WorkItemService, WorkItemSuggestion } from './work-item.service';
import { AbstractStateService } from './abstract-state.service';
import { AuthService } from '../login/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-work-order',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './work-order.component.html',
  styleUrls: ['./work-order.component.css']
})
export class WorkOrderComponent {
  nameOfWork: string = '';

  divisions: string[] = ['Division 1', 'Division 2', 'Division 3', 'Division 4'];
  circles:   string[] = ['Circle A', 'Circle B', 'Circle C', 'Circle D'];
  wards:     string[] = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];

  selectedDivision: string = '';
  selectedCircle:   string = '';
  selectedWard:     string = '';

  gstOptions: number[] = [0, 5, 18];
  selectedGstRate: number = 0;

  currentItem: WorkOrderItem = this.createEmptyItem(1);
  savedItems:  WorkOrderItem[] = [];

  totals: WorkOrderTotals = { totalAmount: 0, gst: 0, grandTotal: 0 };

  // ── Sheet state ──────────────────────────────────────────────────
  showSheet: boolean = false;
  activeTab: string = 'material';

  get materialItems(): WorkOrderItem[] {
    return this.savedItems.filter(i => i.isMaterial === 'Yes');
  }

  get nonMaterialItems(): WorkOrderItem[] {
    return this.savedItems.filter(i => i.isMaterial === 'No');
  }

  get materialTotal(): number {
    return parseFloat(this.materialItems.reduce((s, i) => s + i.amount, 0).toFixed(2));
  }

  get nonMaterialTotal(): number {
    return parseFloat(this.nonMaterialItems.reduce((s, i) => s + i.amount, 0).toFixed(2));
  }

  get abstractGrandTotal(): number {
    return parseFloat((this.materialTotal + this.nonMaterialTotal + this.totals.gst + 0).toFixed(2));
  }

  openSheet(): void {
    if (this.savedItems.length === 0) {
      alert('Please add at least one item before generating the sheet.');
      return;
    }
    this.stateService.setState({
      nameOfWork:  this.nameOfWork,
      division:    this.selectedDivision,
      circle:      this.selectedCircle,
      ward:        this.selectedWard,
      savedItems:  this.savedItems,
      gstRate:     this.selectedGstRate,
      gstAmount:   this.totals.gst,
      grandTotal:  this.totals.grandTotal
    });
    this.router.navigate(['/abstract']);
  }

  closeSheet(): void {
    this.showSheet = false;
  }

  // ── Autocomplete state ───────────────────────────────────────────
  suggestions: WorkItemSuggestion[] = [];
  showDropdown: boolean = false;
  isLoadingSuggestions: boolean = false;
  private searchTimer: any = null;

  constructor(private workItemService: WorkItemService, private stateService: AbstractStateService, private auth: AuthService, private router: Router) {}

  get loggedInUser(): string {
    const u = this.auth.getSession();
    return u ? u.name : '';
  }

  get userDesignation(): string {
    const u = this.auth.getSession();
    return u ? u.designation : '';
  }

  get userWard(): string {
    const u = this.auth.getSession();
    return u ? (u.ward || '—') : '';
  }

  get userDepartment(): string {
    const u = this.auth.getSession();
    return u ? u.department : '';
  }

  // Only Manager (Ward level) can add/edit items
  get canEdit(): boolean {
    return this.userDepartment === 'Ward';
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ── Autocomplete ─────────────────────────────────────────────────

  onDescriptionInput(): void {
    const val = (this.currentItem.description || '').trim();

    // Clear previous timer
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    if (val.length < 2) {
      this.suggestions = [];
      this.showDropdown = false;
      return;
    }

    // Wait 300ms after user stops typing, then call API
    this.searchTimer = setTimeout(() => {
      this.isLoadingSuggestions = true;
      this.workItemService.searchItems(val).subscribe({
        next: (results) => {
          console.log('Search results:', results); // debug log
          this.suggestions = results;
          this.showDropdown = results.length > 0;
          this.isLoadingSuggestions = false;
        },
        error: (err) => {
          console.error('Search error:', err);
          this.suggestions = [];
          this.showDropdown = false;
          this.isLoadingSuggestions = false;
        }
      });
    }, 300);
  }

  onSelectSuggestion(item: WorkItemSuggestion): void {
    this.currentItem.description = item.description;
    this.currentItem.rate        = Number(item.rate);
    this.currentItem.unit        = item.unit;
    this.currentItem.amount      = parseFloat(
      (this.currentItem.quantity * this.currentItem.rate).toFixed(2)
    );
    this.suggestions  = [];
    this.showDropdown = false;
  }

  closeDropdown(): void {
    setTimeout(() => {
      this.showDropdown = false;
    }, 250);
  }

  // ── Row calculations ─────────────────────────────────────────────

  onDimensionChange(): void {
    const item = this.currentItem;

    // Only include dimensions that are actually filled (non-zero)
    const filledDims = [item.length, item.breadth, item.depth].filter(v => v > 0);

    let dimProduct: number;
    if (filledDims.length === 0) {
      // None filled → no dimension factor
      dimProduct = 1;
    } else if (filledDims.length === 1) {
      // One filled → use it directly
      dimProduct = filledDims[0];
    } else if (filledDims.length === 2) {
      // Two filled → multiply the two
      dimProduct = filledDims[0] * filledDims[1];
    } else {
      // All three filled → multiply all
      dimProduct = filledDims[0] * filledDims[1] * filledDims[2];
    }

    const numbers = item.numbers > 0 ? item.numbers : 1;
    item.quantity = parseFloat((numbers * dimProduct).toFixed(4));
    item.amount   = parseFloat((item.quantity * item.rate).toFixed(2));
  }

  onRateChange(): void {
    this.currentItem.amount = parseFloat(
      (this.currentItem.quantity * this.currentItem.rate).toFixed(2)
    );
  }

  onQuantityChange(): void {
    this.currentItem.amount = parseFloat(
      (this.currentItem.quantity * this.currentItem.rate).toFixed(2)
    );
  }

  // ── Totals ───────────────────────────────────────────────────────

  onGstRateChange(): void {
    this.totals.gst = parseFloat(
      (this.totals.totalAmount * this.selectedGstRate / 100).toFixed(2)
    );
    this.totals.grandTotal = parseFloat(
      (this.totals.totalAmount + this.totals.gst).toFixed(2)
    );
  }

  onTotalAmountChange(): void {
    this.totals.gst = parseFloat(
      (this.totals.totalAmount * this.selectedGstRate / 100).toFixed(2)
    );
    this.totals.grandTotal = parseFloat(
      (this.totals.totalAmount + this.totals.gst).toFixed(2)
    );
  }

  refreshTotals(): void {
    this.totals.totalAmount = parseFloat(
      this.savedItems.reduce((s, i) => s + i.amount, 0).toFixed(2)
    );
    this.totals.gst = parseFloat(
      (this.totals.totalAmount * this.selectedGstRate / 100).toFixed(2)
    );
    this.totals.grandTotal = parseFloat(
      (this.totals.totalAmount + this.totals.gst).toFixed(2)
    );
  }

  // ── Row actions ──────────────────────────────────────────────────

  onAdd(): void {
    this.savedItems.push({ ...this.currentItem });
    this.currentItem = this.createEmptyItem(this.savedItems.length + 1);
    this.refreshTotals();
  }

  onCancel(): void {
    this.currentItem = this.createEmptyItem(this.savedItems.length + 1);
    this.suggestions  = [];
    this.showDropdown = false;
  }

  onDelete(index: number): void {
    this.savedItems.splice(index, 1);
    this.savedItems.forEach((item, i) => item.sNo = i + 1);
    this.currentItem.sNo = this.savedItems.length + 1;
    this.refreshTotals();
  }

  onEdit(index: number): void {
    this.currentItem = { ...this.savedItems[index] };
    this.savedItems.splice(index, 1);
    this.savedItems.forEach((item, i) => item.sNo = i + 1);
    this.currentItem.sNo = this.savedItems.length + 1;
    this.refreshTotals();
  }

  createEmptyItem(sNo: number): WorkOrderItem {
    return {
      sNo, description: '', numbers: 1,
      length: 0, breadth: 0, depth: 0,
      quantity: 1, rate: 0, unit: '', amount: 0,
      isMaterial: 'No'
    };
  }

  getRowTotal(): number {
    return this.savedItems.reduce((s, i) => s + i.amount, 0);
  }

  trackByIndex(index: number, item: WorkOrderItem): number {
    return item.sNo;
  }
}
