import { Composite, Vector, World as MWorld } from 'matter-js';
import { Config } from './config';
import { Physics } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { World } from './world';

export class App implements MessageListener {
  private debuggerElement: HTMLElement;
  private controlsElement: HTMLElement;
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

    this.controlsElement = document.createElement('div');
    this.controlsElement.classList.add('controls');
    this.rootElement.appendChild(this.controlsElement);

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
        console.log(`[MAIN]: starting generation ${message.data.generation}`);
        this.generationCount = message.data.generation as number;
        this.generationProgress = 0;
        this.start();
        break;
      case MessageType.GENERATION:
        console.log(`[MAIN]: ending generation ${this.generationCount}`);
        this.websocket.send({ type: MessageType.GENERATION, data: { snakes: this.world.getGenerationData() } });
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
    this.drawDebugInfo();
  }

  init() {
    // add snakes
    for (let i = 0; i < Config.GENERATION_SNAKE_COUNT; i++) {
      const snakeComposite = this.physics.getRandomSnake();
      MWorld.add(this.physics.world, snakeComposite);
      const snake = new Snake(snakeComposite);
      this.world.addGameObject(snake);
    }

    document.body.addEventListener('keypress', (evt) => {
      if (evt.key === 'i') {
        this.debuggerElement.classList.toggle('hidden');
        this.controlsElement.classList.toggle('transparent');
      }
    });

    const startButtonElement = document.createElement('button');
    startButtonElement.innerHTML = 'START';
    this.controlsElement.appendChild(startButtonElement);
    startButtonElement.addEventListener('click', () => {
      const snakesData = this.world.snakes.map(snake => ({
        id: snake.id,
        color: snake.getColor(),
      }));
      this.websocket.send({ type: MessageType.START, data: { snakes: snakesData } });
    });

    const resumeButtonElement = document.createElement('button');
    resumeButtonElement.innerHTML = 'RESUME';
    this.controlsElement.appendChild(resumeButtonElement);
    resumeButtonElement.addEventListener('click', () => {

      const snakesData = this.world.snakes.map(snake => ({
        id: snake.id,
        color: snake.getColor(),
      }));

      this.websocket.send({ type: MessageType.RESUME, data: { snakes: snakesData } });
    });
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

  private drawDebugInfo() {
    const snakeRows = this.world.aliveSnakes
      .sort((a, b) => b.energyLevel - a.energyLevel)
      .map(snake => `<tr><td style='background-color: rgb(${snake.getColor().join(',')})'></td><td>${Math.floor(snake.energyIntake)}</td><td>${Math.floor(snake.energyLevel)}</td></tr>`)
      .join('');

    this.debuggerElement.innerHTML = `
      <div class='generation-info'>
        <table>
          <tr>
            <th>Generation:</td><td>${this.generationCount}</td>
          </tr>
          <tr>
            <th>Alive snakes:</td><td>${this.world.aliveSnakes.length}</td>
          </tr>
          <tr>
            <th>Progress:</td>
            <td>
              <div class="progress-bar">
                <span class="bar">
                  <span class="progress" style="--progress:${Math.floor(this.generationProgress * 100)}%;"></span>
                </span>
              </div>
            </td>
          </tr>
        </table>
        <small>(you can toggle this overlay by pressing the i key)</small>
      </div>
      <div class='snakes'>
        <table>
          <tr>
            <th>Color</th><th>EI</th><th>EL</th>
          </tr>
          ${snakeRows}
        </table>
      </div>
      `;
  }
}
