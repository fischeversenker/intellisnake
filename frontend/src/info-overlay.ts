import Chart from 'chart.js';
import { Snake } from "./snake";
import { Websocket } from "./websocket";

export class InfoOverlay {
  private visible = true;
  private websocket: Websocket;
  private debuggerElement: HTMLElement;
  private generationInfoElement: HTMLElement;
  private snakeListElement: HTMLElement;
  private graphsElement: HTMLElement;
  private graphsContext: CanvasRenderingContext2D;
  private controlsElement: HTMLElement;

  constructor(
    private rootElement: HTMLElement,
    private startCallback: () => void,
    private resumeCallback: () => void,
  ) {
    this.websocket = Websocket.getInstance();

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

    document.body.addEventListener('keypress', (evt) => {
      if (evt.key === 'i') {
        this.visible = !this.visible;
        this.debuggerElement.classList.toggle('hidden');
        this.controlsElement.classList.toggle('hidden');
      }
    });

    const startButtonElement = document.createElement('button');
    startButtonElement.innerHTML = 'START';
    this.controlsElement.appendChild(startButtonElement);
    startButtonElement.addEventListener('click', this.startCallback);

    const resumeButtonElement = document.createElement('button');
    resumeButtonElement.innerHTML = 'RESUME';
    this.controlsElement.appendChild(resumeButtonElement);
    resumeButtonElement.addEventListener('click', this.resumeCallback);
  }

  update(snakes: Snake[], generation: number, progress: number) {
    if (!this.visible) {
      return;
    }

    const snakeRows = snakes
      .sort((a, b) => b.energyLevel - a.energyLevel)
      .map(snake => `<tr><td style='background-color: rgb(${snake.getColor().join(',')})'></td><td>${Math.floor(snake.energyIntake)}</td><td>${Math.floor(snake.energyLevel)}</td></tr>`)
      .join('');

    const generationInfo = `
      <h4>Meta</h4>
      <table>
        <tr>
          <th>generation:</td><td>${generation}</td>
        </tr>
        <tr>
          <th>snakes alive:</td><td>${snakes.length}</td>
        </tr>
        <tr>
          <th>progress:</td>
          <td>
            <div class="progress-bar">
              <div class="bar">
                <div class="progress" style="--progress:${Math.floor(progress * 100)}%;"></div>
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
          label: 'backend',
          backgroundColor: 'rebeccapurple',
          data: lastDelays,
        }, {
          label: 'frontend',
          backgroundColor: '#75b800',
          data: lastSendDelays,
        }]
      },
      options: {
        animation: {
          duration: 0,
        },
        elements: {
          point: {
            radius: 0,
          },
        },
        scales: {
          yAxes: [{
            ticks: {
              maxTicksLimit: 3,
              suggestedMin: 100,
              suggestedMax: 100,
            },
            position: 'right',
          }],
        },
      },
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
