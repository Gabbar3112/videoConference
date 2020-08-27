import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {environment} from '../../environments/environment';
import * as io from 'socket.io-client';
import * as moment from 'moment';

declare var MediaRecorder: any;
declare var xssFilters: any;
declare var saveAs: any;
declare var jQuery: any;

@Component({
  selector: 'app-conference-room',
  templateUrl: './conference-room.component.html',
  styleUrls: ['./conference-room.component.css']
})
export class ConferenceRoomComponent implements OnInit, AfterViewInit {
  @ViewChild('video') video: any;
  @ViewChild('local') local: ElementRef;
  @ViewChild('videos') videos: ElementRef;

  participants: any = [];
  recordedStream: any = [];
  myStream: any = '';
  screen: any = '';
  mediaRecorder: any;
  socket;
  username: any = '';
  link = '';
  roomName = '';
  localSocket: any;
  videoToggleBtnDisable = false;

  constructor() {
  }

  ngOnInit(): void {
    this.link = localStorage.getItem('link');
    this.roomName = localStorage.getItem('roomName');
    this.username = localStorage.getItem('userName');

    this.getAndSetUserStream();
    this.startSocket();
    this.registerClickMethods();
  }

  ngAfterViewInit() {
    console.log('local', this.local.nativeElement.innerHTML);
  }

  getAndSetUserStream() {
    this.getUserFullMedia().then(async (stream) => {
      // save my stream
      this.myStream = stream;
      // this.localStream = stream;

      await this.setLocalStream(stream);
    }).catch((e) => {
      console.error(`stream error: ${e}`);
    });
  }

