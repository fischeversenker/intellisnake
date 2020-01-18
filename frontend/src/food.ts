import { GameObject, GameObjectType } from "./utils";
import { Body, Vector } from "matter-js";

const MAX_FOOD_AGE = 30 * 1000;

export class Food implements GameObject {

  type = GameObjectType.FOOD;
  size = 3;
  velocity: Vector = { x: 0, y: 0 };
  dead = false;
  appearance: number = 0;
  value = 500;

  constructor(
    public id: number,
    public body: Body,
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

  beEaten() {
    this.dead = true;
  }
}
