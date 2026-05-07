import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  username:     string  = '';
  password:     string  = '';
  isLoading:    boolean = false;
  errorMsg:     string  = '';
  showPassword: boolean = false;

  constructor(private auth: AuthService, private router: Router) {
    // If already logged in, redirect to work order
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/home']);
    }
  }

  onLogin(): void {
    this.errorMsg = '';

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMsg = 'Please enter both username and password.';
      return;
    }

    this.isLoading = true;

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.user) {
          this.auth.saveSession(res.user);
          // All designations go to dashboard first
          this.router.navigate(['/home']);
        } else {
          this.errorMsg = res.message || 'Invalid credentials.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg  = err?.error?.message || 'Login failed. Please try again.';
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
