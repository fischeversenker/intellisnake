import { Life } from "./life.js";
import { Snake } from "./snake.js";

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 400;

(function() {
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let life: Life;

  document.addEventListener('DOMContentLoaded', () => {

    canvas = document.createElement('canvas');
    context = canvas.getContext('2d') as CanvasRenderingContext2D;
    document.body.appendChild(canvas);

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    newLife();

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r') {
        newLife();
      }
    })

    // SOCKET
    const webSocket = new WebSocket('ws://192.168.1.139:8765') as WebSocket;
    webSocket.onopen = (open: any) => {
      webSocket.send(JSON.stringify(life.toBitMatrix()));

      webSocket.onmessage = (event: any) => {
        console.log('event from websocket client', event.data);
      };
    };
  });

  function newLife() {
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    life = new Life(canvas, context);
    const snake1 = new Snake('0', Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
    life.addGameObject(snake1);

    life.begin();
  }

})();

/**
 * Current status:
 *
 * we get a connection to the websocket server and send - as a test - the initial bitMatrix as JSON to the PY server.
 * Succesfully
 *
 * Next steps:
 * - figure out data schema to send bitmap and snake ids (maybe replace pixels for specific snake with the snakes id)
 *  -- --> one BitMatrix per Snake -> only one snake in the matrix has the distinct ME-color so this is the one that the ID refers to
 * - send snake data on every animationFrame
 * - update snakes' acceleration based on ws messages
 */
