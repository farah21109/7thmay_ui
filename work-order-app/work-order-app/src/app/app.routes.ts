import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { PrepareEstimateComponent } from './home/prepare-estimate.component';
import { EditEstimateComponent } from './home/edit-estimate.component';
import { ReportsComponent } from './reports/reports.component';
import { AbstractComponent } from './abstract/abstract.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  { path: '',                 redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',            component: LoginComponent },
  { path: 'home',             component: HomeComponent,            canActivate: [AuthGuard] },
  { path: 'prepare-estimate', component: PrepareEstimateComponent, canActivate: [AuthGuard] },
  { path: 'edit-estimate',    component: EditEstimateComponent,    canActivate: [AuthGuard] },
  { path: 'reports',          component: ReportsComponent,         canActivate: [AuthGuard] },
  { path: 'abstract',         component: AbstractComponent,        canActivate: [AuthGuard] },
  { path: '**',               redirectTo: 'login' }
];
