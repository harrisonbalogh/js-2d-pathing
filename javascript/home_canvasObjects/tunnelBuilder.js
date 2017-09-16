
class TunnelBuilder {
  constructor() {
    this.position = {
      x: 0,
      y: 0
    }
    this.waypoint = {
      x: 0,
      y: 0,
      xVector: 0,
      yVector: 0,
      distToTargetSqrd: 0,
      angleToTarget: 0
    }
    this.velocity = {
      magnitude: 0,
      direction: 0,
      ACCELERATION: 0.02,
      TURN_RATE: 4 * Math.PI / 180,
      TERMINAL: 5
    }
    // Simulates the oscilating motion
    this.slither = {
      angle: 0,
      up: true,
      RATE: 3 * Math.PI / 180,
      TERMINAL: 33 * Math.PI / 180
    }
  }

  setWaypoint(xWay_new, yWay_new) {
    this.waypoint.x = xWay_new;
    this.waypoint.y = yWay_new;
  }
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  update() {
    this.waypoint.xVector = this.waypoint.x - this.position.x;
    this.waypoint.yVector = this.waypoint.y - this.position.y;

    // Check whether distance is far enough to speed up or slow down
    this.distToTargetSqrd = Math.pow(this.waypoint.xVector, 2) + Math.pow(this.waypoint.yVector, 2);
    if (this.distToTargetSqrd > Math.pow(100, 2)) { // UPDATE THIS VALUE TO BE CALCULATED
      this.velocity.magnitude += this.velocity.ACCELERATION;
      this.velocity.magnitude = Math.min(this.velocity.magnitude, this.velocity.TERMINAL);
    } else if (this.distToTargetSqrd > Math.pow(5,2)){
      this.velocity.magnitude -= 3 * this.velocity.ACCELERATION;
      this.velocity.magnitude = Math.max(this.velocity.magnitude, 1.5);
    } else {
      this.velocity.magnitude = 0;
      return;
    }
    // Get target angle
    this.waypoint.angleToTarget = Math.atan2(this.waypoint.yVector, this.waypoint.xVector); // atan2 expensive?
    this.waypoint.angleToTarget = normalizeAngle(this.waypoint.angleToTarget);
    // Check closest direction to turn to target angle
    var angleDifference = this.waypoint.angleToTarget - this.velocity.direction;
    if (Math.abs(angleDifference) > this.velocity.TURN_RATE) {
      if ((angleDifference < Math.PI && angleDifference > 0) || (angleDifference < - Math.PI)) {
        this.velocity.direction += (this.velocity.TURN_RATE);
      } else {
        this.velocity.direction -= (this.velocity.TURN_RATE);
      }
      this.velocity.direction = normalizeAngle(this.velocity.direction);
    } else {
      // Heading in straight line
      this.velocity.direction = this.waypoint.angleToTarget;
    }
    // Control slither movement
    if (this.slither.up) {
      this.slither.angle += this.slither.RATE;
      if (this.slither.angle > this.slither.TERMINAL) {
        this.slither.up = false;
      }
    } else {
      this.slither.angle -= this.slither.RATE;
      if (this.slither.angle < -this.slither.TERMINAL) {
        this.slither.up = true;
      }
    }
    // Calculate displacement components
    this.position.x += this.velocity.magnitude * Math.cos(this.velocity.direction + this.slither.angle);
    this.position.y += this.velocity.magnitude * Math.sin(this.velocity.direction + this.slither.angle);
  }
}

function normalizeAngle(angle) {
  var newAngle = angle;
  while (newAngle < 0) {
    newAngle += 2 * Math.PI;
  }
  while (newAngle > 2 * Math.PI) {
     newAngle -= 2 * Math.PI;
   }
  return newAngle;
}
