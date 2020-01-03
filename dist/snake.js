var Snake = /** @class */ (function () {
    function Snake(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.tail = [];
        this.acceleration = { x: 0, y: 0 };
        this.acceleration.x = Math.random() - 0.5;
        this.acceleration.y = Math.random() - 0.5;
    }
    Snake.prototype.updateAcceleration = function (data) {
        this.acceleration = data;
    };
    Snake.prototype.updatePosition = function () {
        this.x += this.acceleration.x;
        this.y += this.acceleration.y;
    };
    Snake.prototype.draw = function (context) {
        context.fillStyle = 'green';
        context.fillRect(this.x - 10, this.y - 10, 20, 20);
        this.tail.forEach(function (position) {
            console.log({ position: position });
        });
    };
    return Snake;
}());
export { Snake };
//# sourceMappingURL=snake.js.map