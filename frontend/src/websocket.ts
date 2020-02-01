export enum MessageType {
  'START' = 'start',
  'RESUME' = 'resume',
  'DATA' = 'data',
  'GENERATION' = 'generation',
  'RESTART' = 'restart',
  'ERROR' = 'error',
}

export type Message = {
  messageId?: number;
  type: MessageType;
  data?: any;
}

export type MessageId = number;

export interface MessageListener {
  onMessage: (message: Message) => void;
}

export class Websocket {
  private static instance: Websocket;
  private nativeWebsocket: WebSocket;
  private messageCount = 0;
  private listeners: MessageListener[] = [];

  constructor(
    onOpen: (evt: any) => void = () => {},
    onClose: (evt: any) => void = () => {},
  ) {
    this.nativeWebsocket = new WebSocket('ws://localhost:8765') as WebSocket;
    this.nativeWebsocket.onopen = onOpen;
    this.nativeWebsocket.onclose = onClose;
    this.nativeWebsocket.onmessage = (evt: any) => this.onMessage(evt);
  }

  static getInstance(
    onOpen?: (evt: any) => void,
    onClose?: (evt: any) => void,
  ): Websocket {
    if (!Websocket.instance) {
      Websocket.instance = new Websocket(onOpen, onClose);
    }
    return Websocket.instance;
  }

  onMessage(evt: any) {
    this.listeners.forEach(listener => listener.onMessage(JSON.parse(evt.data)));
  }

  send(data: Message): MessageId {
    if (this.nativeWebsocket.readyState === WebSocket.OPEN) {
      this.nativeWebsocket.send(JSON.stringify({
        ...data,
        messageId: this.messageCount,
      }));
    }

    return this.messageCount++;
  }

  registerListener(listener: MessageListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: MessageListener) {
    this.listeners = this.listeners.filter(otherListener => otherListener !== listener);
  }
}
