import Chart from 'chart.js';
import { Composite, Vector, World as MWorld } from 'matter-js';
import { Config } from './config';
import { Physics } from './physics';
import { Snake } from './snake';
import { Message, MessageListener, MessageType, Websocket } from './websocket';
import { World } from './world';

export class App implements MessageListener {
  private debuggerElement: HTMLElement;
  private generationInfoElement: HTMLElement;
  private snakeListElement: HTMLElement;
  private graphsElement: HTMLElement;
  private graphsContext: CanvasRenderingContext2D;
  private controlsElement: HTMLElement;
  private websocket: Websocket;
  private world: World;
  private generationCount = 0;
  private physics: Physics;
  private generationProgress = 0;
  private infoVisible = true;

  constructor(
    private rootElement: HTMLElement,
    private width: number,
    private height: number,
  ) {
    this.debuggerElement = document.createElement('div');
    this.debuggerElement.classList.add('debug', 'focused');
    this.rootElement.appendChild(this.debuggerElement);

    this.debuggerElement.addEventListener('click', () => {
      this.debuggerElement.classList.toggle('focused');
    });

    this.generationInfoElement = document.createElement('div');
    this.generationInfoElement.classList.add('generation-info');
    this.debuggerElement.appendChild(this.generationInfoElement);

    this.graphsElement = document.createElement('div');
    this.graphsElement.classList.add('graphs');
    this.debuggerElement.appendChild(this.graphsElement);

    const graphsHeadline = document.createElement('h4');
    graphsHeadline.innerHTML = 'Communication delays';
    this.graphsElement.appendChild(graphsHeadline);

    const graphsCanvas = document.createElement('canvas');
    this.graphsElement.appendChild(graphsCanvas);
    this.graphsContext = graphsCanvas.getContext('2d')!;

    this.snakeListElement = document.createElement('div');
    this.snakeListElement.classList.add('snakes');
    this.debuggerElement.appendChild(this.snakeListElement);

    this.controlsElement = document.createElement('div');
    this.controlsElement.classList.add('controls');
    this.rootElement.appendChild(this.controlsElement);

    const mainElement = document.querySelector('#main') as HTMLElement;
    this.physics = new Physics(mainElement, this.width, this.height);

    this.websocket = Websocket.getInstance(() => this.init(), evt => this.onWebsocketClose(evt));
    this.websocket.registerListener(this);

    this.world = new World(this.physics, this.width, this.height);

    this.drawDebugInfo();
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
        this.infoVisible = !this.infoVisible;
        this.debuggerElement.classList.toggle('hidden');
        this.controlsElement.classList.toggle('hidden');
      }
    });

    const startButtonElement = document.createElement('button');
    startButtonElement.innerHTML = 'START';
    this.controlsElement.appendChild(startButtonElement);
    startButtonElement.addEventListener('click', () => {
      if (this.world) {
        const snakesData = this.world.snakes.map(snake => ({
          id: snake.id,
          color: snake.getColor(),
        }));
        this.sendWebsocketMessage(MessageType.START, snakesData);
      } else {
        window.location.reload();
      }
    });

    const resumeButtonElement = document.createElement('button');
    resumeButtonElement.innerHTML = 'RESUME';
    this.controlsElement.appendChild(resumeButtonElement);
    resumeButtonElement.addEventListener('click', () => {
      if (this.world) {
        const snakesData = this.world.snakes.map(snake => ({
          id: snake.id,
          color: snake.getColor(),
        }));

        this.sendWebsocketMessage(MessageType.RESUME, snakesData);
      } else {
        window.location.reload();
      }
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

  private sendWebsocketMessage(type: MessageType, data: any) {
    this.websocket.send({ type, data: { snakes: data } });
  }

  private drawDebugInfo() {
    if (!this.infoVisible) {
      return;
    }

    const snakeRows = this.world.aliveSnakes
      .sort((a, b) => b.energyLevel - a.energyLevel)
      .map(snake => `<tr><td style='background-color: rgb(${snake.getColor().join(',')})'></td><td>${Math.floor(snake.energyIntake)}</td><td>${Math.floor(snake.energyLevel)}</td></tr>`)
      .join('');

    const generationInfo = `
      <h4>Meta</h4>
      <table>
        <tr>
          <th>generation:</td><td>${this.generationCount}</td>
        </tr>
        <tr>
          <th>snakes alive:</td><td>${this.world.aliveSnakes.length}</td>
        </tr>
        <tr>
          <th>progress:</td>
          <td>
            <div class="progress-bar">
              <div class="bar">
                <div class="progress" style="--progress:${Math.floor(this.generationProgress * 100)}%;"></div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    `;

    this.generationInfoElement.innerHTML = generationInfo;

    const lastDelays = this.websocket.getLastMessageDelays(50);
    const lastSendDelays = this.websocket.getLastMessageSentDelays(50);
    const labels = lastDelays.map((_, index) => `-${Math.min(50, lastDelays.length) - index}`);
    new Chart(this.graphsContext, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'received - sent',
          backgroundColor: 'rebeccapurple',
          data: lastDelays,
        }, {
          label: 'sent - (sent - 1)',
          backgroundColor: 'rgba(33, 66, 99, 44)',
          data: lastSendDelays,
        }]
      },
      options: {
        animation: {
          duration: 0,
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              max: 200,
              min: -200,
            },
          }]
        }
      }
    });

    this.snakeListElement.innerHTML = `
      <h4>Snakes</h4>
      <table>
        <tr>
          <th>Color</th><th>EI</th><th>EL</th>
        </tr>
        ${snakeRows}
      </table>
    `;
  }
}
