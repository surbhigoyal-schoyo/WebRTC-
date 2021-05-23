import { AfterViewInit, ElementRef } from '@angular/core';
import { ViewChild } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';
import { DataService } from './service/data.service';
import { Message } from './types/message';

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
  @ViewChild('video') videoElementRef!: ElementRef;
  @ViewChild('messageBox') messageDataChannel!: ElementRef;
  @ViewChild('sendButton') sendDataChannel!: ElementRef;
  @ViewChild('receiveBox') receiveDataBox!: ElementRef;

  mediaRecorder: any;
  recordedBlobs!: Blob[];
  isRecording: boolean = false
  isVideo: boolean = false
  downloadUrl!: string;
  private localStream!: MediaStream;
  options: any;
  public sendChannel = null;
  dataChannel!: RTCDataChannel;
  receiveChannel!: RTCDataChannel;
  messageBox: any;
  sendButton: any;
  peers: [] = [];

  private peerConnection!: RTCPeerConnection;
  private remoteConnection!: RTCPeerConnection;
  inCall: boolean = false;
  
  constructor(private dataService: DataService) {
    
   }

  ngAfterViewInit(): void {
    this.addIncomingMessageHandler();
    this.getMediaDevices();
  }

 
  private async getMediaDevices() : Promise<void> {
    
    await navigator.mediaDevices.getUserMedia({
      video: {
        width: 360
      },
      audio : true
    }).then(stream => {
      this.localStream = stream;
      this.stopVideo();
    })
  }

  startVideo(){
    this.localStream.getTracks().forEach( track => {
      track.enabled = true;
    })
    this.videoElementRef.nativeElement.srcObject = this.localStream;
    this.isVideo = !this.isVideo;
  }

  stopVideo(){
    this.localStream.getTracks().forEach( track => {
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
      track=> this.peerConnection.addTrack(track, this.localStream));

    try{
      const offer: RTCSessionDescriptionInit = await this.peerConnection.createOffer(offerOptions);
      await this.peerConnection.setLocalDescription(offer);

      this.dataService.sendMessage({type:'offer',  data:offer});
    }catch(err){
      this.handleGetUserMediaError(err);
    }
  }

  private closeVideoCall() : void{
    if(this.peerConnection){
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.ontrack = null;
    }

    this.peerConnection.getTransceivers().forEach(transceiver => {
      transceiver.stop();
    });

    this.peerConnection.close();
    // this.peerConnection = null;
  }
   
  private createPeerConnection() {
    console.log('creating PeerConnection...');
    this.peerConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);

    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.peerConnection.onsignalingstatechange = this.handleSignalingStateChangeEvent;
    this.peerConnection.ontrack = this.handleTrackEvent;
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
    console.log('got Error: ' + e.name);
    console.log(e);
  }


  /*############################### EVENT Handler ###############################*/
  
  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    console.log("ICECandidateEvent handler", event);
    if (event.candidate) {
      this.dataService.sendMessage({
        type: 'ice-candidate',
        data: event.candidate
      });
    }
  }

  private handleICEConnectionStateChangeEvent = (event: Event) => {
    console.log("ICEConnectionStateChangeEvent handler", event);
    switch (this.peerConnection.iceConnectionState) {
      case 'closed':
      case 'failed':
      case 'disconnected':
        this.closeVideoCall();
        break;
    }
  }

  private handleSignalingStateChangeEvent = (event: Event) => {
    console.log("SignalingStateChangeEvent handler", event);
    switch (this.peerConnection.signalingState) {
      case 'closed':
        this.closeVideoCall();
        break;
    }
  }

  private handleTrackEvent = (event: RTCTrackEvent) => {
    console.log(event);
    this.recordVideoElementRef.nativeElement.srcObject = event.streams[0];
  }

  /*####################### Incoming Call Handler ########################*/
  private addIncomingMessageHandler(): void {
    this.dataService.connect();

    this.dataService.messages$.subscribe(msg => {
        switch(msg.type){
          case 'offer':
            this.handleOfferMessage(msg.data);
            break;
          case 'answer':
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
    console.log('handle incoming offer');
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (!this.localStream) {
      this.startVideo();
    }

    this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg))
      .then(() => {

        // add media stream to local video
        this.videoElementRef.nativeElement.srcObject = this.localStream;

        // add media tracks to remote connection
        this.localStream.getTracks().forEach(
          track => this.peerConnection.addTrack(track, this.localStream)
        );

      }).then(() => {

      // Build SDP for answer message
      return this.peerConnection.createAnswer();

    }).then((answer) => {

      // Set local SDP
      return this.peerConnection.setLocalDescription(answer);

    }).then(() => {

      // Send local SDP to remote party
      this.dataService.sendMessage({type: 'answer', data: this.peerConnection.localDescription});

      this.inCall = true;

    }).catch(this.handleGetUserMediaError);
  }

  handleAnswerMessage(msg: RTCSessionDescriptionInit): void {
    console.log('handle incoming answer');
    this.peerConnection.setRemoteDescription(msg);
  }

  handleHangupMessage(msg: Message): void {
    this.closeVideoCall();
  }

  handleIceCandidateMessage(msg: RTCIceCandidate): void {
    const candidate = new RTCIceCandidate(msg);
    this.peerConnection.addIceCandidate(candidate).catch(this.reportError);
  }

  hangUp(): void{
    this.dataService.sendMessage({type:'hangup', data:''});
    this.closeVideoCall();
  }

  /*##################################### DATA CHANNEL #######################*/
  public getDataChannelService(): void{
    // this.peerConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);
    console.log("Inside getDataChannels");
    this.dataChannel = this.peerConnection.createDataChannel("dataChannel");
    console.log("Inside getDataChannels2222");
    this.messageBox = this.messageDataChannel.nativeElement;
    this.sendButton = this.sendDataChannel.nativeElement;
    this.dataChannel.onopen = this.handleDataChannelStatusChange;
    console.log("After ReadyState");
    this.dataChannel.onclose = this.handleDataChannelStatusChange;

    this.remoteConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);
    this.remoteConnection.ondatachannel = this.receiveDataChannel;
  }

  private receiveDataChannel(event: RTCDataChannelEvent){
    this.receiveChannel = event.channel;
    this.receiveChannel.onmessage = this.handleReceiveMessage;
  }

  private handleReceiveMessage(event: MessageEvent) {
    var el = document.createElement("p");
    var txtNode = document.createTextNode(event.data);
    
    el.appendChild(txtNode);
    this.receiveDataBox.nativeElement.appendChild(el);
  }

  private handleDataChannelStatusChange(): void{
    if(this.dataChannel){
      let status = this.dataChannel.readyState;
      if(status==="open"){
        this.messageBox.disabled= false;
        this.messageBox.focus();
        this.sendButton.disabled = false;
        this.sendMessage;
      }
      else{
        this.messageBox.disabled= true;
        this.sendButton.disabled = true;
      }
    }
  }

  sendMessage(): void{
    // const message = this.messageBox.value;
    const message = (document.getElementById('message') as HTMLInputElement).value;
    console.log("Message:", message);
    if(this.dataChannel.readyState === "open"){
      this.dataChannel.send(message);
    }
  }


}


