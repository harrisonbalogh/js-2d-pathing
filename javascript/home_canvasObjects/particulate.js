class Particulate {
  constructor(startX, startY, radius, velDirection, velMagnitude, color) {

    this.radius = radius;

    this.position = {
      x: startX,
      y: startY
    }
    this.velocity = {
      magnitude: velMagnitude,
      startingMagnitude: velMagnitude,
      direction: velDirection,
      ACCELERATION: 0.07,
    }

    this.color = color;
  }
}
