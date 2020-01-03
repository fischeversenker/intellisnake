import { GameObject, Vector, GameObjectType } from "./world.js";

export const SNAKE_LENGTH = 40;

export class Snake implements GameObject {

  type = GameObjectType.SNAKE;
  size = 3;
  velocity: { x: number, y: number } = { x: 1, y: 1 };

  energyLevel = 1000;
  dead: boolean = false;

  tail: any[] = [];

  constructor(
    public id: string,
    public x: number,
    public y: number,
    public canvasWidth: number,
    public canvasHeight: number,
  ) {
    this.velocity.x = (Math.random() - 0.5);
    this.velocity.y = (Math.random() - 0.5);
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

    this.x += this.velocity.x;
    this.y += this.velocity.y;

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
    this.energyLevel -= this.velocityMagnitude / 2;
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
    context.fillText(`Energy: ${Math.round(this.energyLevel)}`, this.x + this.size, this.y);
  }

  collidesWith(position: Vector): boolean {
    const headShot = Math.abs(this.x - position.x) < this.size && Math.abs(this.y - position.y) < this.size;
    const tailShot = this.tail.some(tailPos => {
      return Math.abs(tailPos.x - position.x) < this.size && Math.abs(tailPos.y - position.y) < this.size;
    });
    return headShot || tailShot;
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
