import { Body, Vector, World as MWorld, Composite } from 'matter-js';
import { Physics } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { GENERATION_SNAKE_COUNT, World } from './world';

export const GENERATION_DURATION_MS = 30 * 1000;

export class App implements MessageListener {
  private debuggerElement: HTMLElement;
  private resetButton: HTMLElement;
  private websocket: Websocket;
  private world: World;
  private generationCount = 0;
  private lastMessage = 0;
  private physics: Physics;
  private generationProgress = 0;

  constructor(
    private rootElement: HTMLElement,
    private width: number,
    private height: number,
  ) {
    this.debuggerElement = document.createElement('div');
    this.debuggerElement.classList.add('debug');
    this.rootElement.appendChild(this.debuggerElement);

    this.resetButton = document.createElement('button');
    this.resetButton.classList.add('reset-button');
    this.resetButton.innerHTML = 'RESET (WIP)';
    this.resetButton.addEventListener('click', (evt) => {
      // this.reset();
    });
    this.rootElement.appendChild(this.resetButton);

    const mainElement = document.querySelector('#main') as HTMLElement;
    this.physics = new Physics(mainElement, this.width, this.height);

    this.websocket = Websocket.getInstance(() => this.init(), evt => this.onWebsocketClose(evt));
    this.websocket.registerListener(this);

    this.world = new World(this.physics, this.width, this.height);
  }

  onWebsocketClose(evt: any): void {
    console.log('[MAIN]: closed connection to server.', evt);
    if (this.world) {
      this.world.stop();
      delete this.world;
    }
  }

  onMessage(message: Message) {
    this.lastMessage = Date.now();
    switch (message.type) {
      case MessageType.START:
        console.log('[MAIN]: starting world');
        this.start();
        break;
      case MessageType.GENERATION:
        console.log(`[MAIN]: ending generation #${this.generationCount}`);
        this.generationCount = message.data.generation as number;
        this.websocket.send({ type: MessageType.GENERATION, data: this.world.getGenerationData() });
        break;
      case MessageType.ERROR:
        console.log(`[MAIN]: <<< received error: "${message.data}"`);
        this.world.stop();
        break;
      case MessageType.DATA:
        if (message.data && message.data.progress) {
          this.generationProgress = message.data.progress;
        }

        // tell world that we received a message with a given id
        this.world.ackMessage(Number(message.messageId));

        if (!message.data.prediction) {
          break;
        }
        for (let destination in message.data.prediction) {
          let snake = this.world.snakes.find(gO => Number(gO.id) === Number(destination));
          if (snake) {
            const x = message.data.prediction[snake.id][0];
            const y = message.data.prediction[snake.id][1];
            snake.setVelocity(Vector.create(x, y));
          }
        }
        break;
      default:
        console.log(`[WORLD]: I don't know how to handle messages of type ${message.type}. Message was: ${message.data}`);
    }
  }

  init() {
    // add snakes
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      const snakeComposite = this.physics.getRandomSnake();
      MWorld.add(this.physics.engine.world, snakeComposite);
      const snake = new Snake(snakeComposite);
      this.world.addGameObject(snake);
    }

    const snakesData = this.world.snakes.map(snake => ({
      id: snake.id,
      color: snake.getColor(),
    }));

    this.websocket.send({ type: MessageType.START, data: { snakes: snakesData } });
  }

  reset() {
    console.log('[MAIN]: resetting world');
    this.world.stop();
    this.world.snakes.forEach(snake => {
      snake.reset();

      const randPos = this.physics.getRandomPosition();
      snake.body.bodies.forEach(body => {
        Body.setPosition(body, randPos);
      });

      const worldSnake = this.physics.engine.world.bodies.find(body => body.id === snake.body.id);
      if (!worldSnake) {
        MWorld.add(this.physics.engine.world, snake.body);
      }
    });
    this.world.reset();
  }

  start() {
    this.reset();
    this.world.begin();
  }
}
