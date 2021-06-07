export const environment = {
  production: true,
  wsEndpoint: 'ws://192.168.1.36:3000/',
  RTCPeerConfiguration: {
    iceServers: [
      {
        urls: 'stun:stun1.1.google.com:19302'
      }
    ]
  }
};