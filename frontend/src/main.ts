import { World } from "./world.js";
import { Snake } from "./snake.js";

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;
export const EPOCH_TIME_MS = 90 * 1000;

let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;
let world: World;
let debuggerElement: HTMLDivElement;
let webSocket: WebSocket;
let epochCount = 0;

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    canvas = document.createElement('canvas');
    context = canvas.getContext('2d') as CanvasRenderingContext2D;
    document.body.appendChild(canvas);

    debuggerElement = document.createElement('div');
    debuggerElement.classList.add('debug');
    document.body.appendChild(debuggerElement);

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // webSocket = new WebSocket('ws://192.168.1.146:8765') as WebSocket;
    webSocket = new WebSocket('ws://localhost:8765') as WebSocket;

    webSocket.onopen = () => {
      webSocket.send(JSON.stringify({ messageId: -1, type: 'start', data: {} }));
      webSocket.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ack' && !world) {
          startNewWorld();
        }
      };
    }
    webSocket.onclose = evt => console.log('[MAIN]:', evt);

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r' && !evt.ctrlKey) {
        startNewWorld();
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

  function startNewWorld() {
    if (world) {
      world.destroy();
    }

    const newWorld = makeNewWorld();
    world = newWorld;
    world.begin();

    webSocket.onmessage = (event: MessageEvent) => {
      world.onWebSocketMessage(event);
    };

    // make sure this epoch ends after EPOCH_TIME_MS passed
    setTimeout(() => {
      if (world === newWorld) {
        onFinish();
      }
    }, EPOCH_TIME_MS);
  }

  function makeNewWorld(): World {
    return new World(canvas, context, webSocket, debuggerElement, () => onFinish(), epochCount);
  }

  function onFinish() {
    epochCount++;
    setTimeout(() => {
      startNewWorld();
    }, 300);
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
