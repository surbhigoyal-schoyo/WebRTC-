import { Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';
import io from "socket.io-client";
import { Subject } from 'rxjs';
import { Message } from '../types/message';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  socket: any;
  roomId: any;
  Users: string[] = [];
  readonly uri: string = "ws://192.168.1.36:3000";
  private messagesSubject = new Subject<Message>();
  public messages$ = this.messagesSubject.asObservable();

  constructor() {
    this.socket = io(this.uri);
  }

  listen(): void {
    if (!this.socket || this.socket.closed) {
      this.socket.on("connect", (data: any) => {
        this.Users.push(this.socket.id);
        this.Users.forEach(user => {
          console.log("Users are: ", user);
        });
        console.log(this.socket.connected);
        this.emit("salutations", "Hello!");
    
        // this.socket.subscribe(
        //   (            // Called whenever there is a message from the server
        //     msg: Message) => {
        //       console.log('Received message of type: ' + msg.type);
        //       this.messagesSubject.next(msg);
        //     });

        // // handle the event sent with socket.send()
        // this.socket.on("message", (data: any) => {
        //   console.log(data);
        // });

        // // handle the event sent with socket.emit()
        // this.socket.on("user-connected", (data: any) => {
        //   console.log(" UserConnected : :", data);
        // });

        // this.socket.on("user-disconnected", (data: any) => {
        //   console.log(data);
        // });

        // this.socket.on("informAboutNewConnection", (data: any) => {
        //   console.log(data);
        // });
      });
    }
  }

  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }

  emitRoom(eventName: string, data1: any) {
    this.socket.emit(eventName, data1, this.socket.id);
  }

  getMessages(): Observable<any> {
    let observable = new Observable(observer => {
      this.socket.on("message", (data: Message) => {
        observer.next(data);
        console.log(" Got Message: ", data);
      });
      // return () => {
      //   this.socket.disconnect();
      // }
      this.socket.on("userconnected", (data: any) => {
        observer.next(data);
        console.log(data);
      });

      this.socket.on("informAboutNewConnection", (data: any) => {
        console.log("NewConnection", data);
      });

      this.socket.on("informAboutConnectionEnd", (data: any) => {
        let msg: Message = {
          type: "hangup",
          data: data
        }
        observer.next(msg);
        console.log("user disconnected from server: ");
      })
    });
    return observable;
  }

  sendMessage(msg: Message): void {
    console.log('sending message: ' + msg.type);
    this.emit("message", msg);
  }

  joinRoom(eventName: string, data1: any) {
    this.emitRoom(eventName, data1);
  }

}


