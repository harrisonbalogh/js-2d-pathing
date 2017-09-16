
// Wisps will try to move around Blockers in its path
// A Blocker is formed by an array of vertices that form a concave or convex shape
class Blocker {
	constructor(xPositions, yPositions, context) {
		if (xPositions.length != yPositions.length) {
			return;
		}
    this.context = context;
    this.vertex = {
      x: xPositions,
      y: yPositions,
			length: xPositions.length
    }

		// Calculate center position
		var centerX = 0;
		var centerY = 0;
		for (x = 0; x < xPositions.length; x++) {
			centerX += xPositions[x];
			centerY += yPositions[x];
		}
		centerX /= xPositions.length;
		centerY /= yPositions.length;
		this.center = {
			x: centerX,
			y: centerY
		}

		// Calculate circle collider
		var indexDistanceSqrd = Math.pow(centerX - xPositions[0], 2) + Math.pow(centerY - yPositions[0], 2)
		for (var x = 1; x < xPositions.length; x++) {
			var distSqrd = Math.pow(centerX - xPositions[x], 2) + Math.pow(centerY - yPositions[x], 2)
			if (distSqrd > indexDistanceSqrd) {
				indexDistanceSqrd = distSqrd;
			}
		}
		// Radius of a circle encompassing every vertex of shape
		this.colliderRadiusSqrd = indexDistanceSqrd;
		this.colliderRadius = Math.sqrt(indexDistanceSqrd);

		Blocker.blockers.push(this);
  }

	render() {
    this.context.strokeStyle = "rgba(255, 0, 0, 1)";
    this.context.beginPath();
		this.context.moveTo(this.vertex.x[0], this.vertex.y[0]);
		for (var x = 1; x < this.vertex.x.length; x++) {
			this.context.lineTo(this.vertex.x[x], this.vertex.y[x]);
		}
		this.context.lineTo(this.vertex.x[0], this.vertex.y[0]);
    this.context.stroke();

		// this.context.strokeStyle = "rgba(100, 200, 20, 0.8)";
    // this.context.beginPath();
    // this.context.arc(this.center.x, this.center.y, this.colliderRadius, 0, 2 * Math.PI, false);
    // this.context.stroke();
	}

  static create(xPositions, yPositions, context) {
    if (xPositions.length == yPositions.length) {
      blockers.push(new Blocker(xPositions, yPositions, context))
    }
  }
  static flush() {

  }
}
Blocker.blockers = [];
