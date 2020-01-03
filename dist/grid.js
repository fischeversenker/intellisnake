var Grid = /** @class */ (function () {
    function Grid(width, height, cells) {
        this.width = width;
        this.height = height;
        this.cells = cells;
    }
    Grid.prototype.getRow = function (index) {
        return this.cells.slice(index, this.width);
    };
    Grid.prototype.asMatrix = function () {
        var result = [];
        for (var h = 0; h < this.height; h++) {
            result.push(this.getRow(h));
        }
        return result;
    };
    return Grid;
}());
export { Grid };
//# sourceMappingURL=grid.js.map