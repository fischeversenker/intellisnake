import { Body, Constraint, Vector, Composite } from "matter-js";
import { Food } from "./food";
import { GameObject, GameObjectType } from "./utils";

export const SNAKE_LENGTH = 50;
export const SNAKE_ENERGY_LEVEL_INITIAL = 1000;

export class Snake implements GameObject {

  type = GameObjectType.SNAKE;

  energyLevel = SNAKE_ENERGY_LEVEL_INITIAL;
  energyIntake = 0;
  dead: boolean = false;
  id: number;
  body: Composite;
  head: Body;

  constructor(
    composite: Composite,
  ) {
    this.id = composite.id,
    this.body = composite;
    this.head = composite.bodies[0];
  }

  setVelocity(newVelocity: Vector): void {
    // const force = Vector.mult(newVelocity, 0.02);
    // const oldPosition = Vector.add(this.head.position, Vector.rotate(newVelocity, 180));
    // Body.applyForce(this.head, oldPosition, force);
    Body.setVelocity(this.head, Vector.mult(newVelocity, 6));
  }

  containsBody(body: Body) {
    return this.body.id === body.id || this.head.id === body.id;
  }

  setPosition(position: Vector) {
    Body.setPosition(this.head, position)
  }

  update(): void {
    if (this.energyLevel <= 0) {
      this.dead = true;
    }

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

  reset(): void {
    this.energyIntake = 0;
    this.energyLevel = SNAKE_ENERGY_LEVEL_INITIAL;
    this.dead = false;
  }

  getColor(): number[] {
    const colorRegex = /(?<r>\d{1,3}), (?<g>\d{1,3}), (?<b>\d{1,3})/;
    const colors = ((this.head.render.fillStyle || '').match(colorRegex) || [])['groups'] as any;
    const color = [Number(colors['r']), Number(colors['g']), Number(colors['b'])];
    return color;
  }

  private get velocityMagnitude(): number {
    return Vector.magnitude(this.head.velocity);
  }
}
