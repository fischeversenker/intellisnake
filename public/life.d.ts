export interface GameObject {
    id: string;
    x: number;
    y: number;
    size: number;
    acceleration: Acceleration;
    dead: boolean;
    updateAcceleration?: (acceleration: Acceleration) => void;
    update: () => void;
    draw: (context: CanvasRenderingContext2D) => void;
}
export declare type Acceleration = {
    x: number;
    y: number;
};
export declare class Life {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    private running;
    width: number;
    height: number;
    private gameObjects;
    constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D);
    begin(): void;
    update(): void;
    addGameObject(gameObject: GameObject): void;
    toBitMatrix(): number[];
}
