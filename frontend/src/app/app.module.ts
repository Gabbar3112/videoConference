import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import {FormsModule} from "@angular/forms";
import { ConferenceRoomComponent } from './conference-room/conference-room.component';

import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import { HttpModule } from '@angular/http';
import {SocketIoModule, SocketIoConfig} from 'ngx-socket-io';
import {environment} from "../environments/environment";
import {SocketService} from "./services/socket.service";

const config: SocketIoConfig = {url: environment.socketUri, options: {}};

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ConferenceRoomComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    HttpModule,
    SocketIoModule.forRoot(config),
  ],
  providers: [SocketService],
  bootstrap: [AppComponent]
})
export class AppModule { }
