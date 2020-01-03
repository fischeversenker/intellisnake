import { Food } from "./food.js";
import { Snake } from "./snake.js";

export enum GameObjectType {
  'NONE' = 0,
  'FOOD' = 1,
  'SNAKE' = 2,
  'ME' = 3,
};

export interface GameObject {
  type: GameObjectType;
  id: string;
  x: number;
  y: number;
  size: number;
  velocity: Vector;
  dead: boolean;
  updateVelocity?: (velocity: Vector) => void;
  update: () => void;
  draw: (context: CanvasRenderingContext2D) => void;
  collidesWith: (position: Vector) => boolean;
}

export interface WorldDataObject {
  [key: string]: {
    energyLevel: number;
    matrix: number[];
    velocity: Vector;
  }
}

export type Vector = {
  x: number;
  y: number
}

let foodCount = 0;

const AI_CALL_FREQUENCY = 50;
const DEBUG_FREQUENCY = 10;

export class World {

  running: boolean = false;
  width: number;
  height: number;
  private webSocketAnswerPending = false;
  private webSocketStartingPhase = true;

  private gameObjects: GameObject[] = [];
  private tickCount = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
    private webSocket: WebSocket,
    private debug: HTMLPreElement,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
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

  update() {
    if (!this.running) {
      return;
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
      }

      if (gO.dead) {
        markedForDeletion.push(gO);
      }
    });

    this.gameObjects = this.gameObjects.filter(gO => !(markedForDeletion.includes(gO)));

    if (Math.random() > 0.97) {
      this.addGameObject(new Food(String(foodCount++), Math.random() * this.width, Math.random() * this.height));
    }

    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.webSocket.readyState === WebSocket.OPEN && !this.webSocketAnswerPending) {
      const wsData: any = this.gameObjects.filter(gO => gO.type === GameObjectType.SNAKE).reduce((acc, gO) => ({
        ...acc,
        [gO.id]: {
          energyLevel: (gO as Snake).energyLevel,
          matrix: this.toBitMatrix(gO),
          velocityX: gO.velocity.x,
          velocityY: gO.velocity.y,
        }
      }), {});
      this.webSocket.send(JSON.stringify(wsData));
      this.webSocketAnswerPending = true;
    }

    if (this.tickCount % DEBUG_FREQUENCY === 0) {
      this.debug.innerHTML = JSON.stringify(this.gameObjects.length, null, 2);
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

  onWebSocketMessage(event: any) {
    const data = JSON.parse(event.data);
    console.log(`[WORLD]: received data from websocket:`, data);
    for (let destination in data) {
      let destinationGameObject = this.gameObjects.find(gO => gO.id === destination);
      if (destinationGameObject && destinationGameObject.updateVelocity) {
        const x = data[destinationGameObject.id][0];
        const y = data[destinationGameObject.id][1];
        destinationGameObject.updateVelocity({ x, y });
      }
    }
    this.webSocketAnswerPending = false;
  }
}
