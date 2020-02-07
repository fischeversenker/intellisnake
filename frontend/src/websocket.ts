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

const PORT = '8765';

export type MessageId = number;

const MAX_DELAY = 2000;

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
    this.nativeWebsocket = new WebSocket(`ws://localhost:${PORT}`) as WebSocket;
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

  getLastMessageDelays(limit: number) {
    if (this.messageDelays.length > limit) {
      this.messageDelays = this.messageDelays.slice(this.messageDelays.length - limit);
    }
    return this.messageDelays;
  }

  getLastMessageSentDelays(limit: number) {
    if (this.sendDelays.length > limit) {
      this.sendDelays = this.sendDelays.slice(this.sendDelays.length - limit);
    }
    return this.sendDelays;
  }

  onMessage(evt: any) {
    this.lastMessageReceived = Date.now();
    const delay = this.lastMessageReceived - this.lastMessageSent;
    if (Math.abs(delay) < MAX_DELAY) {
      this.messageDelays.push(delay);
    }
    this.listeners.forEach(listener => listener.onMessage(JSON.parse(evt.data)));
  }

  send(data: Message): MessageId {
    if (this.nativeWebsocket.readyState === WebSocket.OPEN) {
      this.nativeWebsocket.send(JSON.stringify({
        messageId: this.messageCount,
        ...data,
      }));
      this.lastMessageSent = Date.now();
      const delay = this.lastMessageSent - this.lastMessageReceived;
      if (Math.abs(delay) < MAX_DELAY) {
        this.sendDelays.push(-delay);
      }
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
