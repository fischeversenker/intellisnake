import { Bodies, Body, Constraint, Engine, IBodyDefinition, Render, Runner, World } from 'matter-js';
import { GameObjectType } from './utils';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const TEMP_RENDER_WIDTH = 100;
const TEMP_RENDER_HEIGHT = 100;
const BOUNDARY_WIDTH = 40;
const ME_COLOR = 'white';

const snakeColors: Map<number, string> = new Map();

export class Physics {

  public engine: Engine;
  private runner: Runner | null = null;
  private render: Render;
  private tempRender: Render;

  private bottomBoundary: Body;
  private topBoundary: Body;
  private rightBoundary: Body;
  private leftBoundary: Body;

  constructor(
    private element: HTMLElement,
    public width: number = WIDTH,
    public height: number = HEIGHT,
  ) {

    // create an engine
    this.engine = Engine.create();
    this.engine.world.gravity = { x: 0, y: 0, scale: 0 };

    // create a renderer
    this.render = Render.create({
      element: this.element,
      engine: this.engine,
      options: {
        width: this.width,
        height: this.height,
        wireframes: false,
      },
    });

    // add hidden element to main element to give to temp renderer
    const hiddenEl = document.createElement('div');

    // create a temp renderer
    this.tempRender = Render.create({
      element: hiddenEl,
      engine: this.engine,
      options: {
        width: this.width,
        height: this.height,
        wireframes: false,
      },
    });

    this.bottomBoundary = Bodies.rectangle(
      this.width / 2,
      this.height + BOUNDARY_WIDTH / 2,
      this.width,
      BOUNDARY_WIDTH,
      { render: { visible: false }, isStatic: true, label: 'boundary' },
    );
    this.topBoundary = Bodies.rectangle(
      this.width / 2,
      0 - BOUNDARY_WIDTH / 2,
      this.width,
      BOUNDARY_WIDTH,
      { render: { visible: false }, isStatic: true, label: 'boundary' },
    );
    this.rightBoundary = Bodies.rectangle(
      this.width + BOUNDARY_WIDTH / 2,
      this.height / 2,
      BOUNDARY_WIDTH,
      this.height,
      { render: { visible: false }, isStatic: true, label: 'boundary' },
    );
    this.leftBoundary = Bodies.rectangle(
      0 - BOUNDARY_WIDTH / 2,
      this.height / 2,
      BOUNDARY_WIDTH,
      this.height,
      { render: { visible: false }, isStatic: true, label: 'boundary' },
    );

    World.add(this.engine.world, [this.bottomBoundary, this.topBoundary, this.leftBoundary, this.rightBoundary]);
  }

  addRandomSnake(): { head: Body, tail: Body[], constraints: Constraint[] } {
    const randomX = BOUNDARY_WIDTH * 2 + Math.random() * (this.width - BOUNDARY_WIDTH * 4);
    const randomY = BOUNDARY_WIDTH * 2 + Math.random() * (this.height - BOUNDARY_WIDTH * 4);
    const snake = this.createSnakeBody(randomX, randomY, 10);
    World.add(this.engine.world, [snake.head, ...snake.tail]);
    World.add(this.engine.world, snake.constraints);
    return snake;
  }

  createSnakeBody(x: number, y: number, length: number): { head: Body, tail: Body[], constraints: Constraint[] } {
    const snakeHeadSize = 10;
    const snakeTailPieceSize = 8;

    // get an existing snake color or add a random one
    let snakeColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    if (snakeColors.has(this.snakesOnWorld.length)) {
      snakeColor = snakeColors.get(this.snakesOnWorld.length) as string;
    } else {
      snakeColors.set(this.snakesOnWorld.length, snakeColor);
    }

    const snakeOptions: IBodyDefinition = {
      friction: 0,
      frictionAir: 0.05,
      label: String(GameObjectType.SNAKE),
      render: {
        fillStyle: snakeColor,
      },
    }
    const head = Bodies.circle(x, y, snakeHeadSize, { ...snakeOptions });
    const tail = [];
    const constraints = [];
    for (let i = 1; i <= length; i++) {
      const isFirst = i === 1;
      const incX = i * snakeHeadSize * (isFirst ? 1.6 : 1.4);
      const incY = i * snakeHeadSize * (isFirst ? 1.6 : 1.4);
      const tailPiece = Bodies.circle(x + incX, y - incY, snakeTailPieceSize, {
        ...snakeOptions,
        label: 'snake-tail',
      });
      const constraint = Constraint.create({
        bodyA: isFirst ? head : tail[i - 2],
        bodyB: tailPiece,
        render: {
          visible: false,
          lineWidth: 0,
          strokeStyle: 'line',
        },
      });
      tail.push(tailPiece);
      constraints.push(constraint);
    }
    return { head, tail, constraints };
  }

  addFood(x: number, y: number): Body {
    const food = this.createFood(x, y);
    World.add(this.engine.world, food);
    return food;
  }

  createFood(x: number, y: number = 500): Body {
    const foodSize = 24;
    const halo = Bodies.circle(x, y, foodSize, {
      label: String(GameObjectType.FOOD),
      friction: 0,
      frictionAir: 0.4,
      render: {
        fillStyle: 'white',
        opacity: 0.1,
      },
    });
    const foodBody = Bodies.rectangle(x, y, foodSize / 1.5, foodSize / 1.5, {
      label: String(GameObjectType.FOOD),
      friction: 0,
      frictionAir: 0.4,
    });
    const food = Body.create({
      label: String(GameObjectType.FOOD),
      parts: [foodBody, halo],
      frictionAir: 0.4,
      inertia: 0,
    });
    return food;
  }

  run() {
    // run the engine
    this.runner = Runner.run(this.engine);

    // run the renderer
    Render.run(this.render);
  }

  get snakesOnWorld(): Body[] {
    return this.engine.world.bodies.filter(body => body.label === String(GameObjectType.SNAKE));
  }

  stop() {
    Render.stop(this.render);
    if (this.runner) {
      Runner.stop(this.runner);
    }
  }

  destroy() {
    World.clear(this.engine.world, true);
    Engine.clear(this.engine);
  }

  renderAsMe(...bodies: Body[]): ImageData {
    let origColor: string | undefined;
    // set ME_COLOR for all body parts
    bodies.forEach(body => {
      origColor = body.render.fillStyle;
      body.render.fillStyle = ME_COLOR;
    });

    // render world with temp renderer to not disturb
    // the shown (correctly colored) main rendering
    let meData;
    Render.world(this.tempRender);
    if (this.render && this.render.canvas) {
      const context = this.render.canvas.getContext('2d');
      if (context) {
        const tempRenderContext = this.tempRender.canvas.getContext('2d');
        if (tempRenderContext) {
          tempRenderContext.clearRect(0, 0, this.width, this.height);
          tempRenderContext.drawImage(context.canvas, 0, 0, TEMP_RENDER_WIDTH, TEMP_RENDER_HEIGHT);
          meData = tempRenderContext.getImageData(0, 0, TEMP_RENDER_WIDTH, TEMP_RENDER_HEIGHT);
        }
      }
    }

    // reset orig colors
    bodies.forEach(body => {
      body.render.fillStyle = origColor;
    });

    if (!meData) {
      throw new Error('could not get image data for bodies');
    }
    return meData as ImageData;
  }
}
