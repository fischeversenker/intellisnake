import { GameObject, Acceleration } from "./life.js";
export declare const SNAKE_SIZE = 4;
export declare const SNAKE_LENGTH = 200;
export declare class Snake implements GameObject {
    id: string;
    x: number;
    y: number;
    canvasWidth: number;
    canvasHeight: number;
    size: number;
    acceleration: {
        x: number;
        y: number;
    };
    energyLevel: number;
    dead: boolean;
    private tail;
    constructor(id: string, x: number, y: number, canvasWidth: number, canvasHeight: number);
    updateAcceleration(newAcceleration: Acceleration): void;
    update(): void;
    draw(context: CanvasRenderingContext2D): void;
    private get accelerationMagnitude();
}
