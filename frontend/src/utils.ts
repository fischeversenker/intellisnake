import { Body, Vector } from "matter-js";

export enum GameObjectType {
  'NONE' = 0,
  'FOOD' = 1,
  'SNAKE' = 2,
  'ME' = 3,
};

export interface GameObject {
  type: GameObjectType;
  id: number;
  body: Body;
  dead: boolean;
  updateVelocity?: (velocity: Vector) => void;
}

export interface WorldDataObject {
  [key: string]: {
    energyLevel: number;
    matrix: number[];
    velocity: Vector;
  }
}
