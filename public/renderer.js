var Renderer = /** @class */ (function () {
    function Renderer(canvas, width, height) {
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this._context = this.canvas.getContext('2d');
    }
    Renderer.prototype.render = function (grid) {
        var _this = this;
        if (this._context) {
            this._context.fillStyle = 'black';
            this._context.clearRect(0, 0, this.width, this.height);
        }
        grid.cells.forEach(function (cell) {
            _this.drawCell(cell);
        });
    };
    Renderer.prototype.drawCell = function (cell) {
        if (this._context) {
            switch (cell.state) {
                case 0:
                    this._context.fillStyle = 'black';
                    break;
                case 1:
                    this._context.fillStyle = 'green';
                    break;
                case 2:
                    this._context.fillStyle = 'white';
                    break;
                case 3:
                    this._context.fillStyle = 'yellow';
                    break;
                case 4:
                    this._context.fillStyle = 'blue';
                    break;
                default:
                    this._context.fillStyle = 'red';
            }
            this._context.fillRect(cell.x * cell.size, cell.y * cell.size, cell.size, cell.size);
        }
    };
    return Renderer;
}());
export { Renderer };
//# sourceMappingURL=renderer.js.map