
// ====== WEB Particle
class Web extends Particle {
	constructor(xPos, yPos, speed, direction, context) {
		// Adjust these values for more deceleration, faster max speed, and less shrinking
		var mVel = 0.5;
		var dVel = (RENDER_HERTZ / 1000) * 20;
		var dRadius = -3 * (RENDER_HERTZ / 1000) * ((RENDER_HERTZ / 1000) - 2);

		if (speed  == 0) {
			direction = (Math.floor(Math.random()*361)-180) * Math.PI / 180;
		} else {
			direction += (Math.floor(Math.random()*51)-25) * Math.PI / 180;
		}

		speed = Math.max(Math.min(speed, 28), 10);

		super(xPos, yPos, speed, direction, 8, mVel, dVel, dRadius, context);

		this.sibling = null; // The following finds the last context's particle
		for (var i = 0; i < Particle.entityArray.length; i++) {
			if (Particle.entityArray[i].context == context) {
				this.sibling = Particle.entityArray[i];
			}
		}

		this.drawColor = this.generateDrawColor();
		this.drawColorLine = "rgb(0,119,180)"
		Particle.entityArray.push(this);
	}
	static particleIndex() {
		return 2;
	}
	static spawn(xPos, yPos, speed, direction, context) {
		new Web(xPos, yPos, speed, direction, context);
	}
	draw() {
		// From line to neighbor web node
		if (this.sibling != null) {
			this.context.beginPath();
			this.context.moveTo(this.xPos, this.yPos);
			this.context.lineTo(this.sibling.xPos, this.sibling.yPos);
			this.context.strokeStyle = this.drawColorLine;
			this.context.stroke();
		}
		// Filled in circle
		this.context.beginPath();
		this.context.arc(this.xPos, this.yPos, this.radius, 0, 2 * Math.PI);
		this.context.fillStyle = this.drawColor;
		this.context.fill();
	}
	generateDrawColor() {
		if (Math.floor(Math.random()*32) == 31) {
			return "rgb(255,204,51)";
		} else {
			return "rgb(51,153,204)";
		}
	}
}
