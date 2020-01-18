import { Bodies, Body, Constraint, Engine, IBodyDefinition, Render, Runner, World } from 'matter-js';
import { GameObjectType } from './utils';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const BOUNDARY_WIDTH = 40;

const snakeColors: Map<number, string> = new Map();

export class Physics {

  public engine: Engine;
  private runner: Runner | null = null;
  private render: Render;

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

    this.bottomBoundary = Bodies.rectangle(this.width / 2, this.height , this.width, BOUNDARY_WIDTH, { isStatic: true });
    this.topBoundary = Bodies.rectangle(this.width / 2, 0, this.width, BOUNDARY_WIDTH, { isStatic: true });
    this.rightBoundary = Bodies.rectangle(this.width, this.height / 2, BOUNDARY_WIDTH, this.height, { isStatic: true });
    this.leftBoundary = Bodies.rectangle(0, this.height / 2, BOUNDARY_WIDTH, this.height, { isStatic: true });

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
    const snakeHeadSize = 5;
    const snakeTailPieceSize = 4;

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
    const halo = Bodies.circle(x, y, 16, {
      label: String(GameObjectType.FOOD),
      friction: 0,
      frictionAir: 0.4,
      render: {
        fillStyle: 'white',
        opacity: 0.1,
      },
    });
    const foodBody = Bodies.rectangle(x, y, 8, 8, {
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
}
