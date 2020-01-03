import { GameObject, Acceleration } from "./life.js";

export const SNAKE_SIZE = 4;
export const SNAKE_LENGTH = 200;

export class Snake implements GameObject {

  size = SNAKE_SIZE;
  acceleration: { x: number, y: number } = { x: 1, y: 1 };

  energyLevel = 2000;
  dead: boolean = false;

  private tail: any[] = [];

  constructor(
    public id: string,
    public x: number,
    public y: number,
    public canvasWidth: number,
    public canvasHeight: number,
  ) {
    this.acceleration.x = (Math.random() - 0.5) * 2;
    this.acceleration.y = (Math.random() - 0.5) * 2;
  }

  updateAcceleration(newAcceleration: Acceleration): void {
    this.acceleration = newAcceleration;
  }

  update(): void {
    if (this.energyLevel <= 0) {
      this.dead = true;
    }

    if (this.dead) {
      return;
    }

    this.x += this.acceleration.x;
    this.y += this.acceleration.y;

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
    this.energyLevel -= this.accelerationMagnitude / 2;
  }

  draw(context: CanvasRenderingContext2D): void {
    const color = this.dead ? 'darkred' : 'green';

    this.tail.forEach((position: any) => {
      context.fillStyle = color;
      context.fillRect(position.x - SNAKE_SIZE / 2, position.y - SNAKE_SIZE / 2, SNAKE_SIZE, SNAKE_SIZE);
    });

    context.fillStyle = color;
    context.fillRect(this.x - SNAKE_SIZE / 2, this.y - SNAKE_SIZE / 2, SNAKE_SIZE, SNAKE_SIZE);

    context.fillStyle = 'black';
    context.fillText(`Energy: ${Math.round(this.energyLevel)}`, this.x + SNAKE_SIZE, this.y);
  }

  private get accelerationMagnitude(): number {
    return Math.sqrt(Math.pow(this.acceleration.x, 2) + Math.pow(this.acceleration.y, 2));
  }
}
