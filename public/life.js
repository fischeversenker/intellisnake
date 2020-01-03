import { Food } from "./food.js";
var foodCount = 0;
var Life = /** @class */ (function () {
    function Life(canvas, context) {
        this.canvas = canvas;
        this.context = context;
        this.running = false;
        this.gameObjects = [];
        this.width = canvas.width;
        this.height = canvas.height;
    }
    Life.prototype.begin = function () {
        var _this = this;
        if (this.context) {
            this.running = true;
            requestAnimationFrame(function () { return _this.update(); });
        }
    };
    Life.prototype.update = function () {
        var _this = this;
        if (this.running) {
            this.context.clearRect(0, 0, this.width, this.height);
            this.gameObjects.forEach(function (gO) {
                gO.update();
                gO.draw(_this.context);
            });
        }
        if (Math.random() > 0.97) {
            this.addGameObject(new Food(String(foodCount++), Math.random() * this.width, Math.random() * this.height));
        }
        requestAnimationFrame(function () { return _this.update(); });
    };
    Life.prototype.addGameObject = function (gameObject) {
        this.gameObjects.push(gameObject);
    };
    Life.prototype.toBitMatrix = function () {
        var imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        var result = [];
        for (var i = 0; i + 3 <= imageData.data.length; i += 4) {
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            var a = imageData.data[i + 3];
            if (!a) {
                result.push(0);
            }
            if (r > g && r > b) {
                result.push(1);
            }
            if (g > r && g > b) {
                result.push(2);
            }
            if (b > r && b > g) {
                result.push(3);
            }
        }
        return result;
    };
    return Life;
}());
export { Life };
//# sourceMappingURL=life.js.map