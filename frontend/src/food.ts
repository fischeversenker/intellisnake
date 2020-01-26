import { Composite, Vector, Body } from "matter-js";
import { GameObject, GameObjectType } from "./utils";

const MAX_FOOD_AGE = 30 * 1000;

export class Food implements GameObject {

  type = GameObjectType.FOOD;
  size = 3;
  velocity: Vector = { x: 0, y: 0 };
  dead = false;
  appearance: number = 0;

  constructor(
    public id: number,
    public body: Body,
    public value: number = 500,
  ) { }

  setVelocity(velocity: Vector): void { }

  update(): void {
    if (this.dead) {
      return;
    }

    if (this.appearance && Date.now() - this.appearance > MAX_FOOD_AGE) {
      this.dead = true;
    }
  }

  beEaten() {
    this.dead = true;
  }
}
