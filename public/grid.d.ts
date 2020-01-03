/**
 * 0 = none
 * 1 = food
 * 2 = me
 * 3 = obstacle
 * 4 = other_snake
 */
export declare type CellState = 0 | 1 | 2 | 3 | 4;
export declare type Cell = {
    state: CellState;
    size: number;
    x: number;
    y: number;
};
export declare class Grid {
    width: number;
    height: number;
    cells: Cell[];
    constructor(width: number, height: number, cells: Cell[]);
    getRow(index: number): Cell[];
    asMatrix(): Cell[][];
}
