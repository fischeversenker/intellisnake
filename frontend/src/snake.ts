import { Body, Constraint, Vector } from "matter-js";
import { Food } from "./food";
import { GameObject, GameObjectType } from "./utils";

export const SNAKE_LENGTH = 50;

export class Snake implements GameObject {

  type = GameObjectType.SNAKE;

  energyLevel = 1000;
  energyIntake = 0;
  dead: boolean = false;
  createdAt: number;
  diedAt: number = 0;

  constructor(
    public id: number,
    public body: Body,
    public tail: Body[],
    public constraints: Constraint[],
  ) {
    this.createdAt = Date.now();
  }

  updateVelocity(newVelocity: Vector): void {
    const force = Vector.mult(newVelocity, 0.003);
    const oldPosition = Vector.add(this.body.position, Vector.rotate(newVelocity, 180));
    Body.applyForce(this.body, oldPosition, force);
  }

  die() {
    this.dead = true;
    this.diedAt = Date.now();
    this.body.render.visible = false;
  }

  update(): void {
    if (this.dead) {
      return;
    }

    this.energyLevel -= (1 / 2) * /* mass */ 1 * (this.velocityMagnitude * 1);
    this.energyLevel--;
  }

  eat(food: Food) {
    this.energyLevel += food.value;
    this.energyIntake += food.value;
    food.beEaten();
  }

  getLifespan(): string {
    if (this.dead) {
      return String(Math.floor((this.diedAt - this.createdAt) / 1000));
    } else {
      return '...';
    }
  }

  private get velocityMagnitude(): number {
    return Vector.magnitude(this.body.velocity);
  }
}
