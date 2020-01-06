import { Food } from "./food.js";
import { Snake } from "./snake.js";
import { GameObject, GameObjectType } from "./utils.js";
import { GENERATION_DURATION_MS } from "./app.js";

const AI_CALL_FREQUENCY = 10;
const GENERATION_SNAKE_COUNT = 10;

let foodCount = 0;
let worldCount = 0;
let messageCount = 0;

export enum MessageType {
  'ACK' = 'ack',
  'DATA' = 'data',
  'GENERATION' = 'generation',
  'ERROR' = 'error',
}

export type Message = {
  messageId: number;
  type: MessageType;
  data?: any;
}

export class World {

  running: boolean = false;
  width: number;
  height: number;

  id = worldCount++;
  startTime: number = 0;

  private pendingWebSocketRequests: number[] = [];
  private gameObjects: GameObject[] = [];
  private tickCount = 0;
  private broken = false;
  private generationEndsTimeout = -1;

  champions: Snake[] = [];

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
    private webSocket: WebSocket,
    private onNewEpoch: Function,
    public generationCount: number = 0,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;

    // add snakes
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      this.addSnake();
    }

    // clear canvas
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

    this.sendWebSocketMessage(MessageType.GENERATION, { snakeIds: this.snakes.map(snake => snake.id) });
    this.printWaiting();
  }

  begin() {
    if (this.context) {
      this.startTime = Date.now();
      this.running = true;
      requestAnimationFrame(() => this.update());

      // make sure this generation ends after EPOCH_TIME_MS passed
      this.generationEndsTimeout = setTimeout(() => {
        console.log('[WORLD]: started new generation because time ran out');
        this.onNewEpoch();
      }, GENERATION_DURATION_MS);
    }
  }

  stop(broken = false) {
    if (broken) {
      this.broken = true;
    }
    this.running = false;
    clearTimeout(this.generationEndsTimeout);
  }

  destroy() {
    this.stop();
    this.gameObjects = [];
    clearTimeout(this.generationEndsTimeout);
  }

  update() {
    if (this.broken) {
      return this.printBroken();
    }

    if (!this.running) {
      return this.printWaiting();
    }

    if (this.snakes.length === 0) {
      console.log('[WORLD]: starting new generation because there are no snakes left');
      return this.onNewEpoch();
    }

    // clear canvas
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

    // send "snakes" message?
    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.webSocket.readyState === WebSocket.OPEN && this.pendingWebSocketRequests.length === 0) {
      if (this.snakes.length > 0) {
        this.sendWebSocketMessage(MessageType.DATA, this.currentSnakesData());
      }
    }

    this.updateGameObjects();

    if (Math.random() > 0.99) {
      this.addGameObject(new Food(String(foodCount++), this.sampleNormalDistribution() * this.width, this.sampleNormalDistribution() * this.height));
    }

    this.tickCount++;
    requestAnimationFrame(() => this.update());
  }

  addGameObject(gameObject: GameObject) {
    this.gameObjects.push(gameObject);
  }

  toBitMatrix(gamObject: GameObject): number[] {
    const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const result = [];
    for (let i = 0; i + 3 <= imageData.data.length; i += 4) {
      const x = (i / 4) % this.width;
      const y = Math.floor((i / 4) / this.width);
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      if (r > g && r > b) {
        result.push(GameObjectType.FOOD);
      } else if (g > r && g > b) {
        if (gamObject.collidesWith({ x, y })) {
          result.push(GameObjectType.ME);
        } else {
          result.push(gamObject.type);
        }
      } else {
        result.push(GameObjectType.NONE);
      }
    }
    return result;
  }

  get snakes(): Snake[] {
    return this.gameObjects.filter(gO => gO.type === GameObjectType.SNAKE) as Snake[];
  }

  get nonSnakes(): GameObject[] {
    return this.gameObjects.filter(gO => gO.type !== GameObjectType.SNAKE);
  }

  onWebSocketMessage(event: any): void {
    const data = JSON.parse(event.data) as Message;
    switch (data.type) {
      case MessageType.ACK:
        if (!this.running) {
          this.begin();
        }
        break;
      case MessageType.ERROR:
        console.log(`[WORLD]: <<< received error: "${data.data}"`);
        break;
      case MessageType.DATA:
        for (let destination in data.data) {
          let destinationGameObject = this.gameObjects.find(gO => gO.id === destination);
          if (destinationGameObject && destinationGameObject.updateVelocity) {
            const x = data.data[destinationGameObject.id][0];
            const y = data.data[destinationGameObject.id][1];
            destinationGameObject.updateVelocity({ x, y });
          }
        }
        break
      default:
        console.log(`[WORLD]: I don't know how to handle messages of type ${data.type}. Message was: ${data.data}`);
    }
    this.pendingWebSocketRequests = this.pendingWebSocketRequests.filter(reqId => reqId !== data.messageId);
  }
  
  private sampleNormalDistribution(): number {
      const u = Math.random(), v = Math.random();
      let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
      num = num / 10.0 + 0.5; // Translate to 0 -> 1
      if (num > 1 || num < 0) return this.sampleNormalDistribution(); // resample between 0 and 1
      return num;
  }
  private sendWebSocketMessage(type: MessageType, data: any): void {
    this.webSocket.send(JSON.stringify({
      messageId: messageCount,
      type,
      data,
    }));
    this.pendingWebSocketRequests.push(messageCount++);
  }

  private currentSnakesData(): any {
    return this.snakes.reduce((acc, snake) => ({
      ...acc,
      [snake.id]: {
        energyLevel: snake.energyLevel,
        energyIntake: snake.energyIntake,
        matrix: this.toBitMatrix(snake),
        velocityX: snake.velocity.x,
        velocityY: snake.velocity.y,
      }
    }), {});
  }

  private addSnake(): Snake {
    const newSnake = new Snake(String(this.snakes.length), Math.random() * this.width, Math.random() * this.height, this.width, this.height);
    this.gameObjects.push(newSnake);
    return newSnake;
  }

  private updateGameObjects() {
    this.nonSnakes.forEach(nonSnake => {
      nonSnake.update();
      nonSnake.draw(this.context);
    });

    this.snakes.forEach(snake => {
      let moves = true;
      this.nonSnakes.forEach(nonSnake => {
        if (snake.collidesWith(nonSnake)) {
          snake.eat(nonSnake as Food);
        }
      });

      this.snakes.filter(otherSnake => otherSnake !== snake).forEach(otherSnake => {
        if (snake.nextStepCollidesWith(otherSnake) && otherSnake.isMoving) {
          moves = false;
        }
      });

      snake.update(moves);
      snake.draw(this.context);
    });

    this.gameObjects = this.gameObjects.filter(gO => !gO.dead);
    if (this.snakes.length > 0) {
      this.champions = [...this.snakes];
    }
  }

  private printBroken() {
    this.context.textAlign = 'center';
    this.context.globalAlpha = 0.5;
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);
    this.context.globalAlpha = 1;
    this.context.fillStyle = 'black';
    this.context.fillText('BROKEN :(', this.width / 2, this.height / 2);
  }

  private printWaiting() {
    this.context.textAlign = 'center';
    this.context.globalAlpha = 0.5;
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);
    this.context.globalAlpha = 1;
    this.context.fillStyle = 'black';
    this.context.fillText('WAITING...', this.width / 2, this.height / 2);
  }
}
