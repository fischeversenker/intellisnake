import { App } from './app';

export const CANVAS_WIDTH = Math.min(window.innerWidth, window.innerHeight);
export const CANVAS_HEIGHT = Math.min(window.innerWidth, window.innerHeight);

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    const mainElement = document.querySelector('#main') as HTMLElement;

    const app = new App(mainElement, CANVAS_WIDTH, CANVAS_HEIGHT);
    app.init();
  });

})();
