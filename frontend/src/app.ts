import { Physics } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, Websocket } from './websocket';
import { World } from './world';

export const GENERATION_DURATION_MS = 3 * 1000;

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
    this.startNewWorld();
  }

  onWebsocketClose(evt: any): void {
    console.log('[MAIN]:', evt);
    if (this.world) {
      this.world.stop();
    }
  }

  onMessage(message: Message) {
    this.lastMessage = Date.now();
    if (message.type === 'ack' && message.data) {
      this.lastAckData = message.data;
    }
  }

  init() {
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r' && !evt.ctrlKey) {
        this.startNewWorld();
      }
      if (evt.key === 's' && !evt.ctrlKey && this.world) {
        this.world.stop();
      }
    });
  }

  startNewWorld() {
    if (this.world) {
      this.world.destroy();
    }

    this.world = new World(() => this.onNewEpoch(), this.generationCount, this.physics, this.width, this.height);
    this.waitingForNewEpoch = false;
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
        this.lastSurvivors = this.world!.champions;
        this.startNewWorld();
      }, 300);
      this.waitingForNewEpoch = true;
    }
  }
}
