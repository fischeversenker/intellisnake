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
  private lastMessageReceived = 0;
  private lastMessageSent = 0;
  private messageDelays: number[] = [];
  private sendDelays: number[] = [];

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

  getLastMessageDelays(limit = 50) {
    return this.messageDelays.slice(this.messageDelays.length - limit);
  }

  getLastMessageSentDelays(limit = 50) {
    return this.sendDelays.slice(this.sendDelays.length - limit);
  }

  onMessage(evt: any) {
    this.lastMessageReceived = Date.now();
    this.messageDelays.push(this.lastMessageReceived - this.lastMessageSent);
    this.listeners.forEach(listener => listener.onMessage(JSON.parse(evt.data)));
  }

  send(data: Message): MessageId {
    if (this.nativeWebsocket.readyState === WebSocket.OPEN) {
      this.nativeWebsocket.send(JSON.stringify({
        messageId: this.messageCount,
        ...data,
      }));
      this.lastMessageSent = Date.now();
      this.sendDelays.push(-1 * (this.lastMessageSent - this.lastMessageReceived));
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
