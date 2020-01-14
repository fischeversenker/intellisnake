import { App } from './app.js';
import { Renderer } from './renderer.js';

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    const mainElement = document.querySelector('#main') as HTMLElement;

    const app = new App(CANVAS_WIDTH, CANVAS_HEIGHT, mainElement);
    app.init();

    const renderer = new Renderer(mainElement);
    renderer.run();
  });

})();
