import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";

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
  showRoomField = true;

  constructor(private router: Router,
              private activatedRoute: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      const roomName = params['roomName'];
      console.log(roomName);
      if (roomName !== undefined) {
        this.showRoomField = false;
      }
    });
  }

  createRoom() {
    console.log('room', this.room);
    localStorage.setItem('userName', this.room.yourName);
    localStorage.setItem('roomName', this.room.roomName);
    this.router.navigate(['/conferenceRoom']);
  }

}
