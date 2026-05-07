import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent {

  private apiBase = 'http://localhost:3000/api';

  workIdInput: string  = '';
  isSearching: boolean = false;
  searchError: string  = '';
  reportLoaded: boolean = false;

  workInfo:    any    = null;
  abstract:    any    = null;
  items:       any[]  = [];

  materialItems:   any[] = [];
  civilWorksItems: any[] = [];
  materialTotal:   number = 0;
  civilWorksTotal: number = 0;

  constructor(
    private auth:   AuthService,
    private http:   HttpClient,
    private router: Router
  ) {}

  get userName()        { return this.auth.getSession()?.name        || ''; }
  get userDesignation() { return this.auth.getSession()?.designation || ''; }

  onSearch(): void {
    if (!this.workIdInput.trim()) { this.searchError = 'Please enter a Work ID.'; return; }

    this.isSearching  = true;
    this.searchError  = '';
    this.reportLoaded = false;

    this.http.get<any>(`${this.apiBase}/works/by-name?q=${encodeURIComponent(this.workIdInput.trim())}`).subscribe({
      next: (res) => {
        if (!res || !res.work_id) {
          this.isSearching = false;
          this.searchError = 'Work ID not found.';
          return;
        }

        this.workInfo = res;

        // Load items and abstract in parallel
        this.http.get<any[]>(`${this.apiBase}/works/${res.work_id}/items`).subscribe({
          next: (items) => {
            this.items           = items;
            this.materialItems   = items.filter(i => i.is_material);
            this.civilWorksItems = items.filter(i => !i.is_material);
            this.materialTotal   = parseFloat(this.materialItems.reduce((s, i) => s + Number(i.amount), 0).toFixed(2));
            this.civilWorksTotal = parseFloat(this.civilWorksItems.reduce((s, i) => s + Number(i.amount), 0).toFixed(2));

            this.http.get<any>(`${this.apiBase}/works/${res.work_id}/abstract`).subscribe({
              next: (abs) => {
                this.abstract     = abs;
                this.isSearching  = false;
                this.reportLoaded = true;
              },
              error: () => {
                this.abstract     = null;
                this.isSearching  = false;
                this.reportLoaded = true;
              }
            });
          },
          error: () => { this.isSearching = false; this.searchError = 'Failed to load items.'; }
        });
      },
      error: () => { this.isSearching = false; this.searchError = 'Work ID not found.'; }
    });
  }

  goBack(): void { this.router.navigate(['/home']); }
}