  // socket connecting methods
  startSocket() {
    const that = this;
    this.socket = io(environment.socketUri);
    this.socket.on('connect', () => {
      const masterSocketId = this.socket.io.engine.id;
      this.localSocket = this.socket;

      this.socket.emit('subscribe', {
        room: localStorage.getItem('roomName'),
        socketId: masterSocketId
      });

      that.socket.on('new user', (data) => {
        that.socket.emit('newUserStart', {to: data.socketId, sender: masterSocketId});
        that.participants.push(data.socketId);
        that.init(true, data.socketId, that.socket, masterSocketId);
      });

      that.socket.on('newUserStart', (data) => {
        that.participants.push(data.sender);
        that.init(false, data.sender, that.socket, masterSocketId);
      });

      that.socket.on('ice candidates', async (data) => {
        data.candidate ? await that.participants[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate)) : '';
      });

      that.socket.on('sdp', async (data) => {
        if (data.description.type === 'offer') {
          data.description ? await that.participants[data.sender].setRemoteDescription(new RTCSessionDescription(data.description)) : '';

          const video = document.getElementById('local') as HTMLVideoElement;
          that.getUserFullMedia().then(async (stream) => {
            if (!video.srcObject) {
              await that.setLocalStream(stream);
            }

            // save my stream
            that.myStream = stream;

            stream.getTracks().forEach((track) => {
              that.participants[data.sender].addTrack(track, stream);
            });

            const answer = await that.participants[data.sender].createAnswer();

            await that.participants[data.sender].setLocalDescription(answer);

            that.socket.emit('sdp', {
              description: that.participants[data.sender].localDescription,
              to: data.sender,
              sender: masterSocketId
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
        this.participants[partnerName].addTrack(track, this.screen); // should trigger negotiationneeded event
      });
    } else if (this.myStream) {
      this.myStream.getTracks().forEach((track) => {
        this.participants[partnerName].addTrack(track, this.myStream); // should trigger negotiationneeded event
      });
    } else {
      that.getUserFullMedia().then(async (stream) => {
        // save my stream
        this.myStream = stream;

        stream.getTracks().forEach((track) => {
          this.participants[partnerName].addTrack(track, stream); // should trigger negotiationneeded event
        });

        await that.setLocalStream(stream);
      }).catch((e) => {
        console.error(`stream error: ${e}`);
      });
    }


    // create offer
    if (createOffer) {
      this.participants[partnerName].onnegotiationneeded = async () => {
        const offer = await this.participants[partnerName].createOffer();
        await this.participants[partnerName].setLocalDescription(offer);

        socket.emit('sdp', {
          description: this.participants[partnerName].localDescription,
          to: partnerName,
          sender: socketId
        });
      };
    }


    // send ice candidate to partnerNames
    this.participants[partnerName].onicecandidate = ({candidate}) => {
      socket.emit('ice candidates', {candidate, to: partnerName, sender: socketId});
    };


    // add
    this.participants[partnerName].ontrack = (e) => {
      const str = e.streams[0];
      if (document.getElementById(`${partnerName}-video`)) {
        document.getElementById(`${partnerName}-video`).setAttribute('srcObject', str);
      } else {
        // video elem
        const newVid = document.createElement('video');
        newVid.id = `${partnerName}-video`;
        newVid.srcObject = str;
        newVid.autoplay = true;
        newVid.className = 'remote-video';
        newVid.style.height = '100px';

        // video controls elements
        const controlDiv = document.createElement('div');
        controlDiv.className = 'remote-video-controls';
        controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

        // create a new div for card
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card card-sm';
        cardDiv.id = partnerName;
        cardDiv.appendChild(newVid);
        cardDiv.appendChild(controlDiv);

        // put div in main-section elem
        // document.getElementById('videos').appendChild(cardDiv);
        let video = this.videos.nativeElement;
        video.appendChild(cardDiv);

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
          that.closeVideo(partnerName);
          break;
      }
    };
  }

  adjustVideoElemSize() {
    const elem = document.getElementsByClassName('card');
    const totalRemoteVideosDesktop = elem.length;
    const newWidth = totalRemoteVideosDesktop <= 2 ? '50%' : (
      totalRemoteVideosDesktop === 3 ? '33.33%' : (
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
          urls: ['stun:eu-turn4.xirsys.com']
        },
        {
          username: 'ml0jh0qMKZKd9P_9C0UIBY2G0nSQMCFBUXGlk6IXDJf8G2uiCymg9WwbEJTMwVeiAAAAAF2__hNSaW5vbGVl',
          credential: '4dd454a6-feee-11e9-b185-6adcafebbb45',
          urls: [
            'turn:eu-turn4.xirsys.com:80?transport=udp',
            'turn:eu-turn4.xirsys.com:3478?transport=tcp'
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

  async setLocalStream(stream, mirrorMode = true) {
    // const localVidElem = this.local.nativeElement;
    const localVidElem = document.getElementById('local') as HTMLVideoElement;

    localVidElem.srcObject = (stream);
    await localVidElem.play();

    mirrorMode ? localVidElem.classList.add('mirror-mode') : localVidElem.classList.remove('mirror-mode');
  }

  pageHasFocus() {
    // return !(document.hidden || document.onfocusout || document.onmouseout || window.onpagehide || window.onblur);
    return !(document.hidden || document.onmouseout || window.onpagehide || window.onblur);
  }

  toggleChatNotificationBadge() {
    if (document.querySelector('#chat-pane').classList.contains('chat-opened')) {
      document.querySelector('#new-chat-notification').setAttribute('hidden', 'true');
    } else {
      document.querySelector('#new-chat-notification').removeAttribute('hidden');
    }
  }

  // socket connecting methods end

  maximiseStream(e) {
    const elem = e.target.parentElement.previousElementSibling;

    return elem.requestFullscreen() || elem.mozRequestFullScreen() || elem.webkitRequestFullscreen() || elem.msRequestFullscreen();
  }

  singleStreamToggleMute(e) {
    if (e.target.classList.contains('fa-microphone')) {
      e.target.parentElement.previousElementSibling.muted = true;
      e.target.classList.add('fa-microphone-slash');
      e.target.classList.remove('fa-microphone');
    } else {
      e.target.parentElement.previousElementSibling.muted = false;
      e.target.classList.add('fa-microphone');
      e.target.classList.remove('fa-microphone-slash');
    }
  }

  toggleModal(id, show) {
    const el = document.getElementById(id);

    if (show) {
      el.style.display = 'block';
      el.removeAttribute('aria-hidden');
    } else {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
  }

  replaceTrack(stream, recipientPeer) {
    const sender = recipientPeer.getSenders ? recipientPeer.getSenders().find(s => s.track && s.track.kind === stream.kind) : false;

    sender ? sender.replaceTrack(stream) : '';
  }

  async broadcastNewTracks(stream, type, mirrorMode = true) {
    await this.setLocalStream(stream, mirrorMode);
    const track = (type === 'audio') ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

    (this.participants).forEach((p) => {
      const pName = this.participants[p];
      if (typeof pName === 'object') {
        this.replaceTrack(track, pName);
      }
    });
  }

  toggleVideoBtnDisabled(disabled) {
    // document.getElementById('toggle-video').disabled = disabled;
    this.videoToggleBtnDisable = disabled;
  }

  toggleShareIcons(share) {
    const shareIconElem = document.querySelector('#share-screen');

    if (share) {
      shareIconElem.setAttribute('title', 'Stop sharing screen');
      shareIconElem.children[0].classList.add('text-primary');
      shareIconElem.children[0].classList.remove('text-white');
    } else {
      shareIconElem.setAttribute('title', 'Share screen');
      shareIconElem.children[0].classList.add('text-white');
      shareIconElem.children[0].classList.remove('text-primary');
    }
  }

  stopSharingScreen() {
    console.log('stopSharingScreen');
    // enable video toggle btn
    this.toggleVideoBtnDisabled(false);

    return new Promise((res, rej) => {
      this.screen.getTracks().length ? this.screen.getTracks().forEach(track => track.stop()) : '';
      res();
    }).then(async () => {
      this.toggleShareIcons(false);
      // await this.broadcastNewTracks(this.screen, 'video');
      await this.getAndSetUserStream();
    }).catch((e) => {
      console.error(e);
    });
  }

  helperShareScreen() {
    if (this.userMediaAvailable()) {
      const mediaDevices = navigator.mediaDevices as any;
      return mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      /*return navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });*/
    } else {
      throw new Error('User media not available');
    }
  }

  shareScreen() {
    this.helperShareScreen().then(async (stream) => {
      this.toggleShareIcons(true);

      // disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
      // It will be enabled was user stopped sharing screen
      this.toggleVideoBtnDisabled(true);

      // save my screen stream
      this.screen = stream;

      // share the new stream with all partners
      await this.broadcastNewTracks(stream, 'video', false);

      // When the stop sharing button shown by the browser is clicked
      this.screen.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopSharingScreen();
      });
    }).catch((e) => {
      console.error(e);
    });
  }

  toggleRecordingIcons(isRecording) {
    const e = document.getElementById('record');

    if (isRecording) {
      e.setAttribute('title', 'Stop recording');
      e.children[0].classList.add('text-danger');
      e.children[0].classList.remove('text-white');
    } else {
      e.setAttribute('title', 'Record');
      e.children[0].classList.add('text-white');
      e.children[0].classList.remove('text-danger');
    }
  }

  saveRecordedStream(stream, user) {
    const blob = new Blob(stream, {type: 'video/webm'});

    const file = new File([blob], `${user}-${moment().unix()}-record.webm`);

    saveAs(file);
  }

  startRecording(stream) {
    const that = this;
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    this.mediaRecorder.start(1000);
    this.toggleRecordingIcons(true);

    this.mediaRecorder.ondataavailable = function (e) {
      that.recordedStream.push(e.data);
    };

    this.mediaRecorder.onstop = function () {
      that.toggleRecordingIcons(false);

      that.saveRecordedStream(that.recordedStream, that.username);

      setTimeout(() => {
        that.recordedStream = [];
      }, 3000);
    };

    this.mediaRecorder.onerror = function (e) {
      console.error(e);
    };
  }

  addChat(data, senderType) {
    const chatMsgDiv = document.querySelector('#chat-messages');
    let contentAlign = 'justify-content-end';
    let senderName = 'You';
    let msgBg = 'bg-white';

    if (senderType === 'remote') {
      contentAlign = 'justify-content-start';
      senderName = data.sender;
      msgBg = '';

      this.toggleChatNotificationBadge();
    }

    const infoDiv = document.createElement('div');
    infoDiv.className = 'sender-info';
    infoDiv.innerHTML = `${senderName} - ${moment().format('Do MMMM, YYYY h:mm a')}`;

    const colDiv = document.createElement('div');
    colDiv.className = `col-10 card chat-card msg ${msgBg}`;
    colDiv.innerHTML = xssFilters.inHTMLData(data.msg).autoLink({target: '_blank', rel: 'nofollow'});

    const rowDiv = document.createElement('div');
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

  sendMsg(msg) {
    const data = {
      room: this.roomName,
      msg,
      sender: this.username
    };

    // emit chat message
    this.localSocket.emit('chat', data);

    // add localchat
    this.addChat(data, 'local');
  }

  copyToClipboard(val) {
    let selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = val;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
    // this.toaster('success', 'Success!', 'Link copied to clipboard.');
  }

  registerClickMethods() {
    document.querySelector('#toggle-chat-pane').addEventListener('click', (e) => {
      const chatElem = document.querySelector('#chat-pane');
      const mainSecElem = document.querySelector('#main-section');

      if (chatElem.classList.contains('chat-opened')) {
        chatElem.setAttribute('hidden', 'true');
        mainSecElem.classList.remove('col-md-9');
        mainSecElem.classList.add('col-md-12');
        chatElem.classList.remove('chat-opened');
      } else {
        chatElem.attributes.removeNamedItem('hidden');
        mainSecElem.classList.remove('col-md-12');
        mainSecElem.classList.add('col-md-9');
        chatElem.classList.add('chat-opened');
      }

      // remove the 'New' badge on chat icon (if any) once chat is opened.
      setTimeout(() => {
        if (document.querySelector('#chat-pane').classList.contains('chat-opened')) {
          this.toggleChatNotificationBadge();
        }
      }, 300);
    });

    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      let text = e.target as HTMLTextAreaElement;
      // if (e.which === 13 && (e.target.value.trim())) {
      if (e.which === 13 && (text.value.trim())) {
        e.preventDefault();

        // this.sendMsg(e.target.value);
        this.sendMsg(text.value);

        setTimeout(() => {
          // e.target.value = '';
          text.value = '';
        }, 50);
      }
    });

    // When the video frame is clicked. This will enable picture-in-picture
    document.getElementById('local').addEventListener('click', async () => {
      const video = document.getElementById('local') as HTMLElement;
      try {
        (async function ($) {
          if (!$(document).pictureInPictureElement) {
            await $(document).getElementById('local').requestPictureInPicture();
          } else {
            await $(document).exitPictureInPicture();
          }
        })
      } catch (error) {
        console.error(`Oh Horror! ${error}`);
      }
    });


    document.addEventListener('click', (e) => {
      let abc = e.target as HTMLElement;
      if (abc && abc.className.includes('expand-remote-video')) {
        // if (e.target && e.target.classList.contains('expand-remote-video')) {
        this.maximiseStream(e);
      } else if (abc && abc.className.includes('mute-remote-mic')) {
        // } else if (e.target && e.target.classList.contains('mute-remote-mic')) {
        this.singleStreamToggleMute(e);
      }
    });

    document.getElementById('closeModal').addEventListener('click', () => {
      this.toggleModal('recording-options-modal', false);
    });

    document.getElementById('toggle-video').addEventListener('click', async (e) => {
      e.preventDefault();

      const elem = document.getElementById('toggle-video');

      if (this.myStream.getVideoTracks()[0].enabled) {
        let abc = e.target as HTMLTextAreaElement;
        abc.classList.remove('fa-video');
        // e.target.classList.remove('fa-video');
        abc.classList.add('fa-video-slash');
        // e.target.classList.add('fa-video-slash');
        elem.setAttribute('title', 'Show Video');

        this.myStream.getVideoTracks()[0].enabled = false;
      } else {
        let abc = e.target as HTMLElement;
        abc.classList.remove('fa-video-slash');
        // e.target.classList.remove('fa-video-slash');
        abc.classList.add('fa-video');
        // e.target.classList.add('fa-video');
        elem.setAttribute('title', 'Hide Video');

        this.myStream.getVideoTracks()[0].enabled = true;
      }

      await this.broadcastNewTracks(this.myStream, 'video');
    });

    document.getElementById('toggle-mute').addEventListener('click', async (e) => {
      e.preventDefault();

      const elem = document.getElementById('toggle-mute');

      if (this.myStream.getAudioTracks()[0].enabled) {
        let abc = e.target as HTMLElement;
        // abc.className.replace('fa-microphone-alt', 'fa-microphone-alt-slash')
        abc.classList.remove('fa-microphone-alt');
        // e.target.classList.remove('fa-microphone-alt');
        abc.classList.add('fa-microphone-alt-slash');
        // e.target.classList.add('fa-microphone-alt-slash');
        elem.setAttribute('title', 'Unmute');

        this.myStream.getAudioTracks()[0].enabled = false;
      } else {
        let abc = e.target as HTMLElement;
        // abc.className.replace('fa-microphone-alt-slash', 'fa-microphone-alt')
        // e.target.classList.remove('fa-microphone-alt-slash');
        abc.classList.remove('fa-microphone-alt-slash');
        // e.target.classList.add('fa-microphone-alt');
        abc.classList.add('fa-microphone-alt');
        elem.setAttribute('title', 'Mute');

        this.myStream.getAudioTracks()[0].enabled = true;
      }

      await this.broadcastNewTracks(this.myStream, 'audio');
    });

    // When user clicks the 'Share screen' button
    document.getElementById('share-screen').addEventListener('click', (e) => {
      e.preventDefault();
      if (this.screen && this.screen.getVideoTracks().length && this.screen.getVideoTracks()[0].readyState !== 'ended') {
       this.stopSharingScreen();
      } else {
        this.shareScreen();
      }
    });


    // When record button is clicked
    document.getElementById('record').addEventListener('click', (e) => {
      /**
       * Ask user what they want to record.
       * Get the stream based on selection and start recording
       */
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.toggleModal('recording-options-modal', true);
      } else if (this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      } else if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
    });


    // When user choose to record screen
    document.getElementById('record-screen').addEventListener('click', () => {
      this.toggleModal('recording-options-modal', false);

      if (this.screen && this.screen.getVideoTracks().length) {
        this.startRecording(this.screen);
      } else {
        this.helperShareScreen().then((screenStream) => {
          this.startRecording(screenStream);
        }).catch(() => {
        });
      }
    });


    // When user choose to record own video
    document.getElementById('record-video').addEventListener('click', () => {
      this.toggleModal('recording-options-modal', false);

      if (this.screen && this.screen.getTracks().length) {
        this.startRecording(this.screen);
      } else {
        this.getUserFullMedia().then((videoStream) => {
          this.startRecording(videoStream);
        }).catch(() => {
        });
      }
    });
  }
}
