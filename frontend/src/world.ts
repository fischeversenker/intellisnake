import { Food } from "./food.js";
import { Snake } from "./snake.js";
import { GameObject, GameObjectType } from "./utils.js";
import { EPOCH_TIME_MS } from "./main.js";

const AI_CALL_FREQUENCY = 50;
const DEBUG_FREQUENCY = 7;

let foodCount = 0;
let worldCount = 0;
let messageCount = 0;

export class World {

  running: boolean = false;
  width: number;
  height: number;

  public id = worldCount++;
  private pendingWebSocketRequests: number[] = [];
  private gameObjects: GameObject[] = [];
  private tickCount = 0;
  private appearance = Date.now();

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
    private webSocket: WebSocket,
    private debug: HTMLDivElement,
    private onFinish: Function,
    private epochCount: number = 0,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();
    this.addSnake();

    if (worldCount > 1) {
      this.sendWebSocketMessage('epoch', {});
    }
  }

  begin() {
    if (this.context) {
      this.running = true;
      requestAnimationFrame(() => this.update());
    }
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
    this.gameObjects = [];
  }

  update() {
    if (!this.running) {
      return;
    }

    if (this.snakes.length === 0) {
      return this.onFinish();
    }

    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

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
        if ((gO as Snake).energyLevel > 4000) {
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

    if (Math.random() > 0.96) {
      this.addGameObject(new Food(String(foodCount++), Math.random() * this.width, Math.random() * this.height));
    }

    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.webSocket.readyState === WebSocket.OPEN && this.pendingWebSocketRequests.length === 0) {
      const wsData: any = this.snakes.reduce((acc, gO) => ({
        ...acc,
        [gO.id]: {
          energyLevel: (gO as Snake).energyLevel,
          matrix: this.toBitMatrix(gO),
          velocityX: gO.velocity.x,
          velocityY: gO.velocity.y,
        }
      }), {});
      this.sendWebSocketMessage('snakes', wsData);
    }

    if (this.tickCount % DEBUG_FREQUENCY === 0) {
      const maxSnake = this.gameObjects.reduce((acc: any, gO) => {
        if (!acc || (gO as Snake).energyLevel > acc.energyLevel) {
          return gO;
        } else {
          return acc;
        }
      }, null);
      this.debug.innerHTML = `
<div>Epoch:</div><div>${this.epochCount}</div>
<div>Snakes:</div><div>${this.snakes.length}</div>
<div>Max EL:</div><div>${String(Math.floor(maxSnake.energyLevel))} (${maxSnake.id})</div>
<div>Time left:</div><div>${Math.floor((EPOCH_TIME_MS - (Date.now() - this.appearance)) / 1000)}s</div>`;
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

  sendWebSocketMessage(type: string, data: any): void {
    console.log(`[WORLD]: >>> sending data of type ${type}`);
    this.webSocket.send(JSON.stringify({
      messageId: messageCount,
      type,
      data,
    }));
    this.pendingWebSocketRequests.push(messageCount++);
  }

  onWebSocketMessage(event: any): void {
    const data = JSON.parse(event.data);
    console.log(`[WORLD]: <<< received data of type ${data.type}`);
    switch (data.type) {
      case 'ack':
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
        break;
    }
    this.pendingWebSocketRequests = this.pendingWebSocketRequests.filter(reqId => reqId !== data.messageId);
  }

  private addSnake(): Snake {
    const newSnake = new Snake(String(this.snakes.length), Math.random() * this.width, Math.random() * this.height, this.width, this.height);
    this.gameObjects.push(newSnake);
    return newSnake;
  }
}
