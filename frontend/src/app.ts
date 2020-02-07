import { Composite, Vector, World as MWorld } from 'matter-js';
import { Config } from './config';
import { InfoOverlay } from './info-overlay';
import { Physics } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { World } from './world';

export class App implements MessageListener {
  private websocket: Websocket;
  private infoOverlay: InfoOverlay;
  private world: World;
  private generationCount = 0;
  private physics: Physics;
  private generationProgress = 0;

  constructor(
    private rootElement: HTMLElement,
    private width: number,
    private height: number,
  ) {
    this.websocket = Websocket.getInstance(() => this.init(), evt => this.onWebsocketClose(evt));
    this.websocket.registerListener(this);

    this.infoOverlay = new InfoOverlay(this.rootElement, () => this.onStartButton(), () => this.onResumeButton());

    const mainElement = document.querySelector('#main') as HTMLElement;
    this.physics = new Physics(mainElement, this.width, this.height);

    this.world = new World(this.physics, this.width, this.height);

    this.infoOverlay.update(this.world.aliveSnakes, this.generationCount, this.generationProgress);
  }

  onWebsocketClose(evt: any): void {
    console.log('[MAIN]: closed connection to server.', evt);
    if (this.world) {
      this.world.stop();
      delete this.world;
    }
  }

  onMessage(message: Message) {
    switch (message.type) {
      case MessageType.START:
        console.log(`[MAIN]: starting generation ${message.data.generation}`);
        this.generationCount = message.data.generation as number;
        this.generationProgress = 0;
        this.start();
        break;
      case MessageType.GENERATION:
        console.log(`[MAIN]: ending generation ${this.generationCount}`);
        this.sendWebsocketMessage(MessageType.GENERATION, this.world.getGenerationData());
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
    this.infoOverlay.update(this.world.aliveSnakes, this.generationCount, this.generationProgress);
  }

  init() {
    // add snakes
    for (let i = 0; i < Config.GENERATION_SNAKE_COUNT; i++) {
      const snakeComposite = this.physics.getRandomSnake();
      MWorld.add(this.physics.world, snakeComposite);
      const snake = new Snake(snakeComposite);
      this.world.addGameObject(snake);
    }
  }

  onStartButton(): void {
      if (this.world) {
        const snakesData = this.world.snakes.map(snake => ({
          id: snake.id,
          color: snake.getColor()[0],
        }));
        this.sendWebsocketMessage(MessageType.START, snakesData);
      } else {
        window.location.reload();
      }
  }

  onResumeButton(): void {
      if (this.world) {
        const snakesData = this.world.snakes.map(snake => ({
          id: snake.id,
          color: snake.getColor()[0],
        }));

        this.sendWebsocketMessage(MessageType.RESUME, snakesData);
      } else {
        window.location.reload();
      }
  }

  start() {
    this.reset();
    this.world.begin();
  }

  reset() {
    console.log('[MAIN]: resetting world');
    this.world.stop();
    this.world.snakes.forEach(snake => {
      snake.reset();

      const randPos = this.physics.getRandomPosition();
      snake.setPosition(randPos);

      const worldSnake = Composite.allBodies(this.physics.world).find(body => snake.containsBody(body));
      if (!worldSnake) {
        MWorld.add(this.physics.world, snake.body);
      }
    });
    this.world.reset();
  }

  private sendWebsocketMessage(type: MessageType, data: any) {
    this.websocket.send({ type, data: { snakes: data } });
  }
}
