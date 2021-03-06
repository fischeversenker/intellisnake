import Matter, { Bodies, Body, Composite, Composites, Engine, IBodyDefinition, IMouseConstraintDefinition, Mouse, MouseConstraint, Render, Runner, Vector, World } from 'matter-js';
import { Config } from './config';
import { Snake } from './snake';
import { GameObjectType } from './utils';

const BOUNDARY_WIDTH = 80;
const SNAKE_GROUP = Body.nextGroup(true);

const snakeColors: Map<number, string> = new Map();

export class Physics {

  public engine: Engine;
  public world: World;
  private runner: Runner | null = null;
  private render: Render;
  private tempRender: Render;
  private usedReds = [0, 234, 255];

  private bottomBoundary: Body;
  private topBoundary: Body;
  private rightBoundary: Body;
  private leftBoundary: Body;

  // currently the - kind of hacky - way to reset the ids generated by the physic
  // error in types for matter-js, which apparently doesn't expose Matter.Common
  // hence casting to any
  private matterCommon: any = (Matter as any).Common;

  constructor(
    private element: HTMLElement,
    public width: number,
    public height: number,
  ) {
    // create an engine
    this.engine = Engine.create();
    this.world = this.engine.world;
    this.world.gravity = { x: 0, y: 0, scale: 0 };

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
      this.width * 1.1,
      BOUNDARY_WIDTH,
      { render: { visible: false }, isStatic: true, label: GameObjectType.BOUNDARY },
    );
    this.topBoundary = Bodies.rectangle(
      this.width / 2,
      0 - BOUNDARY_WIDTH / 2,
      this.width * 1.1,
      BOUNDARY_WIDTH,
      { render: { visible: false }, isStatic: true, label: GameObjectType.BOUNDARY },
    );
    this.rightBoundary = Bodies.rectangle(
      this.width + BOUNDARY_WIDTH / 2,
      this.height / 2,
      BOUNDARY_WIDTH,
      this.height * 1.1,
      { render: { visible: false }, isStatic: true, label: GameObjectType.BOUNDARY },
    );
    this.leftBoundary = Bodies.rectangle(
      0 - BOUNDARY_WIDTH / 2,
      this.height / 2,
      BOUNDARY_WIDTH,
      this.height * 1.1,
      { render: { visible: false }, isStatic: true, label: GameObjectType.BOUNDARY },
    );

    World.add(this.world, [this.bottomBoundary, this.topBoundary, this.leftBoundary, this.rightBoundary]);

    // make sure all our bodies start at this given id to not conflict with any other ids
    // absolutely not necessary because of matter-js.
    // we want to be able to start each generation with the ids we used in the last gen
    // the ids are given by matter-js so we trick matter-js by setting its internal pointer
    // to the next id we want our ids to start with
    // naturally you would set this to 0... but apparently matter-js places some things
    // on the world before you even start working on it. The starting id was always 5 for me.
    // to overcome this we start with an arbitrary (but higher than 5) number as our starting id.
    this.matterCommon._nextId = Config.STARTING_BODY_ID;

    // add mouse control
    const mouse = Mouse.create(this.render.canvas);
    const mouseConstraint = MouseConstraint.create(this.engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    } as IMouseConstraintDefinition);
    World.add(this.world, mouseConstraint);
  }

  getRandomSnake(): Composite {
    const randomPos = this.getRandomPosition();
    return this.createSnakeBody(randomPos.x, randomPos.y, 10);
  }

  createSnakeBody(x: number, y: number, length: number): Composite {
    const nextSnakeColor = this.getNextColorValue();
    const composite = Composites.stack(x, y, 1, length, 0, -2, (x: number, y: number) => {
      return Bodies.circle(x, y, Config.SNAKE_TAIL_SIZE, {
        chamfer: 5,
        frictionAir: 0.2,
        collisionFilter: { group: SNAKE_GROUP },
        label: GameObjectType.SNAKE_TAIL,
        render: {
          fillStyle: nextSnakeColor,
        }
      } as IBodyDefinition);
    })
    Composite.add(composite, Bodies.circle(x, y + length * 10, Config.SNAKE_HEAD_SIZE, {
      chamfer: 5,
      frictionAir: 0.1,
      collisionFilter: { group: SNAKE_GROUP },
      label: GameObjectType.SNAKE,
      render: {
        fillStyle: nextSnakeColor,
      }
    } as IBodyDefinition));

    Composites.chain(composite, 0, 0.3, 0, -0.3, {
      stiffness: 0,
      length: 0,
      damping: 0.6,
      render: {
        visible: false,
      },
    });

    // get an existing snake color or add a random one
    let snakeColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    if (snakeColors.has(composite.id)) {
      snakeColor = snakeColors.get(composite.id) as string;
    } else {
      snakeColors.set(composite.id, snakeColor);
    }
    composite.bodies.forEach(body => body.render.fillStyle = snakeColor);

    return composite;
  }

  getRandomPosition(): Vector {
    const randomX = BOUNDARY_WIDTH * 3 + Math.random() * (this.width - BOUNDARY_WIDTH * 6);
    const randomY = BOUNDARY_WIDTH * 3 + Math.random() * (this.height - BOUNDARY_WIDTH * 6);
    return Vector.create(randomX, randomY);
  }

  getFood(x: number, y: number): Body {
    const food = this.createFood(x, y);
    return food;
  }

  createFood(x: number, y: number = 500): Body {
    return Bodies.circle(x, y, Config.FOOD_SIZE, {
      label: String(GameObjectType.FOOD),
      friction: 0,
      frictionAir: 0.4,
      inertia: 0,
      render: {
        fillStyle: Config.FOOD_COLOR,
        opacity: 1,
      },
    });
  }

  run() {
    console.log('[PHYSICS]: run()');
    // run the engine
    this.runner = Runner.run(this.engine);

    // run the renderer
    Render.run(this.render);
  }

  get snakesOnWorld(): Body[] {
    return this.world.bodies.filter(body => body.label === String(GameObjectType.SNAKE));
  }

  stop() {
    console.log('[PHYSICS]: stop()');
    Render.stop(this.render);
    if (this.runner) {
      Runner.stop(this.runner);
    }
  }

  destroy() {
    console.log('[PHYSICS]: destroy()');
    World.clear(this.world, true);
    this.matterCommon._nextId = Config.STARTING_BODY_ID;
  }

  getImageData(): ImageData {

    let imgData: ImageData;
    if (this.render && this.render.canvas) {
      const context = this.render.canvas.getContext('2d');
      if (context) {
        const tempRenderContext = this.tempRender.canvas.getContext('2d');
        if (tempRenderContext) {
          tempRenderContext.clearRect(0, 0, this.width, this.height);
          tempRenderContext.drawImage(context.canvas, 0, 0, Config.TEMP_RENDER_WIDTH, Config.TEMP_RENDER_HEIGHT);
          imgData = tempRenderContext.getImageData(0, 0, Config.TEMP_RENDER_WIDTH, Config.TEMP_RENDER_HEIGHT);
        }
      }
    }
    return imgData!;
  }

  private getNextColorValue(): string {
    let red = 1;
    while (this.usedReds.includes(red)) {
      red = Math.floor(Math.random() * 255);
    }
    this.usedReds.push(red);
    const green = Math.floor(Math.random() * 255);
    const blue = Math.floor(Math.random() * 255);
    return `rgb(${red}, ${green}, ${blue})`;
  }
}
