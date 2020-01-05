import { GameObject, GameObjectType, Vector } from "./utils.js";

const MAX_FOOD_AGE = 30 * 1000;

export class Food implements GameObject {

  type = GameObjectType.FOOD;
  size = 3;
  velocity: Vector = { x: 0, y: 0 };
  dead = false;
  appearance: number = 0;
  value = 500;

  constructor(
    public id: string,
    public x: number,
    public y: number,
  ) { }

  updateVelocity(velocity: Vector): void { }

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
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    context.fill();
  }

  collidesWith(position: Vector): boolean {
    return Math.abs(this.x - position.x) < this.size && Math.abs(this.y - position.y) < this.size;
  }
}
