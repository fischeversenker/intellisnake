import { Grid } from "./grid.js";
import { Snake } from "./snake.js";
var grid = new Grid(6, 2, [
    { state: 0, size: 20, x: 0, y: 0 },
    { state: 2, size: 20, x: 1, y: 0 },
    { state: 0, size: 20, x: 2, y: 0 },
    { state: 2, size: 20, x: 3, y: 0 },
    { state: 0, size: 20, x: 4, y: 0 },
    { state: 2, size: 20, x: 5, y: 0 },
    { state: 0, size: 20, x: 0, y: 1 },
    { state: 2, size: 20, x: 1, y: 1 },
    { state: 0, size: 20, x: 2, y: 1 },
    { state: 2, size: 20, x: 3, y: 1 },
    { state: 0, size: 20, x: 4, y: 1 },
    { state: 2, size: 20, x: 5, y: 1 },
]);
console.log(grid.asMatrix());
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // const mainElement = document.querySelector('#main') as HTMLElement;
        var canvas = document.createElement('canvas');
        document.documentElement.appendChild(canvas);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var context = canvas.getContext('2d');
        if (context) {
            var snake1 = new Snake('0', 100, 100);
            snake1.draw(context);
        }
        // const renderer = new Renderer(canvas, 60, 60);
        // renderer.render(grid);
    });
})();
//# sourceMappingURL=main.js.map