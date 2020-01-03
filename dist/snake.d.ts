export declare type SnakeAcceleration = {
    x: number;
    y: number;
};
export declare class Snake {
    id: string;
    x: number;
    y: number;
    private tail;
    private acceleration;
    constructor(id: string, x: number, y: number);
    updateAcceleration(data: SnakeAcceleration): void;
    updatePosition(): void;
    draw(context: CanvasRenderingContext2D): void;
}
