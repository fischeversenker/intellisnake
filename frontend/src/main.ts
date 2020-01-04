import { World } from "./world.js";

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;
export const EPOCH_TIME_MS = 30 * 1000;

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

    webSocket.onopen = () => startNewWorld();
    webSocket.onclose = evt => {
      world.stop();
      console.log('[MAIN]:', evt);
    };

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
