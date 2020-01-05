import { App } from './app.js';

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    const app = new App(CANVAS_WIDTH, CANVAS_HEIGHT);
    app.init();
  });

})();
