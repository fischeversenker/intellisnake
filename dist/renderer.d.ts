import { Grid } from "./grid.js";
export declare class Renderer {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    private _context;
    constructor(canvas: HTMLCanvasElement, width: number, height: number);
    render(grid: Grid): void;
    private drawCell;
}
