import { World } from "./world.js";
import { Snake } from "./snake.js";

export const CANVAS_WIDTH = 50;
export const CANVAS_HEIGHT = 50;

(function() {
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let world: World;

  document.addEventListener('DOMContentLoaded', () => {

    canvas = document.createElement('canvas');
    context = canvas.getContext('2d') as CanvasRenderingContext2D;
    document.body.appendChild(canvas);

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const webSocket = new WebSocket('ws://192.168.1.146:8765') as WebSocket;
    webSocket.onclose = ev => console.log(ev);

    world = newWorld(webSocket);

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r') {
        world = newWorld(webSocket);
      }

      if (evt.key === 'p') {
        if (world.running) {
          world.stop();
        } else {
          world.begin();
        }
      }
    });
  });

  function newWorld(ws: WebSocket): World {
    world = new World(canvas, context, ws);
    const snake1 = new Snake('0', Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
    const snake2 = new Snake('1', Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
    const snake3 = new Snake('2', Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
    world.addGameObject(snake1);
    world.addGameObject(snake2);
    world.addGameObject(snake3);

    world.begin();
    return world;
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
