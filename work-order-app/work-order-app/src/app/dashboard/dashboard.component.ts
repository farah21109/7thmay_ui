import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth.service';
import { AbstractStateService } from '../work-order/abstract-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styles: []
})
export class DashboardComponent implements OnInit {

  private apiBase = 'http://localhost:3000/api';

  works:       any[] = [];
  isLoading:   boolean = false;
  errorMsg:    string  = '';

  // For submit dialog
  showSubmitDialog: boolean = false;
  selectedWork:     any     = null;
  submitRemarks:    string  = '';
  isSubmitting:     boolean = false;
  submitSuccess:    string  = '';
  submitError:      string  = '';

  constructor(
    private auth:         AuthService,
    private http:         HttpClient,
    private router:       Router,
    private stateService: AbstractStateService
  ) {}

  get user() { return this.auth.getSession(); }
  get userName()        { return this.user?.name        || ''; }
  get userDesignation() { return this.user?.designation || ''; }
  get userWard()        { return this.user?.ward        || '—'; }
  get userDepartment()  { return this.user?.department  || ''; }

  // Stage map
  get myStage(): string {
    return this.userDesignation; // Manager, DGM, GM, CGM, Director
  }

  get nextStageLabel(): string {
    const map: any = {
      'Manager': 'DGM', 'DGM': 'GM', 'GM': 'CGM', 'CGM': 'Director', 'Director': null
    };
    return map[this.myStage] || '';
  }

  get isDirector(): boolean { return this.myStage === 'Director'; }

  ngOnInit(): void {
    this.loadWorks();
  }

  loadWorks(): void {
    this.isLoading = true;
    const params: any = { stage: this.myStage };
    if (this.myStage === 'Manager' && this.user?.ward) {
      params['ward'] = this.user.ward;
    }

    const queryStr = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
    this.http.get<any[]>(`${this.apiBase}/works?${queryStr}`).subscribe({
      next: (data) => { this.works = data; this.isLoading = false; },
      error: (err) => { this.errorMsg = 'Failed to load works.'; this.isLoading = false; }
    });
  }

  viewWork(work: any): void {
    // Load the work items and navigate to work-order in view mode
    this.http.get<any[]>(`${this.apiBase}/works/${work.work_id}/items`).subscribe({
      next: (items) => {
        this.http.get<any>(`${this.apiBase}/works/${work.work_id}/abstract`).subscribe({
          next: (abstract) => {
            this.stateService.setState({
              nameOfWork:  work.name_of_work,
              division:    work.division,
              circle:      work.circle,
              ward:        work.ward,
              savedItems:  items.map(i => ({
                sNo:         i.sl_no,
                description: i.description,
                numbers:     i.numbers,
                length:      i.length,
                breadth:     i.breadth,
                depth:       i.depth,
                quantity:    i.quantity,
                unit:        i.unit,
                rate:        i.rate,
                amount:      i.amount,
                isMaterial:  i.is_material ? 'Yes' : 'No'
              })),
              gstRate:    abstract.gst_rate,
              gstAmount:  abstract.gst_amount,
              grandTotal: abstract.grand_total,
              workId:     work.work_id,
              viewOnly:   true,
              canEdit:    this.myStage !== 'Manager' // non-managers can edit
            });
            this.router.navigate(['/abstract']);
          },
          error: () => {
            // No abstract yet, still navigate with items
            this.stateService.setState({
              nameOfWork: work.name_of_work,
              division:   work.division,
              circle:     work.circle,
              ward:       work.ward,
              savedItems: items,
              gstRate: 0, gstAmount: 0, grandTotal: 0,
              workId:  work.work_id,
              viewOnly: true,
              canEdit:  this.myStage !== 'Manager'
            });
            this.router.navigate(['/abstract']);
          }
        });
      },
      error: () => { this.errorMsg = 'Failed to load work details.'; }
    });
  }

  openSubmitDialog(work: any): void {
    this.selectedWork   = work;
    this.submitRemarks  = '';
    this.submitSuccess  = '';
    this.submitError    = '';
    this.showSubmitDialog = true;
  }

  closeSubmitDialog(): void {
    this.showSubmitDialog = false;
    this.selectedWork     = null;
  }

  onSubmit(): void {
    if (!this.selectedWork) return;
    this.isSubmitting = true;
    this.submitError  = '';

    this.http.post<any>(`${this.apiBase}/works/${this.selectedWork.work_id}/submit`, {
      submittedBy:  this.userName,
      designation:  this.userDesignation,
      remarks:      this.submitRemarks
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.submitSuccess = `Successfully submitted to ${res.toStage}!`;
        setTimeout(() => {
          this.closeSubmitDialog();
          this.loadWorks(); // refresh list
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError  = err?.error?.detail || 'Submit failed.';
      }
    });
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goToNewWork(): void {
    this.router.navigate(['/work-order']);
  }
}
