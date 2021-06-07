import { AfterViewInit, ElementRef } from '@angular/core';
import { ViewChild } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from 'src/environments/environment';
import { DataService } from './service/data.service';
import { WebSocketService } from './service/web-socket.service';
import { Message } from './types/message';
import { User } from './types/user';

declare var MediaRecorder: any;

export const ENV_RTCPeerConfiguration = environment.RTCPeerConfiguration;

const offerOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

@Component({
  selector: 'app-video-conference',
  templateUrl: './video-conference.component.html',
  styleUrls: ['./video-conference.component.css']
})
export class VideoConferenceComponent implements AfterViewInit {

  @ViewChild('recordedVideo') recordVideoElementRef!: ElementRef;
  @ViewChild('remoteVideo') remoteVideoElementRef!: ElementRef;
  @ViewChild('video') videoElementRef!: ElementRef;
  @ViewChild('messageBox') messageDataChannel!: ElementRef;
  @ViewChild('sendButton') sendDataChannel!: ElementRef;
  @ViewChild('receiveBox') receiveDataBox!: ElementRef;

  mediaRecorder: any;
  recordedBlobs!: Blob[];
  isRecording: boolean = false
  isVideo: boolean = true
  downloadUrl!: string;
  options: any;
  public sendChannel = null;
  dataChannel!: RTCDataChannel;
  receiveChannel!: RTCDataChannel;
  messageBox: any;
  sendButton: any;
  peers: [] = [];
  roomId: any;

  private localPeerConnection!: RTCPeerConnection;
  private localStream!: MediaStream;
  // private remotePeerConnection!: RTCPeerConnection;
  private peer: any;
  newuser: User ={
    meetingid: undefined,
    displayName: "undefined"
  };
  inCall: boolean = false;
  private remoteStream!: MediaStream;

  constructor(private dataService: DataService, private activateRoute: ActivatedRoute, private webSocketService: WebSocketService) {
  }

  ngAfterViewInit(): void {
    this.addIncomingMessageHandler();
    this.getMediaDevices();
    this.activateRoute.params.subscribe(params => {
      this.roomId = this.activateRoute.snapshot.params['roomId'];
      console.log("Custom roomId is ", this.roomId);
    });
  }

