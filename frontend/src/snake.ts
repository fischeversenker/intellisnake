import { Body, Composite, Vector } from "matter-js";
import { Config } from "./config";
import { Food } from "./food";
import { GameObject, GameObjectType } from "./utils";

export class Snake implements GameObject {

  type = GameObjectType.SNAKE;

  energyLevel = Config.SNAKE_ENERGY_LEVEL_INITIAL;
  energyIntake = 0;
  dead: boolean = false;
  id: number;
  body: Composite;
  head: Body;

  constructor(
    composite: Composite,
  ) {
    this.body = composite;
    this.head = composite.bodies[composite.bodies.length - 1];
    this.id = this.head.id;
  }

  setVelocity(newVelocity: Vector): void {
    const force = Vector.mult(newVelocity, 0.001);
    const oldPosition = Vector.add(this.head.position, Vector.rotate(newVelocity, 180));
    Body.applyForce(this.head, oldPosition, force);
  }

  /**
   * returns whether this snake contains a given body
   * @param body Matter.Body
   * @returns boolean
   */
  containsBody(body: Body) {
    return this.body.id === body.id || this.head.id === body.id;
  }

  setPosition(destination: Vector) {
    const distance = Vector.sub(destination, this.head.position);
    Composite.translate(this.body, distance);
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
    this.energyLevel = Config.SNAKE_ENERGY_LEVEL_INITIAL;
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
