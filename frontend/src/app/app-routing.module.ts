import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {LoginComponent} from "./login/login.component";
import {ConferenceRoomComponent} from "./conference-room/conference-room.component";


const routes: Routes = [
  { path:'login', component: LoginComponent},
  { path:'conferenceRoom', component: ConferenceRoomComponent},
  { path:'**', redirectTo: 'login'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
