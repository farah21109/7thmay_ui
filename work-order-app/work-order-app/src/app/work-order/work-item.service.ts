import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface WorkItemSuggestion {
  id: number;
  description: string;
  unit: string;
  rate: number;
}

@Injectable({ providedIn: 'root' })
export class WorkItemService {

  // Backend URL — change port here if you used a different one in .env
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  searchItems(query: string): Observable<WorkItemSuggestion[]> {
    if (!query || query.trim().length < 2) return of([]);
    const params = new HttpParams().set('q', query.trim());
    return this.http
      .get<WorkItemSuggestion[]>(`${this.baseUrl}/items/search`, { params })
      .pipe(catchError(() => of([])));
  }

  getItem(id: number): Observable<WorkItemSuggestion> {
    return this.http.get<WorkItemSuggestion>(`${this.baseUrl}/items/${id}`);
  }
}