  private async getMediaDevices(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 360
        },
        audio: true
      });
      // pause all tracks
      this.stopVideo();
    } catch (e) {
      console.error(e);
      alert(`getUserMedia() error: ${e.name}`);
    }
    // await navigator.mediaDevices.getUserMedia({
    //   video: {
    //     width: 360
    //   },
    //   audio: true
    // }).then(stream => {
    //   this.localStream = stream;
    //   this.stopVideo();
    // })
  }

  startVideo() {
    this.localStream.getTracks().forEach(track => {
      track.enabled = true;
    })
    this.videoElementRef.nativeElement.srcObject = this.localStream;
    this.isVideo = !this.isVideo;
  }

  stopVideo() {
    this.localStream.getTracks().forEach(track => {
      track.enabled = false;
    })
    this.videoElementRef.nativeElement.srcObject = undefined;
    this.isVideo = !this.isVideo;
  }

  startRecording() {
    this.recordedBlobs = []
    this.options = { mimeType: 'video/webm' }

    try {
      this.mediaRecorder = new MediaRecorder(this.localStream, this.options)
    } catch (err) {
      console.log(err)
    }

    this.mediaRecorder.start() // collect 100ms of data
    this.isRecording = !this.isRecording
    this.onDataAvailableEvent()
    this.onStopRecordingEvent()
  }

  stopRecording() {
    this.mediaRecorder.stop()
    this.isRecording = !this.isRecording
    console.log('Recorded Blobs: ', this.recordedBlobs)
  }

  playRecording() {
    if (!this.recordedBlobs || !this.recordedBlobs.length) {
      console.log('cannot play.')
      return
    }
    this.recordVideoElementRef.nativeElement.src.play()
  }

  onDataAvailableEvent() {
    try {
      this.mediaRecorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          this.recordedBlobs.push(e.data)
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  onStopRecordingEvent() {
    try {
      this.mediaRecorder.onstop = (event: Event) => {
        const videoBuffer = new Blob(this.recordedBlobs, { type: 'video/webm' })
        this.downloadUrl = window.URL.createObjectURL(videoBuffer) // you can download with <a> tag
        this.recordVideoElementRef.nativeElement.src = this.downloadUrl
      }
    } catch (error) {
      console.log(error)
    }
  }

  /* ########################  OUTGOING CALL HANDLER  ################################## */
  async call(): Promise<void> {
    this.createPeerConnection();
    this.localStream.getTracks().forEach(
      track => this.localPeerConnection.addTrack(track, this.localStream));
    console.log("Local video is:", this.videoElementRef.nativeElement.srcObject);
    try {
      const offer: RTCSessionDescriptionInit = await this.localPeerConnection.createOffer(offerOptions);
      await this.localPeerConnection.setLocalDescription(offer);
      // this.inCall = true;
      this.webSocketService.sendMessage({ type: 'offer', data: offer });
    } catch (err) {
      this.handleGetUserMediaError(err);
    }
  }

  private closeVideoCall(): void {
    if (this.localPeerConnection) {
      this.localPeerConnection.onicecandidate = null;
      this.localPeerConnection.oniceconnectionstatechange = null;
      this.localPeerConnection.onsignalingstatechange = null;
      this.localPeerConnection.ontrack = null;
    }

    this.localPeerConnection.getTransceivers().forEach(transceiver => {
      transceiver.stop();
    });

    // Close the peer connection
    this.localPeerConnection.close();
    // this.localPeerConnection = null;

    this.inCall = false;
  }

  private createPeerConnection() {
    console.log('creating PeerConnection...');
    this.localPeerConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);
    this.webSocketService.joinRoom("join-room", this.roomId);
    this.newuser.displayName = "Surbhi";
    this.newuser.meetingid = this.roomId;
    this.webSocketService.emit("userconnect",this.newuser);
    this.localPeerConnection.onicecandidate = this.handleICECandidateEvent;
    this.localPeerConnection.ontrack = this.handleTrackEvent;
    this.localPeerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.localPeerConnection.onsignalingstatechange = this.handleSignalingStateChangeEvent;
  }

  /*############################### EVENT Handler ###############################*/

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    console.log("ICECandidateEvent handler", event);
    if (event.candidate && this.localPeerConnection.signalingState ==='stable' && this.localPeerConnection.remoteDescription) {
      this.webSocketService.sendMessage({
        type: 'ice-candidate',
        data: event.candidate
      });
    }
  }

  private handleICEConnectionStateChangeEvent = (event: Event) => {
    console.log("ICEConnectionStateChangeEvent handler", event);
    switch (this.localPeerConnection.iceConnectionState) {
      case 'closed':
      case 'failed':
      case 'disconnected':
        this.closeVideoCall();
        break;
    }
  }

  private handleSignalingStateChangeEvent = (event: Event) => {
    console.log("SignalingStateChangeEvent handler", event);
    switch (this.localPeerConnection.signalingState) {
      case 'closed':
        this.closeVideoCall();
        break;
      case 'stable':
        if(this.localPeerConnection.remoteDescription){
          this.handleICECandidateEvent;
          break;
        }
        
    }
  }

  private handleTrackEvent = (event: RTCTrackEvent) => {
    console.log(" handling Track Event :", event.track);
    console.log(" STreamss ", event.streams[0]);
    this.remoteVideoElementRef.nativeElement.srcObject = event.streams[0]; 
    console.log("Remote Video : ", this.remoteVideoElementRef.nativeElement.srcObject);
  }

  /*####################### Incoming Call Handler ########################*/
  private addIncomingMessageHandler(): void {
    this.dataService.connect();
    console.log("Incoming Call Handler");
    this.webSocketService.getMessages().subscribe(msg => {
      console.log("Message is ", msg);
      switch (msg.type) {
        case 'offer':
          this.handleOfferMessage(msg.data);
          break;
        case 'answer':
          console.log("ANSSWWERRR: ", msg.data);
          this.handleAnswerMessage(msg.data);
          break;
        case 'hangup':
          this.handleHangupMessage(msg);
          break;
        case 'ice-candidate':
          this.handleIceCandidateMessage(msg.data);
          break;
        default:
          console.log("Unknown message of type", msg.type);
      }
    },
      error => console.log(error)
    );
  }

  /*####################### Message Handler ########################*/
  handleOfferMessage(msg: RTCSessionDescriptionInit) {
    console.log('handle incoming offer :', msg);
    if (!this.localPeerConnection) {
      this.createPeerConnection();
    }
    if (!this.localStream) {
      this.startVideo();
    }
    this.localPeerConnection.setRemoteDescription(msg)
      .then(() => {
        // add media stream to local video
        this.videoElementRef.nativeElement.srcObject = this.localStream;

        // // add media tracks to remote connection
        // this.localStream.getTracks().forEach(
        //   track => this.localPeerConnection.addTrack(track, this.localStream)
        // );

      }).then(() => {
        // Build SDP for answer message
        return this.localPeerConnection.createAnswer();
      }).then((answer) => {
        // this.localPeerConnection.setRemoteDescription(answer);
        // Set local SDP
        return this.localPeerConnection.setLocalDescription(answer);

      }).then(() => {
        // Send local SDP to remote party
        this.webSocketService.sendMessage({ type: 'answer', data: this.localPeerConnection.localDescription });
        // this.inCall = true;

      }).catch(this.handleGetUserMediaError);
  }

  handleAnswerMessage(msg: RTCSessionDescriptionInit): void {
    this.localPeerConnection.setRemoteDescription(msg);
  }

  handleHangupMessage(msg: Message): void {
    this.closeVideoCall();
  }

  handleIceCandidateMessage(msg: RTCIceCandidate): void {
    const candidate = new RTCIceCandidate(msg);
    this.localPeerConnection.addIceCandidate(candidate).catch(this.reportError);
  }

  hangUp(): void {
    this.webSocketService.sendMessage({ type: 'hangup', data: '' });
    this.closeVideoCall();
  }
    /* ########################  ERROR HANDLER  ################################## */
  private handleGetUserMediaError(e: Error): void {
    switch (e.name) {
      case 'NotFoundError':
        alert('Unable to open your call because no camera and/or microphone were found.');
        break;
      case 'SecurityError':
      case 'PermissionDeniedError':
        // Do nothing; this is the same as the user canceling the call.
        break;
      default:
        console.log(e);
        alert('Error opening your camera and/or microphone: ' + e.message);
        break;
    }

    this.closeVideoCall();
  }

  private reportError = (e: Error) => {
    console.log('got Error: Failed to add Ice Candidate, ' + e.name);
    console.log(e);
  }

  /*##################################### DATA CHANNEL #######################*/
  public getDataChannelService(): void {
    // this.peerConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);
    this.dataChannel = this.localPeerConnection.createDataChannel("dataChannel");
    this.messageBox = this.messageDataChannel.nativeElement;
    this.sendButton = this.sendDataChannel.nativeElement;
    this.dataChannel.onopen = this.handleDataChannelStatusChange;
    this.dataChannel.onclose = this.handleDataChannelStatusChange;

  }

  private receiveDataChannel(event: RTCDataChannelEvent) {
    this.receiveChannel = event.channel;
    this.receiveChannel.onmessage = this.handleReceiveMessage;
  }

  private handleReceiveMessage(event: MessageEvent) {
    console.log("Message Handler", event.returnValue);
    var el = document.createElement("p");
    var txtNode = document.createTextNode(event.data);

    el.appendChild(txtNode);
    this.receiveDataBox.nativeElement.appendChild(el);
  }

  private handleDataChannelStatusChange(): void {
    if (this.dataChannel) {
      let status = this.dataChannel.readyState;
      if (status === "open") {
        this.messageBox.disabled = false;
        this.messageBox.focus();
        this.sendButton.disabled = false;
        this.sendMessage;
      }
      else {
        this.messageBox.disabled = true;
        this.sendButton.disabled = true;
      }
    }
  }

  sendMessage(): void {
    // const message = this.messageBox.value;
    const message = (document.getElementById('message') as HTMLInputElement).value;
    console.log("Message:", message);
    if (this.dataChannel.readyState === "open") {
      this.dataChannel.send(message);
    }
  }


}


