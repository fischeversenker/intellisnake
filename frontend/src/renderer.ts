import { Engine, World, Render, Bodies } from 'matter-js';

export class Renderer {

  private engine: Engine;
  private render: Render;

  constructor(element: HTMLElement) {

    // create an engine
    this.engine = Engine.create();

    // create a renderer
    this.render = Render.create({
        element: element,
        engine: this.engine
    });

    // create two boxes and a ground
    var boxA = Bodies.rectangle(180, 200, 40, 40);
    var boxB = Bodies.rectangle(200, 50, 40, 40);
    var ground = Bodies.rectangle(400, 610, 540, 60, { isStatic: true });

    // add all of the bodies to the world
    World.add(this.engine.world, [boxA, boxB, ground]);
  }

  run() {
    // run the engine
    Engine.run(this.engine);

    Render.run(this.render);
  }
}
