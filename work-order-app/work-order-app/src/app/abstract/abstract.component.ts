import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AbstractStateService } from '../work-order/abstract-state.service';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-abstract',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './abstract.component.html',
  styleUrls: ['./abstract.component.css']
})
export class AbstractComponent implements OnInit {

  private apiBase = 'http://localhost:3000/api';

  nameOfWork: string = '';
  division:   string = '';
  circle:     string = '';
  ward:       string = '';
  savedItems: any[]  = [];
  gstRate:    number = 0;
  gstAmount:  number = 0;

  materialItems:   any[]  = [];
  civilWorksItems: any[]  = [];
  materialTotal:   number = 0;
  civilWorksTotal: number = 0;
  lsAmount:        number = 0;
  grandTotal:      number = 0;

  // Workflow flags
  workId:          string  = '';
  viewOnly:        boolean = false;
  canEditAbstract: boolean = true;

  // Save state
  editedBy:    string  = '';
  isSaving:    boolean = false;
  saveSuccess: boolean = false;
  saveError:   string  = '';
  generatedWorkId: string = '';

  constructor(
    private stateService: AbstractStateService,
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) {}

  get userName()        { return this.auth.getSession()?.name        || ''; }
  get userDesignation() { return this.auth.getSession()?.designation || ''; }
  get isDirector()      { return this.userDesignation === 'Director'; }

  onLogout(): void { this.auth.logout(); this.router.navigate(['/login']); }

  ngOnInit(): void {
    const state = this.stateService.getState();
    if (!state) {
      this.router.navigate(['/']);
      return;
    }

    this.nameOfWork = state.nameOfWork;
    this.division   = state.division;
    this.circle     = state.circle;
    this.ward       = state.ward;
    this.savedItems = state.savedItems;
    this.gstRate    = state.gstRate;
    this.gstAmount  = state.gstAmount;

    // Workflow flags
    this.workId          = state.workId   || '';
    this.viewOnly        = state.viewOnly  || false;
    this.canEditAbstract = state.canEdit  !== false;

    this.materialItems   = this.savedItems.filter((i: any) => i.isMaterial === 'Yes');
    this.civilWorksItems = this.savedItems.filter((i: any) => i.isMaterial === 'No');
    this.materialTotal   = parseFloat(this.materialItems.reduce((s: number, i: any) => s + i.amount, 0).toFixed(2));
    this.civilWorksTotal = parseFloat(this.civilWorksItems.reduce((s: number, i: any) => s + i.amount, 0).toFixed(2));

    this.recalcGrandTotal();
  }

  onLsChange(): void {
    this.recalcGrandTotal();
  }

  recalcGrandTotal(): void {
    this.grandTotal = parseFloat(
      (this.materialTotal + this.civilWorksTotal + this.gstAmount + (this.lsAmount || 0)).toFixed(2)
    );
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  onSave(): void {
    this.isSaving    = true;
    this.saveError   = '';
    this.saveSuccess = false;
    this.generatedWorkId = '';

    const workOrderPayload = {
      nameOfWork: this.nameOfWork,
      division:   this.division,
      circle:     this.circle,
      ward:       this.ward,
      items:      this.savedItems,
      savedBy:    this.editedBy
    };

    this.http.post<any>(`${this.apiBase}/save-work-order`, workOrderPayload).subscribe({
      next: (response) => {
        const workId = response.workId;
        this.generatedWorkId = workId;

        const abstractPayload = {
          workId:          workId,
          nameOfWork:      this.nameOfWork,
          materialTotal:   this.materialTotal,
          civilWorksTotal: this.civilWorksTotal,
          gstRate:         this.gstRate,
          gstAmount:       this.gstAmount,
          lsAmount:        this.lsAmount || 0,
          grandTotal:      this.grandTotal,
          editedBy:        this.editedBy || ''
        };

        this.http.post<any>(`${this.apiBase}/save-abstract`, abstractPayload).subscribe({
          next: () => {
            this.isSaving    = false;
            this.saveSuccess = true;
          },
          error: (err) => {
            this.isSaving  = false;
            this.saveError = 'Abstract save failed: ' + (err?.error?.detail || err.message);
          }
        });
      },
      error: (err) => {
        this.isSaving  = false;
        this.saveError = 'Work order save failed: ' + (err?.error?.detail || err.message);
      }
    });
  }
}