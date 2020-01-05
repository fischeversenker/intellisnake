import { World } from './world.js';
import { Snake } from './snake.js';

export const GENERATION_DURATION_MS = 30 * 1000;

export class App {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private debuggerElement: HTMLElement;
  private webSocket: WebSocket;
  private world: World | null = null;
  private generationCount = 0;
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

    const newWorld = new World(this.canvas, this.context, this.webSocket, () => this.onNewEpoch(), this.generationCount);
    this.world = newWorld;

    this.webSocket.onmessage = (event: MessageEvent) => {
      this.lastMessage = Date.now();
      const data = JSON.parse(event.data);
      if (data.type === 'ack' && data.data) {
        this.lastAckData = data.data;
      }
      this.world!.onWebSocketMessage(event);
    };

    requestAnimationFrame(() => this.drawWorldInfo());
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

      if (this.world.running) {
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
    setTimeout(() => {
      this.generationCount++;
      this.lastSurvivors = this.world!.champions;
      this.startNewWorld();
    }, 300);
  }
}
