import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id:            number;
  name:          string;
  username:      string;
  designation:   string;
  department:    string;
  ward:          string | null;
  contactNumber: string;
}

export interface LoginResponse {
  success: boolean;
  user?:   User;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private apiBase     = 'http://localhost:3000/api';
  private SESSION_KEY = 'work_order_user';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBase}/login`, { username, password });
  }

  saveSession(user: User): void {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  }

  getSession(): User | null {
    const data = sessionStorage.getItem(this.SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getSession();
  }

  logout(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
}
