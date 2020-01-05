import { Food } from "./food.js";
import { Snake } from "./snake.js";
import { GameObject, GameObjectType } from "./utils.js";

const AI_CALL_FREQUENCY = 10;
const EPOCH_SNAKE_COUNT = 10;
const SNAKE_REPRODUCTION_MIN_EL = 1500;

let foodCount = 0;
let worldCount = 0;
let messageCount = 0;

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

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
    private webSocket: WebSocket,
    private onNewEpoch: Function,
    public epochCount: number = 0,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;

    // add snakes
    for (let i = 0; i < EPOCH_SNAKE_COUNT; i++) {
      this.addSnake();
    }

    // clear canvas
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

    if (worldCount > 1) {
      this.sendWebSocketMessage('epoch', {});
    } else {
      this.sendCurrentSnakeData();
    }
    this.printWaiting();
  }

  begin() {
    if (this.context) {
      this.startTime = Date.now();
      this.running = true;
      requestAnimationFrame(() => this.update());
    }
  }

  stop(broken = false) {
    if (broken) {
      this.broken = true;
    }
    this.running = false;
  }

  destroy() {
    this.stop();
    this.gameObjects = [];
  }

  update() {
    if (this.broken) {
      return this.printBroken();
    }

    if (!this.running) {
      return this.printWaiting();
    }

    if (this.snakes.length === 0) {
      return this.onNewEpoch();
    }

    // clear canvas
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.webSocket.readyState === WebSocket.OPEN && this.pendingWebSocketRequests.length === 0) {
      this.sendCurrentSnakeData();
    }

    this.updateGameObjects();

    if (Math.random() > 0.99) {
      this.addGameObject(new Food(String(foodCount++), Math.abs((Math.random()-0.5)) * this.width, Math.abs((Math.random()-0.5)) * this.height));
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

  onWebSocketMessage(event: any): void {
    const data = JSON.parse(event.data);
    // console.log(`[WORLD]: <<< received data of type ${data.type}`);
    switch (data.type) {
      case 'ack':
        if (!this.running) {
          this.begin();
        }
        break;
      case 'error':
        console.log(`[WORLD]: <<< was error: "${data.data}"`);
        break;
      default:
        for (let destination in data.data) {
          let destinationGameObject = this.gameObjects.find(gO => gO.id === destination);
          if (destinationGameObject && destinationGameObject.updateVelocity) {
            const x = data.data[destinationGameObject.id][0];
            const y = data.data[destinationGameObject.id][1];
            destinationGameObject.updateVelocity({ x, y });
          }
        }
        if (!this.running) {
          this.begin();
        }
        break;
    }
    this.pendingWebSocketRequests = this.pendingWebSocketRequests.filter(reqId => reqId !== data.messageId);
  }

  private sendWebSocketMessage(type: string, data: any): void {
    // console.log(`[WORLD]: >>> sending data of type ${type}`);
    this.webSocket.send(JSON.stringify({
      messageId: messageCount,
      type,
      data,
    }));
    this.pendingWebSocketRequests.push(messageCount++);
  }

  private sendCurrentSnakeData() {
    const wsData: any = this.snakes.reduce((acc, snake) => ({
      ...acc,
      [snake.id]: {
        energyLevel: snake.energyLevel,
        energyIntake: snake.energyIntake,
        matrix: this.toBitMatrix(snake),
        velocityX: snake.velocity.x,
        velocityY: snake.velocity.y,
      }
    }), {});
    this.sendWebSocketMessage('snakes', wsData);
  }

  private addSnake(): Snake {
    const newSnake = new Snake(String(this.snakes.length), Math.random() * this.width, Math.random() * this.height, this.width, this.height);
    this.gameObjects.push(newSnake);
    return newSnake;
  }

  private updateGameObjects() {
    const markedForDeletion: Array<GameObject> = [];

    this.gameObjects.forEach(gO => {
      gO.update();
      gO.draw(this.context);

      // check for collisions if this is a snake
      if (gO.type === GameObjectType.SNAKE) {
        this.gameObjects.filter(otherGO => otherGO !== gO).forEach(otherGO => {
          if (gO.dead || otherGO.dead) { return; }

          if (otherGO.collidesWith(gO)) {
            if (otherGO.type === GameObjectType.FOOD) {
              (gO as Snake).eat(otherGO as Food);
            }
            if (otherGO.type === GameObjectType.SNAKE) {
              gO.dead = true;
            }
          }
        });

        // check if reproduces
        if ((gO as Snake).energyLevel > SNAKE_REPRODUCTION_MIN_EL) {
          const newSnake = this.addSnake();
          this.sendWebSocketMessage('reproduce', { parentId: gO.id, childId: newSnake.id });
          newSnake.energyLevel = Math.floor((gO as Snake).energyLevel / 2);
          (gO as Snake).energyLevel = Math.floor((gO as Snake).energyLevel / 2);
        }
      }

      if (gO.dead) {
        markedForDeletion.push(gO);
      }
    });

    this.gameObjects = this.gameObjects.filter(gO => !(markedForDeletion.includes(gO)));
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
