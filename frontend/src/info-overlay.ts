import Chart from 'chart.js';
import { Snake } from "./snake";
import { Websocket } from "./websocket";

const COMMUNICATION_SPAN = 30;

export class InfoOverlay {
  private visible = true;
  private websocket: Websocket;
  private debuggerElement: HTMLElement;
  private generationInfoElement: HTMLElement;
  private snakeListElement: HTMLElement;
  private barChartElement: HTMLElement;
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

    this.barChartElement = document.createElement('div');
    this.barChartElement.classList.add('bar-chart');
    this.debuggerElement.appendChild(this.barChartElement);

    const leftBar = document.createElement('div');
    leftBar.classList.add('bar-chart--left');
    leftBar.innerHTML = 'backend';
    this.barChartElement.appendChild(leftBar);
    const rightBar = document.createElement('div');
    rightBar.classList.add('bar-chart--right');
    rightBar.innerHTML = 'frontend';
    this.barChartElement.appendChild(rightBar);

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

    const lastDelays = this.websocket.getLastMessageDelays(COMMUNICATION_SPAN);
    const lastDelaysLength = lastDelays.length;
    const lastSendDelays = this.websocket.getLastMessageSentDelays(COMMUNICATION_SPAN);
    const lastSendDelaysLength = lastSendDelays.length;

    const lastDelay = Math.abs(lastDelays[lastDelays.length - 1]);
    const lastSendDelay = Math.abs(lastSendDelays[lastSendDelays.length - 1]);
    const frameLength = lastDelay + lastSendDelay;
    const beDelay = lastDelay / frameLength;
    const feDelay = lastSendDelay / frameLength;
    this.barChartElement.style.setProperty('--be-delay', String(Math.floor(beDelay * 100) || 0));
    this.barChartElement.style.setProperty('--fe-delay', String(Math.floor(feDelay * 100) || 0));

    let delays = [];
    for (let i = COMMUNICATION_SPAN - 1; i >= 0; i--) {
      delays[i] = lastDelays[lastDelaysLength - (COMMUNICATION_SPAN - i)] || 1;
    }
    let sendDelays = [];
    for (let i = COMMUNICATION_SPAN - 1; i >= 0; i--) {
      sendDelays[i] = lastSendDelays[lastSendDelaysLength - (COMMUNICATION_SPAN - i)] || -1;
    }

    const labels = delays.map((_, index) => index - delays.length);

    new Chart(this.graphsContext, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'backend',
          backgroundColor: 'rebeccapurple',
          data: delays,
        }, {
          label: 'frontend',
          backgroundColor: '#75b800',
          data: sendDelays,
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
