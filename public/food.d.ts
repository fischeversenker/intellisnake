import { GameObject, Acceleration } from "./life.js";
export declare class Food implements GameObject {
    id: string;
    x: number;
    y: number;
    size: number;
    acceleration: Acceleration;
    dead: boolean;
    appearance: number;
    constructor(id: string, x: number, y: number);
    updateAcceleration(acceleration: Acceleration): void;
    update(): void;
    draw(context: CanvasRenderingContext2D): void;
}
