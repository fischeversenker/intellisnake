var MAX_FOOD_AGE = 20 * 1000;
var Food = /** @class */ (function () {
    function Food(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = 4;
        this.acceleration = { x: 0, y: 0 };
        this.dead = false;
        this.appearance = 0;
    }
    Food.prototype.updateAcceleration = function (acceleration) { };
    Food.prototype.update = function () {
        if (this.dead) {
            return;
        }
        if (this.appearance && Date.now() - this.appearance > MAX_FOOD_AGE) {
            this.dead = true;
        }
    };
    Food.prototype.draw = function (context) {
        if (this.dead) {
            return;
        }
        if (!this.appearance) {
            this.appearance = Date.now();
        }
        context.fillStyle = 'red';
        context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    };
    return Food;
}());
export { Food };
//# sourceMappingURL=food.js.map