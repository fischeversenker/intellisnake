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
  private waitingForNewEpoch = false;

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
    this.onNewEpoch();
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
    if (this.waitingForNewEpoch && message.type === 'ack') {
      this.world = new World(() => this.onNewEpoch(), this.generationCount, this.physics, this.width, this.height);
      this.world.begin();
      this.waitingForNewEpoch = false;
    }
  }

  init() {
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r' && !evt.ctrlKey) {
        this.sendGenerationMessage();
      }
      if (evt.key === 's' && !evt.ctrlKey && this.world) {
        this.world.stop();
      }
    });
  }

  sendGenerationMessage() {
    // TODO: currently we use the first "generation" WS message to send the snake ids to initialize the AI
    // would be nicer to either
    // - get the ids in the initial ack from the AI
    // - lets assume ids in range [0..NUMBER_OF_SNAKES] and instead of the actual ids just send the
    //   number of snakes in the "generation" message
    const snakeIds: string[] = [];
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      snakeIds.push(String(STARTING_BODY_ID + i * 21));
    }
    this.websocket.send({ type: MessageType.GENERATION, data: { snakeIds } });
  }

  drawWorldInfo() {
    if (this.world) {
      let infoItems = [
        `<div>Generation:</div><div>${this.world.generationCount}</div>`,
      ];

      const survivorData = this.lastSurvivors
        ? this.lastSurvivors.map(survivor => `LifeSpan: ${survivor.getLifespan()}s | EnergyIntake: ${survivor.energyIntake}`).join('\n')
        : '';
      infoItems.push(`<div>Last survivors:</div><div>${survivorData}</div>`);

      infoItems.push(
        `<div>Last ack data:</div><div>${this.lastAckData ? Object.keys(this.lastAckData) : 'null'}</div>`,
      );

      if (true /* this.world.running */) {
        infoItems.push(`<div>Snakes alive:</div><div>${this.world.snakes.length}</div>`);
        const maxSnake = this.world.snakes.reduce((acc: any, snake) => {
          if (!acc || snake.energyLevel > acc.energyLevel) {
            return snake;
          } else {
            return acc;
          }
        }, null);

        infoItems.push(
          `<div>Max EL (snake):</div><div>${String(Math.floor(maxSnake && maxSnake.energyLevel ? maxSnake.energyLevel : 0))} (${maxSnake && maxSnake.id ? maxSnake.id : -1})</div>`,
          `<div>Time left:</div><div>${Math.floor((GENERATION_DURATION_MS - (Date.now() - this.world.startTime)) / 1000)}s</div>`,
          `<div>Last message:</div><div>${Math.floor(Date.now() - this.lastMessage)}ms</div>`,
        );
      }
      this.debuggerElement.innerHTML = infoItems.join('');
      requestAnimationFrame(() => this.drawWorldInfo());
    }
  }

  onNewEpoch() {
    if (!this.waitingForNewEpoch) {
      setTimeout(() => {
        this.generationCount++;

        if (this.world) {
          this.lastSurvivors = this.world.champions;
          this.world.destroy();
        }

        this.sendGenerationMessage();
      }, 300);
      this.waitingForNewEpoch = true;
    }
  }
}
