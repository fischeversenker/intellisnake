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

export class World {

  private running: boolean = false;
  width: number;
  height: number;

  private gameObjects: GameObject[] = [];
  private tickCount = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
    private webSocket: WebSocket,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;

    webSocket.onmessage = (evt: any) => this.onWebSocketMessage(evt);
  }

  begin() {
    if (this.context) {
      this.running = true;
      requestAnimationFrame(() => this.update());
    }
  }

  update() {
    if (this.running) {
      this.context.fillStyle = 'white';
      this.context.fillRect(0, 0, this.width, this.height);

      this.gameObjects.forEach(gO => {
        gO.update();
        gO.draw(this.context);

        // check for collisions if this is a snake
        if (gO.type === GameObjectType.SNAKE) {
          this.gameObjects.filter(otherGO => otherGO !== gO).forEach(otherGO => {
            if (gO.dead || otherGO.dead) { return; }

            if (otherGO.collidesWith(gO)) {
              if (otherGO.type === GameObjectType.FOOD) {
                // if other is food
                otherGO.dead = true;
                // gO.grow();
              }
              if (otherGO.type === GameObjectType.SNAKE) {
                // if other is snake
                gO.dead = true;
              }
            }
          });
        }
      });
    }

    if (Math.random() > 0.97) {
      this.addGameObject(new Food(String(foodCount++), Math.random() * this.width, Math.random() * this.height));
    }

    if (this.tickCount % 20 === 0 && this.webSocket.readyState === WebSocket.OPEN) {
      const wsData: any = this.gameObjects.filter(gO => gO.type === 2).reduce((acc, gO) => ({
        ...acc,
        [gO.id]: {
          energyLevel: (gO as Snake).energyLevel,
          matrix: this.toBitMatrix(gO),
          velocityX: gO.velocity.x,
          velocityY: gO.velocity.y,
        }
      }), {});
      this.webSocket.send(JSON.stringify(wsData));
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

  private onWebSocketMessage(event: any) {
    console.log(`[WORLD]: received data from websocket:`, event.data);
    const data = JSON.parse(event.data);
    let destinationGameObject = this.gameObjects.find(gO => gO.id === '0');
    if (destinationGameObject && destinationGameObject.updateVelocity) {
      const x = data['a'][0];
      const y = data['a'][1];
      destinationGameObject.updateVelocity({ x, y });
    }
  }
}
