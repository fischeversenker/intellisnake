import { World } from './world.js';
import { Snake } from './snake.js';

export const EPOCH_TIME_MS = 30 * 1000;

export class App {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private debuggerElement: HTMLElement;
  private webSocket: WebSocket;
  private world: World | null = null;
  private epochCount = 0;
  private lastMessage = 0;
  private lastAckData: any;
  private lastSurvivors: Snake[] = [];

  constructor(
    private width: number,
    private height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    document.body.appendChild(this.canvas);

    this.debuggerElement = document.createElement('div');
    this.debuggerElement.classList.add('debug');
    document.body.appendChild(this.debuggerElement);

    this.webSocket = new WebSocket('ws://localhost:8765') as WebSocket;
    // this.webSocket = new WebSocket('ws://192.168.1.146:8765') as WebSocket;
  }

  init() {

    this.webSocket.onopen = () => this.startNewWorld();
    this.webSocket.onclose = evt => {
      this.world!.stop(true);
      console.log('[MAIN]:', evt);
    };

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r' && !evt.ctrlKey) {
        this.startNewWorld();
      }
    });
  }

  startNewWorld() {
    if (this.world) {
      this.world.destroy();
    }

    const newWorld = new World(this.canvas, this.context, this.webSocket, () => this.onNewEpoch(), this.epochCount);
    this.world = newWorld;

    this.webSocket.onmessage = (event: MessageEvent) => {
      this.lastMessage = Date.now();
      const data = JSON.parse(event.data);
      if (data.type === 'ack' && data.data) {
        this.lastAckData = data.data;
      }
      this.world!.onWebSocketMessage(event);
    };

    // TODO: seems buggy. Needs investigation
    // make sure this epoch ends after EPOCH_TIME_MS passed
    setTimeout(() => {
      if (this.world === newWorld) {
        this.onNewEpoch();
      }
    }, EPOCH_TIME_MS);
    this.drawWorldInfo();

  }

  drawWorldInfo() {
    if (this.world && this.world.running) {
      const maxSnake = this.world.snakes.reduce((acc: any, snake) => {
        if (!acc || snake.energyLevel > acc.energyLevel) {
          return snake;
        } else {
          return acc;
        }
      }, null);
      const survivorData = this.lastSurvivors
        ? this.lastSurvivors.map(survivor => `LifeSpan: ${survivor.getLifespan()}s | EnergyIntake: ${survivor.energyIntake}`).join('\n')
        : '';
      this.debuggerElement.innerHTML = `
<div>Epoch:</div><div>${this.world.epochCount}</div>
<div>Snakes:</div><div>${this.world.snakes.length}</div>
<div>Max EL:</div><div>${String(Math.floor(maxSnake && maxSnake.energyLevel ? maxSnake.energyLevel : 0))} (${maxSnake && maxSnake.id ? maxSnake.id : -1})</div>
<div>Time left:</div><div>${Math.floor((EPOCH_TIME_MS - (Date.now() - this.world.startTime)) / 1000)}s</div>
<div>Last message:</div><div>${Math.floor(Date.now() - this.lastMessage)}ms</div>
<div>Last ack data:</div><div>${this.lastAckData ? Object.keys(this.lastAckData) : 'null'}</div>
<div>Last survivors:</div><div>${survivorData}</div>
`;

    }

    requestAnimationFrame(() => this.drawWorldInfo());
  }

  onNewEpoch() {
    this.epochCount++;
    setTimeout(() => {
      this.lastSurvivors = this.world!.champions;
      this.startNewWorld();
    }, 300);
  }
}
