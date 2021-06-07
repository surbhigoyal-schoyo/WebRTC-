import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { Subject } from 'rxjs';
import { Message } from 'src/app/video-conference/types/message';
import { WebSocketService } from './web-socket.service';

export const WS_ENDPOINT = environment.wsEndpoint;

@Injectable({
  providedIn: 'root'
})
export class DataService {

  // private socket$!: WebSocketSubject<any>;
  // private messagesSubject = new Subject<Message>();
  // public messages$ = this.messagesSubject.asObservable();

  constructor(private webSocketConnector: WebSocketService) { }

  public connect(): void{
    this.webSocketConnector.listen();
    // if (!this.socket$ || this.socket$.closed){
    //   this.socket$.subscribe(
    //     msg=>{
    //       console.log('Recieved message of type: ' + msg.type);
    //       this.messagesSubject.next(msg);
    //     }
    //   )
    // }
  }

  

  // private getNewWebSocket(): WebSocketSubject<any> {
  //   return webSocket({
  //     url: WS_ENDPOINT,
  //     // withCredentials: false,  
  //     openObserver: {
  //       next:() => {
  //         console.log('[DataService]: connection ok');
  //       }
  //     },
  //     closeObserver:{
  //       next: () =>{
  //         console.log('[DataService] : connection closed');
  //         // this.socket$ = undefined;
  //         this.connect();
  //       }
  //     }
  //   });

  // }
}
