
// ====== BUBBLE Particle
class Bubble extends Particle {
	constructor(xPos, yPos, speed, direction, context) {
		// Adjust these values for more deceleration, faster max speed, and less shrinking
		var mVel = 1;
		var dVel = (RENDER_HERTZ / 1000) * 80;
		var dRadius = -6 * (RENDER_HERTZ / 1000) * ((RENDER_HERTZ / 1000) - 2);
		if (speed == 0) {
			dVel = (RENDER_HERTZ / 1000) * 8;
			speed = 7;
			direction = (Math.floor(Math.random()*361)-180) * Math.PI / 180;
		} else {
			speed = Math.max(Math.min(speed, 20), 1);
			direction += (Math.floor(Math.random()*37)-18) * Math.PI / 180;
		}

		super(xPos, yPos, speed, direction, 8, mVel, dVel, dRadius, context);

		this.redVal = Math.floor((Math.random() * 3) + 1) * 85;
		this.opacityVal = Math.floor((Math.random() * 6) + 5) / 10; // Random number between 0.5 and 1.0, inclusive
		this.lineOpacity = 1.0;
		this.bubbleColor = "rgba("+this.redVal+", 195, 255, "+this.lineOpacity+")";

		Particle.entityArray.push(this);
	}
	static particleIndex() {
		return 1;
	}
	static spawn(xPos, yPos, speed, direction, context) {
		new Bubble(xPos, yPos, speed, direction, context);
	}
	update() {
		super.update();

		console.log("Line opacity" + this.lineOpacity)
		if (this.lineOpacity > 0 && this.speed <= 0) {
			this.lineOpacity -= 0.08
		}
	}
	draw() {
		// Bubble has chance to turn into accent color
		var rand = Math.floor(Math.random()*302);
		if (rand == 301) {
			this.bubbleColor = "rgba(255,204,51,"+this.lineOpacity+")";
		} else {
			this.bubbleColor = "rgba("+this.redVal+", 195, 255, "+this.lineOpacity+")";
		}
		// Draw line from spawn point to outward traveling bubble
		this.context.beginPath();
		this.context.moveTo(this.xPos_origin, this.yPos_origin);
		this.context.lineTo(this.xPos, this.yPos);
		this.context.strokeStyle = this.bubbleColor;
		this.context.stroke();
		// Fill bubble circle
		this.context.beginPath();
		this.context.arc(this.xPos, this.yPos, this.radius, 0, 2 * Math.PI);
		this.context.fillStyle = this.bubbleColor;
		this.context.fill();
	}
}
