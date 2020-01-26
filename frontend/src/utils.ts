import { Body, Composite, Vector } from "matter-js";

export enum GameObjectType {
  'NONE' = 0,
  'FOOD' = 1,
  'SNAKE' = 2,
  'SNAKE_TAIL' = 3,
  'ME' = 4,
};

export interface GameObject {
  type: GameObjectType;
  id: number;
  body: Composite | Body;
  dead: boolean;
  setVelocity?: (velocity: Vector) => void;
}

export interface WorldDataObject {
  [key: string]: {
    energyLevel: number;
    matrix: number[];
    velocity: Vector;
  }
}
