import { Body, Composite, Vector } from "matter-js";

export enum GameObjectType {
  'NONE' = 'none',
  'FOOD' = 'food',
  'SNAKE' = 'snake',
  'SNAKE_TAIL' = 'snake_tail',
  'ME' = 'me',
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
