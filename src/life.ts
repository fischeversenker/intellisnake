import { Food } from "./food.js";

export interface GameObject {
  id: string;
  x: number;
  y: number;
  size: number;
  acceleration: Acceleration;
  dead: boolean;
  updateAcceleration?: (acceleration: Acceleration) => void;
  update: () => void;
  draw: (context: CanvasRenderingContext2D) => void;
}

export type Acceleration = {
  x: number;
  y: number
}

let foodCount = 0;

export class Life {

  private running: boolean = false;
  width: number;
  height: number;

  private gameObjects: GameObject[] = [];

  constructor(
    public canvas: HTMLCanvasElement,
    public context: CanvasRenderingContext2D,
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

  update() {
    if (this.running) {
      this.context.clearRect(0, 0, this.width, this.height);

      this.gameObjects.forEach(gO => {
        gO.update();
        gO.draw(this.context);
      });
    }

    if (Math.random() > 0.97) {
      this.addGameObject(new Food(String(foodCount++), Math.random() * this.width, Math.random() * this.height));
    }

    requestAnimationFrame(() => this.update());
  }

  addGameObject(gameObject: GameObject) {
    this.gameObjects.push(gameObject);
  }

  toBitMatrix(): number[] {
    const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const result = [];
    for (let i = 0; i + 3 <= imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      if (!a) {
        result.push(0);
      }
      if (r > g && r > b) {
        result.push(1);
      }
      if (g > r && g > b) {
        result.push(2);
      }
      if (b > r && b > g) {
        result.push(3);
      }
    }
    return result;
  }
}
