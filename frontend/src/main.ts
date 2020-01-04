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
let lastMessage = 0;

(function() {

  document.addEventListener('DOMContentLoaded', () => {

    canvas = document.createElement('canvas');
    context = canvas.getContext('2d') as CanvasRenderingContext2D;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    document.body.appendChild(canvas);

    debuggerElement = document.createElement('div');
    debuggerElement.classList.add('debug');
    document.body.appendChild(debuggerElement);

    drawWorldInfo();

    // webSocket = new WebSocket('ws://192.168.1.146:8765') as WebSocket;
    webSocket = new WebSocket('ws://localhost:8765') as WebSocket;

    webSocket.onopen = () => startNewWorld();
    webSocket.onclose = evt => {
      world.stop(true);
      console.log('[MAIN]:', evt);
    };

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'r' && !evt.ctrlKey) {
        startNewWorld();
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
      lastMessage = Date.now();
      world.onWebSocketMessage(event);
    };

    // make sure this epoch ends after EPOCH_TIME_MS passed
    setTimeout(() => {
      if (world === newWorld) {
        onNewEpoch();
      }
    }, EPOCH_TIME_MS);
  }

  function makeNewWorld(): World {
    return new World(canvas, context, webSocket, () => onNewEpoch(), epochCount);
  }

  function drawWorldInfo() {
    if (world && world.running) {
      const maxSnake = world.snakes.reduce((acc: any, snake) => {
        if (!acc || snake.energyLevel > acc.energyLevel) {
          return snake;
        } else {
          return acc;
        }
      }, null);
      debuggerElement.innerHTML = `
<div>Epoch:</div><div>${world.epochCount}</div>
<div>Snakes:</div><div>${world.snakes.length}</div>
<div>Max EL:</div><div>${String(Math.floor(maxSnake && maxSnake.energyLevel ? maxSnake.energyLevel : 0))} (${maxSnake && maxSnake.id ? maxSnake.id : -1})</div>
<div>Time left:</div><div>${Math.floor((EPOCH_TIME_MS - (Date.now() - world.startTime)) / 1000)}s</div>
<div>Last message:</div><div>${Math.floor(Date.now() - lastMessage)}ms</div>`;

    }

    requestAnimationFrame(() => drawWorldInfo());
  }

  function onNewEpoch() {
    epochCount++;
    setTimeout(() => {
      startNewWorld();
    }, 300);
  }

})();
