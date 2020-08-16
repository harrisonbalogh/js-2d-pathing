// Contains the entities that are drawn in the canvas.js file

// Canvas drawn Entities
// All entities inherit from Particle parent entity
// - Particle is an abstract class
class Particle {
  constructor(xPos, yPos, speed, direction, radius, mVel, dVel, dRadius, context) {
    this.xPos = xPos;
    this.yPos = yPos;
    this.xPos_origin = xPos;
    this.yPos_origin = yPos;
    this.speed = speed;
    this.direction = direction;
    this.radius = radius;
    this.lifespan = 150.0;
    this.mVel = mVel; // modifier for velocity boosting or suppressing
    this.dVel = dVel; // rate of change of velocity
    this.dRadius = dRadius; // rate of change of radius
    this.context = context;
  }
  update() {
    if (this.radius > 1) {
      this.radius -= this.dRadius;
    }
    this.xPos -= this.speed * Math.cos(this.direction) * this.mVel;
    this.yPos -= this.speed * Math.sin(this.direction) * this.mVel;
    this.speed = Math.max(this.speed - this.dVel, 0);

    this.lifespan -= (RENDER_HERTZ/1000) * 140;
    if (this.lifespan <= 1) {
      Particle.entityTrash++;
    }
  }
  static spawnEntityArray(xPos, yPos, xVel, yVel, style, context) {
    var speed = Math.sqrt(Math.pow(xVel, 2) + Math.pow(yVel, 2));
    var direction = Math.atan2(yVel, xVel);

    if (xPos != 0 && yPos != 0) {
      switch (style) {
        case 0:
            Gradient.spawn(xPos, yPos, speed, direction, context);
            break;
        case 1:
            Bubble.spawn(xPos, yPos, speed, direction, context);
            break;
        case 2:
            Web.spawn(xPos, yPos, speed, direction, context);
            break;
        case 3:
            Curve.spawn(xPos, yPos, speed, direction, context);
            break;
        case 4:
            Tunnel.spawn(xPos, yPos, speed, direction, context);
            break;
        default:
            Gradient.spawn(xPos, yPos, speed, direction, context);
      }
    }
  }
  static entitiesDraw() {
    for(var x = 0; x < Particle.entityArray.length; x++) {
      Particle.entityArray[x].draw();
    }
  }
  static entitiesUpdate() {
    for(var x = 0; x < Particle.entityArray.length; x++) {
      Particle.entityArray[x].update();
    }
  }
  static entitiesFlush() {
    for(var x = 0; x < Particle.entityTrash; x++) {
      Particle.entityArray.shift();
    }
    Particle.entityTrash = 0;
  }
}
// Keep track of particles that have been instantiated
Particle.entityArray = [];
// Particles are removed FIFO so once an entity has run out of
// lifespan then entitiesFlush() clears out the oldest particles
Particle.entityTrash = 0;
