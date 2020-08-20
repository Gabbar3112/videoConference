import {Component, OnInit, ViewChild} from '@angular/core';
import {environment} from "../../environments/environment";
import * as io from 'socket.io-client';
import * as moment from 'moment'

@Component({
  selector: 'app-conference-room',
  templateUrl: './conference-room.component.html',
  styleUrls: ['./conference-room.component.css']
})
export class ConferenceRoomComponent implements OnInit {
  @ViewChild('video') video:any;

  participants: any = [];
  myStream: any = '';
  screen: any = '';
  abc: any;
  socket;
  mediaSource = new MediaSource();

  constructor() {
  }

  ngOnInit(): void {
    // this.socketService.setupSocketConnection();
    // this.allSocketOperation();


    this.startSocket();
    var mydiv = document.getElementById('myDiv123');
    mydiv.innerHTML += '<video class="local-video mirror-mode" #video id=\'local\' volume=\'0\' autoplay muted>';
    var video = document.getElementById('local');
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          video.srcObject = (stream);
          video.play();
        })
        .catch((err)=>{
          console.log('err', err);
        })
    }

  }

  startSocket() {
    const that = this;
    this.socket = io(environment.socketUri);
    this.socket.on('connect', () => {
      let socketId = this.socket.io.engine.id;
      console.log(this.socket.id);
      console.log('this.socket.io.engine.id', this.socket.io.engine.id);

      this.socket.emit('subscribe', {
        room: localStorage.getItem('roomName'),
        socketId: socketId
      });

      that.socket.on('new user', (data) => {
        console.log("new user", data);
        that.socket.emit('newUserStart', {to: data.socketId, sender: socketId});
        that.participants.push(data.socketId);
        that.init(true, data.socketId, that.socket, socketId);
      });

      that.socket.on('newUserStart', (data) => {
        console.log("newUserStart", data);
        that.participants.push(data.sender);
        that.init(false, data.sender, that.socket, socketId);
      });

      that.socket.on('ice candidates', async (data) => {
        console.log("ice candidates", data);
        data.candidate ? await that.participants[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate)) : '';
      });

      that.socket.on('sdp', async (data) => {
        console.log("sdp", data);
        if (data.description.type === 'offer') {
          data.description ? await that.participants[data.sender].setRemoteDescription(new RTCSessionDescription(data.description)) : '';

          const video = document.getElementById('local');
          that.getUserFullMedia().then(async (stream) => {
            if ( !document.getElementById( 'local' ).getAttribute('srcObject')) {
              that.setLocalStream( stream );
            }

            //save my stream
            that.myStream = stream;

            stream.getTracks().forEach((track) => {
              that.participants[data.sender].addTrack(track, stream);
            });

            let answer = await that.participants[data.sender].createAnswer();

            await that.participants[data.sender].setLocalDescription(answer);

            that.socket.emit('sdp', {
              description: that.participants[data.sender].localDescription,
              to: data.sender,
              sender: socketId
            });
          }).catch((e) => {
            console.error(e);
          });
        } else if (data.description.type === 'answer') {
          await that.participants[data.sender].setRemoteDescription(new RTCSessionDescription(data.description));
        }
      });

      that.socket.on('chat', (data) => {
        that.addChat(data, 'remote');
      });
    });
  }

  init(createOffer, partnerName, socket, socketId) {
    const that = this;
    this.participants[partnerName] = new RTCPeerConnection(this.getIceServer());

    if (this.screen && this.screen.getTracks().length) {
      this.screen.getTracks().forEach((track) => {
        this.participants[partnerName].addTrack(track, this.screen);//should trigger negotiationneeded event
      });
    } else if (this.myStream) {
      this.myStream.getTracks().forEach((track) => {
        this.participants[partnerName].addTrack(track, this.myStream);//should trigger negotiationneeded event
      });
    } else {
      that.getUserFullMedia().then((stream) => {
        //save my stream
        this.myStream = stream;

        stream.getTracks().forEach((track) => {
          this.participants[partnerName].addTrack(track, stream);//should trigger negotiationneeded event
        });

        that.setLocalStream(stream);
      }).catch((e) => {
        console.error(`stream error: ${e}`);
      });
    }


    //create offer
    if (createOffer) {
      this.participants[partnerName].onnegotiationneeded = async () => {
        let offer = await this.participants[partnerName].createOffer();
        console.log('offer', offer);
        await this.participants[partnerName].setLocalDescription(offer);

        socket.emit('sdp', {
          description: this.participants[partnerName].localDescription,
          to: partnerName,
          sender: socketId
        });
      };
    }


    //send ice candidate to partnerNames
    this.participants[partnerName].onicecandidate = ({candidate}) => {
      socket.emit('ice candidates', {candidate: candidate, to: partnerName, sender: socketId});
    };


    //add
    this.participants[partnerName].ontrack = (e) => {
      let str = e.streams[0];
      if (document.getElementById(`${partnerName}-video`)) {
        document.getElementById( `${ partnerName }-video` ).setAttribute('srcObject', str);
      } else {
        //video elem
        let newVid = document.createElement('video');
        newVid.id = `${partnerName}-video`;
        newVid.srcObject = str;
        newVid.autoplay = true;
        newVid.className = 'remote-video';

        //video controls elements
        let controlDiv = document.createElement('div');
        controlDiv.className = 'remote-video-controls';
        controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

        //create a new div for card
        let cardDiv = document.createElement('div');
        cardDiv.className = 'card card-sm';
        cardDiv.id = partnerName;
        cardDiv.appendChild(newVid);
        cardDiv.appendChild(controlDiv);

        //put div in main-section elem
        document.getElementById('videos').appendChild(cardDiv);

        that.adjustVideoElemSize();
      }
    };


    this.participants[partnerName].onconnectionstatechange = (d) => {
      switch (this.participants[partnerName].iceConnectionState) {
        case 'disconnected':
        case 'failed':
          that.closeVideo(partnerName);
          break;

        case 'closed':
          that.closeVideo(partnerName);
          break;
      }
    };


    this.participants[partnerName].onsignalingstatechange = (d) => {
      switch (this.participants[partnerName].signalingState) {
        case 'closed':
          console.log("Signalling state is 'closed'");
          that.closeVideo(partnerName);
          break;
      }
    };
  }

  adjustVideoElemSize() {
    let elem = document.getElementsByClassName('card');
    let totalRemoteVideosDesktop = elem.length;
    let newWidth = totalRemoteVideosDesktop <= 2 ? '50%' : (
      totalRemoteVideosDesktop == 3 ? '33.33%' : (
        totalRemoteVideosDesktop <= 8 ? '25%' : (
          totalRemoteVideosDesktop <= 15 ? '20%' : (
            totalRemoteVideosDesktop <= 18 ? '16%' : (
              totalRemoteVideosDesktop <= 23 ? '15%' : (
                totalRemoteVideosDesktop <= 32 ? '12%' : '10%'
              )
            )
          )
        )
      )
    );


    for (let i = 0; i < totalRemoteVideosDesktop; i++) {
      elem[i].setAttribute('style.width', newWidth);
    }
  }

  closeVideo(elemId) {
    if (document.getElementById(elemId)) {
      document.getElementById(elemId).remove();
      this.adjustVideoElemSize();
    }
  }

  getIceServer() {
    return {
      iceServers: [
        {
          urls: ["stun:eu-turn4.xirsys.com"]
        },
        {
          username: "ml0jh0qMKZKd9P_9C0UIBY2G0nSQMCFBUXGlk6IXDJf8G2uiCymg9WwbEJTMwVeiAAAAAF2__hNSaW5vbGVl",
          credential: "4dd454a6-feee-11e9-b185-6adcafebbb45",
          urls: [
            "turn:eu-turn4.xirsys.com:80?transport=udp",
            "turn:eu-turn4.xirsys.com:3478?transport=tcp"
          ]
        }
      ]
    };
  }

  userMediaAvailable() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia);
  }

  getUserFullMedia() {
    if (this.userMediaAvailable()) {
      return navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } else {
      throw new Error('User media not available');
    }
  }

  setLocalStream(stream, mirrorMode = true) {
    console.log('in setLocalStream', mirrorMode);
    console.log('in setLocalStream', stream);
    const localVidElem = document.getElementById('local');

    localVidElem.setAttribute('srcObject',stream);

    mirrorMode ? localVidElem.classList.add('mirror-mode') : localVidElem.classList.remove('mirror-mode');
  }

  addChat(data, senderType) {
    let chatMsgDiv = document.querySelector('#chat-messages');
    let contentAlign = 'justify-content-end';
    let senderName = 'You';
    let msgBg = 'bg-white';

    if (senderType === 'remote') {
      contentAlign = 'justify-content-start';
      senderName = data.sender;
      msgBg = '';

      this.toggleChatNotificationBadge();
    }

    let infoDiv = document.createElement('div');
    infoDiv.className = 'sender-info';
    infoDiv.innerHTML = `${senderName} - ${moment().format('Do MMMM, YYYY h:mm a')}`;

    let colDiv = document.createElement('div');
    colDiv.className = `col-10 card chat-card msg ${msgBg}`;
    colDiv.innerHTML = xssFilters.inHTMLData(data.msg).autoLink({target: "_blank", rel: "nofollow"});

    let rowDiv = document.createElement('div');
    rowDiv.className = `row ${contentAlign} mb-2`;


    colDiv.appendChild(infoDiv);
    rowDiv.appendChild(colDiv);

    chatMsgDiv.appendChild(rowDiv);

    /**
     * Move focus to the newly added message but only if:
     * 1. Page has focus
     * 2. User has not moved scrollbar upward. This is to prevent moving the scroll position if user is reading previous messages.
     */
    if (this.pageHasFocus) {
      rowDiv.scrollIntoView();
    }
  }

  pageHasFocus() {
    return !(document.hidden || document.onfocusout || window.onpagehide || window.onblur);
  }

  toggleChatNotificationBadge() {
    if (document.querySelector('#chat-pane').classList.contains('chat-opened')) {
      document.querySelector('#new-chat-notification').setAttribute('hidden', 'true');
    } else {
      document.querySelector('#new-chat-notification').removeAttribute('hidden');
    }
  }

}
