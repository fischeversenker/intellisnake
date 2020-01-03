import { GameObject, Acceleration } from "./life.js";

const MAX_FOOD_AGE = 20 * 1000;

export class Food implements GameObject {

  size = 4;
  acceleration: Acceleration = { x: 0, y: 0 };
  dead = false;
  appearance: number = 0;

  constructor(
    public id: string,
    public x: number,
    public y: number,
  ) { }

  updateAcceleration(acceleration: Acceleration): void { }

  update(): void {
    if (this.dead) {
      return;
    }

    if (this.appearance && Date.now() - this.appearance > MAX_FOOD_AGE) {
      this.dead = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    if (this.dead) {
      return;
    }

    if (!this.appearance) {
      this.appearance = Date.now();
    }
    context.fillStyle = 'red';
    context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}
