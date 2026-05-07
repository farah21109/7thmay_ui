import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {

  constructor(private auth: AuthService, private router: Router) {}

  get userName()        { return this.auth.getSession()?.name        || ''; }
  get userDesignation() { return this.auth.getSession()?.designation || ''; }
  get userDepartment()  { return this.auth.getSession()?.department  || ''; }
  get userWard()        { return this.auth.getSession()?.ward        || '—'; }

  goToPrepareEstimate(): void {
    this.router.navigate(['/prepare-estimate']);
  }

  goToEditEstimate(): void {
    this.router.navigate(['/edit-estimate']);
  }

  goToReports(): void {
    this.router.navigate(['/reports']);
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
