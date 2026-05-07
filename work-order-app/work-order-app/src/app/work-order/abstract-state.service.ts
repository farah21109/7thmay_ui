import { Injectable } from '@angular/core';

export interface AbstractState {
  nameOfWork: string;
  division:   string;
  circle:     string;
  ward:       string;
  savedItems: any[];
  gstRate:    number;
  gstAmount:  number;
  grandTotal: number;
  workId?:    string;
  viewOnly?:  boolean;
  canEdit?:   boolean;
}

@Injectable({ providedIn: 'root' })
export class AbstractStateService {
  private state: AbstractState | null = null;

  setState(data: AbstractState): void { this.state = data; }
  getState(): AbstractState | null    { return this.state; }
  clear(): void                       { this.state = null; }
}
