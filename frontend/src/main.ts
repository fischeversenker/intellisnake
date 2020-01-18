import { App } from './app';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    const mainElement = document.querySelector('#main') as HTMLElement;

    const app = new App(mainElement, CANVAS_WIDTH, CANVAS_HEIGHT);
    app.init();
  });

})();
