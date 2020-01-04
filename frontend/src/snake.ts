import { Food } from "./food.js";
import { GameObject, GameObjectType, Vector } from "./utils.js";

export const SNAKE_LENGTH = 50;

export class Snake implements GameObject {

  type = GameObjectType.SNAKE;
  size = 3;
  velocity: Vector = { x: 1, y: 1 };

  energyLevel = 2500;
  dead: boolean = false;

  tail: any[] = [];

  constructor(
    public id: string,
    public x: number,
    public y: number,
    public canvasWidth: number,
    public canvasHeight: number,
  ) {
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  updateVelocity(newVelocity: Vector): void {
    this.velocity = newVelocity;
  }

  update(): void {
    if (this.energyLevel <= 0) {
      this.dead = true;
    }

    if (this.dead) {
      return;
    }

    this.x += this.velocity.x * 0.3;
    this.y += this.velocity.y * 0.3;

    if (this.x < 0) {
      this.x = this.canvasWidth;
    }
    if (this.x > this.canvasWidth) {
      this.x = 0;
    }
    if (this.y < 0) {
      this.y = this.canvasHeight;
    }
    if (this.y > this.canvasHeight) {
      this.y = 0;
    }

    if (this.tail.length > SNAKE_LENGTH) {
      this.tail.pop();
    }

    this.tail.unshift({ x: this.x, y: this.y });
    this.energyLevel--;
    this.energyLevel -= (1 / 2) * /* mass */ 1 * (this.velocityMagnitude * 1);
  }

  draw(context: CanvasRenderingContext2D): void {
    if (this.dead) {
      return;
    }
    const color = 'green';

    this.tail.forEach((position: any) => {
      this.drawCircle(context, position.x, position.y, color, this.size * 0.5);
    });

    this.drawCircle(context, this.x, this.y, color, this.size);

    context.fillStyle = 'black';
    context.font = '8px Arial';
    context.fillText(`Id: ${this.id}`, this.x + this.size, this.y);
    context.fillText(`E: ${Math.round(this.energyLevel)}`, this.x + this.size, this.y + 8);
  }

  collidesWith(position: Vector): boolean {
    const headShot = Math.abs(this.x - position.x) < this.size && Math.abs(this.y - position.y) < this.size;
    const tailShot = this.tail.some(tailPos => {
      return Math.abs(tailPos.x - position.x) < this.size && Math.abs(tailPos.y - position.y) < this.size;
    });
    return headShot || tailShot;
  }

  eat(food: Food) {
    this.energyLevel += food.value;
    food.dead = true;
  }

  private drawCircle(context: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
    context.beginPath();
    context.fillStyle = color;
    context.arc(x, y, size, 0, 2 * Math.PI);
    context.fill();
  }

  private get velocityMagnitude(): number {
    return Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
  }
}
