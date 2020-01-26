import { Physics, STARTING_BODY_ID } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { GENERATION_SNAKE_COUNT, World } from './world';

export const GENERATION_DURATION_MS = 30 * 1000;

export class App implements MessageListener {
  private debuggerElement: HTMLElement;
  private resetButton: HTMLElement;
  private websocket: Websocket;
  private world: World;
  private generationCount = 0;
  private lastMessage = 0;
  private lastAckData: any;
  private physics: Physics;
  private generationProgress = 0;
  private isInitialGeneration = true;

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

    this.websocket = Websocket.getInstance(() => this.init(), evt => this.onWebsocketClose(evt));
    this.websocket.registerListener(this);

    this.world = new World(this.generationCount, this.physics, this.width, this.height);
  }

  onWebsocketClose(evt: any): void {
    console.log('[MAIN]: closed connection to server.', evt);
    if (this.world) {
      this.world.stop();
      delete this.world;
    }
  }

  onMessage(message: Message) {
    this.lastMessage = Date.now();
    if (message.type === MessageType.GENERATION) {
      console.log('[MAIN]: starting new generation: #', this.generationCount);
      this.generationCount = message.data.generation as number;
      this.newGeneration();
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
    const snakes = this.world.aliveSnakes.map(snake => ({
      id: snake.id,
      color: snake.getColor(),
    }));
    this.websocket.send({ type: MessageType.GENERATION, data: { snakes } });
  }

  newGeneration() {
    if (!this.isInitialGeneration) {
      if (this.world) {
        this.world.destroy();
      }

      this.world = new World(this.generationCount, this.physics, this.width, this.height);
    } else {
      this.isInitialGeneration = false;
    }

    this.world.begin();
  }
}
