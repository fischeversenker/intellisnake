import { Physics, STARTING_BODY_ID } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { GENERATION_SNAKE_COUNT, World } from './world';

export const GENERATION_DURATION_MS = 30 * 1000;

export class App implements MessageListener {
  private debuggerElement: HTMLElement;
  private resetButton: HTMLElement;
  private websocket: Websocket;
  private world: World | null = null;
  private generationCount = 0;
  private lastMessage = 0;
  private lastAckData: any;
  private lastSurvivors: Snake[] = [];
  private physics: Physics;
  private generationProgress = 0;

  constructor(
    private rootElement: HTMLElement,
    private width: number,
    private height: number,
  ) {
    this.debuggerElement = document.createElement('div');
    this.debuggerElement.classList.add('debug');
    this.rootElement.appendChild(this.debuggerElement);

    this.resetButton = document.createElement('button');
    this.resetButton.classList.add('reset-button');
    this.resetButton.innerHTML = 'RESET (WIP)';
    this.resetButton.addEventListener('click', (evt) => {
      // this.reset();
    });
    this.rootElement.appendChild(this.resetButton);

    const mainElement = document.querySelector('#main') as HTMLElement;
    this.physics = new Physics(mainElement, this.width, this.height);

    this.websocket = Websocket.getInstance(evt => this.onWebsocketOpen(evt), evt => this.onWebsocketClose(evt));
    this.websocket.registerListener(this);
  }

  onWebsocketOpen(evt: any): void {
    const snakeIds: string[] = [];
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      snakeIds.push(String(STARTING_BODY_ID + i * 21));
    }
    this.websocket.send({ type: MessageType.GENERATION, data: { snakeIds } });
  }

  onWebsocketClose(evt: any): void {
    console.log('[MAIN]:', evt);
    if (this.world) {
      this.world.stop();
      delete this.world;
    }
  }

  onMessage(message: Message) {
    this.lastMessage = Date.now();
    if (message.type === MessageType.GENERATION) {
      this.generationCount = message.data.generation as number;
      console.log('[APP]: starting generation', this.generationCount);
      this.startNewGeneration();
    } else {
      if (message.data && message.data.progress) {
        this.generationProgress = message.data.progress;
      }
      if (this.world) {
        this.world.onMessage(message);
      }
    }
  }

  init() {
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 's' && !evt.ctrlKey && this.world) {
        this.world.stop();
      }
    });
  }

  startNewGeneration() {
    if (this.world) {
      this.lastSurvivors = this.world.champions;
      this.world.destroy();
    }
    this.world = new World(this.generationCount, this.physics, this.width, this.height);
    this.world.begin();
  }

}
