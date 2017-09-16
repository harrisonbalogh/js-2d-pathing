
// ====== TUNNEL Particle
class Tunnel extends Particle {
	constructor(xPos, yPos, speed, direction, context) {
		// Adjust these values for more deceleration, faster max speed, and less shrinking
		if (Tunnel.tunnelBuilder.velocity.magnitude == 0) {
      super(xPos, yPos, speed, direction, Math.floor(Tunnel.hoverSpreadRadius), 0, 0, 0, context);
			this.tunnelColor = __color_accent;
		} else {
      super(xPos, yPos, speed, direction, Tunnel.RADIUS_MIN, 0, 0, 0, context);
			if (Tunnel.alternateColor) {
				this.tunnelColor = "rgb(51,153,204)";
			} else {
				this.tunnelColor = "rgb(0,102,153)";
			}
			Tunnel.alternateColor = !Tunnel.alternateColor;
		}

		Particle.entityArray.push(this);
	}
	static particleIndex() {
		return 4;
	}
	static spawn(xPos, yPos, speed, direction, context) {
		new Tunnel(Tunnel.tunnelBuilder.position.x, Tunnel.tunnelBuilder.position.y, speed, direction, context);

    if (Tunnel.tunnelBuilder.velocity.magnitude == 0) {
      Tunnel.hoverSpreadRadius += 0.5;
      if (Tunnel.hoverSpreadRadius > Tunnel.RADIUS_MAX) {
        Tunnel.hoverSpreadRadius = Tunnel.RADIUS_MIN;
      }
    } else {
      Tunnel.hoverSpreadRadius = Tunnel.RADIUS_MIN;
    }
	}

  update() {
    this.lifespan -= (RENDER_HERTZ/1000) * 20;
		if (this.lifespan <= 1) {
			Particle.entityTrash++;
		}
  }

	draw() {
		this.context.strokeStyle = this.tunnelColor;
		this.context.beginPath();
		this.context.arc(this.xPos, this.yPos, this.radius, 0, 2 * Math.PI, false);
		this.context.stroke();
	}
}
Tunnel.RADIUS_MIN = 20;
Tunnel.RADIUS_MAX = 60;
Tunnel.alternateColor = false; // Alternate tunnel color
Tunnel.hoverSpreadRadius = Tunnel.RADIUS_MIN;
Tunnel.tunnelBuilder = new TunnelBuilder();
