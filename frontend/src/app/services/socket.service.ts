/*
import {Injectable} from '@angular/core';
import {Socket} from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  constructor(public socket: Socket) {
  }

  newconnection() {
    return this.socket;
  }

  subScribeEvent(socketObj, data) {
    socketObj.emit('subscribe', data);
  }

  someOneJoin(socketObj, callback) {
    socketObj.on('new user', function (data) {
      callback(data);
    });
  }

  startProcessNewUser(socketObj, data, socketId) {
    socketObj.emit('newUserStart', {to: data.socketId, sender: socketId})
  }

  // startProcessNewUser(socketObj, data, socketId) {
  //   socketObj.on('newUserStart', {to: data.socketId, sender: socketId})
  // }


  /!*
socket.on( 'newUserStart', ( data ) => {
  pc.push( data.sender );
  init( false, data.sender );
} );


socket.on( 'ice candidates', async ( data ) => {
  data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
} );


socket.on( 'sdp', async ( data ) => {
  if ( data.description.type === 'offer' ) {
    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

    h.getUserFullMedia().then( async ( stream ) => {
      if ( !document.getElementById( 'local' ).srcObject ) {
        h.setLocalStream( stream );
      }

      //save my stream
      myStream = stream;

      stream.getTracks().forEach( ( track ) => {
        pc[data.sender].addTrack( track, stream );
      } );

      let answer = await pc[data.sender].createAnswer();

      await pc[data.sender].setLocalDescription( answer );

      socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
    } ).catch( ( e ) => {
      console.error( e );
    } );
  }

  else if ( data.description.type === 'answer' ) {
    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
  }
} );


socket.on( 'chat', ( data ) => {
  h.addChat( data, 'remote' );
} );*!/

}
*/

import * as io from 'socket.io-client';
import {Injectable} from '@angular/core';
import {environment} from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  socket;

  constructor() {
    this.socket = io(environment.socketUri);
    this.socket.on('connect', () => {
      console.log(this.socket.id);
      console.log('this.socket.io.engine.id', this.socket.io.engine.id);
    });
  }

  setupSocketConnection() {

  }

  subScribeEvent(data) {
    data.socketId = this.socket.io.engine.id;
    this.socket.emit('subscribe', data);
  }

  someOneJoin(callback) {
    this.socket.on('new user', function (data) {
      callback(data);
    });
  }

  startProcessNewUser(data) {
    this.socket.emit('newUserStart', {to: data.socketId, sender: this.socket.io.engine.id})
  }

  getNewUserData(callback) {
    this.socket.on('newUserStart', function (data) {
      callback(data);
    })
  }

  getIceCandidate(callback) {
    this.socket.on('ice candidates', function (data) {
      callback(data);
    //  data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
    })
  }

  getSDP(callback) {
    this.socket.on('sdp', function (data) {
      callback(data);
    //  if ( data.description.type === 'offer' ) {
      //     data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';
      //
      //     h.getUserFullMedia().then( async ( stream ) => {
      //       if ( !document.getElementById( 'local' ).srcObject ) {
      //         h.setLocalStream( stream );
      //       }
      //
      //       //save my stream
      //       myStream = stream;
      //
      //       stream.getTracks().forEach( ( track ) => {
      //         pc[data.sender].addTrack( track, stream );
      //       } );
      //
      //       let answer = await pc[data.sender].createAnswer();
      //
      //       await pc[data.sender].setLocalDescription( answer );
      //
      //       socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
      //     } ).catch( ( e ) => {
      //       console.error( e );
      //     } );
      //   }
      //
      //   else if ( data.description.type === 'answer' ) {
      //     await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
      //   }
    })
  }

  emitSDP(data) {
    data.sender = this.socket.io.engine.id;
    this.socket.emit('sdp', data);
  }

  onChat(callback) {
    this.socket.on('chat', function (data) {
      callback(data);
      //  h.addChat( data, 'remote' );
    })
  }
}
