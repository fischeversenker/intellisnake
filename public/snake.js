export var SNAKE_SIZE = 4;
export var SNAKE_LENGTH = 200;
var Snake = /** @class */ (function () {
    function Snake(id, x, y, canvasWidth, canvasHeight) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.size = SNAKE_SIZE;
        this.acceleration = { x: 1, y: 1 };
        this.energyLevel = 2000;
        this.dead = false;
        this.tail = [];
        this.acceleration.x = (Math.random() - 0.5) * 2;
        this.acceleration.y = (Math.random() - 0.5) * 2;
    }
    Snake.prototype.updateAcceleration = function (newAcceleration) {
        this.acceleration = newAcceleration;
    };
    Snake.prototype.update = function () {
        if (this.energyLevel <= 0) {
            this.dead = true;
        }
        if (this.dead) {
            return;
        }
        this.x += this.acceleration.x;
        this.y += this.acceleration.y;
        if (this.x < 0) {
            this.x = this.canvasWidth;
        }
        if (this.x > this.canvasWidth) {
            this.x = 0;
        }
        if (this.y < 0) {
            this.y = this.canvasHeight;
        }
        if (this.y > this.canvasHeight) {
            this.y = 0;
        }
        if (this.tail.length > SNAKE_LENGTH) {
            this.tail.pop();
        }
        this.tail.unshift({ x: this.x, y: this.y });
        this.energyLevel--;
        this.energyLevel -= this.accelerationMagnitude / 2;
    };
    Snake.prototype.draw = function (context) {
        var color = this.dead ? 'darkred' : 'green';
        this.tail.forEach(function (position) {
            context.fillStyle = color;
            context.fillRect(position.x - SNAKE_SIZE / 2, position.y - SNAKE_SIZE / 2, SNAKE_SIZE, SNAKE_SIZE);
        });
        context.fillStyle = color;
        context.fillRect(this.x - SNAKE_SIZE / 2, this.y - SNAKE_SIZE / 2, SNAKE_SIZE, SNAKE_SIZE);
        context.fillStyle = 'black';
        context.fillText("Energy: " + Math.round(this.energyLevel), this.x + SNAKE_SIZE, this.y);
    };
    Object.defineProperty(Snake.prototype, "accelerationMagnitude", {
        get: function () {
            return Math.sqrt(Math.pow(this.acceleration.x, 2) + Math.pow(this.acceleration.y, 2));
        },
        enumerable: true,
        configurable: true
    });
    return Snake;
}());
export { Snake };
//# sourceMappingURL=snake.js.map