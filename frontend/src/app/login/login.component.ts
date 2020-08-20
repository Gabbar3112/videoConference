import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  room: any = {
    roomName: '',
    yourName: '',
  };

  constructor(private router: Router) {
  }

  ngOnInit(): void {
  }

  createRoom() {
    console.log('room', this.room);
    localStorage.setItem('userName', this.room.yourName);
    localStorage.setItem('roomName', this.room.roomName);
    this.router.navigate(['/conferenceRoom']);
  }

}
