export enum GameObjectType {
  'NONE' = 0,
  'FOOD' = 1,
  'SNAKE' = 2,
  'ME' = 3,
};

export type Vector = {
  x: number;
  y: number
}


export interface GameObject {
  type: GameObjectType;
  id: string;
  x: number;
  y: number;
  size: number;
  velocity: Vector;
  dead: boolean;
  updateVelocity?: (velocity: Vector) => void;
  update: () => void;
  draw: (context: CanvasRenderingContext2D) => void;
  collidesWith: (position: Vector) => boolean;
}

export interface WorldDataObject {
  [key: string]: {
    energyLevel: number;
    matrix: number[];
    velocity: Vector;
  }
}
