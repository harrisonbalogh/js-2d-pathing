
// ====== GRADIENT Particle
class Gradient extends Particle {
	constructor(xPos, yPos, speed, direction, context) {
		// Adjust these values for more deceleration, faster max speed, and less shrinking
		var mVel = 0.3;
		var dVel = (RENDER_HERTZ / 1000) * 20;
		var dRadius = -6 * (RENDER_HERTZ / 1000) * ((RENDER_HERTZ / 1000) - 2);
		if (speed == 0) {
			speed = 14;
		} else {
			// direction += (Math.floor(Math.random()*31)-15) * Math.PI / 180;
		}
		direction = (Math.floor(Math.random()*361)-180) * Math.PI / 180;
		speed = Math.max(Math.min(speed, 16), 2);

		super(xPos, yPos, speed, direction, 8, mVel, dVel, dRadius, context);

		this.strokeColor = null;
		var bubbleColors = ["rgb(51,198,245)", "rgb(51,153,204)", "rgb(0,119,180)", "rgb(0,90,141)", "rgb(255,204,51)"];
		if (Math.floor(Math.random()*41) == 40) {
			this.strokeColor = bubbleColors[4];
		} else {
			this.strokeColor = bubbleColors[Math.floor(Gradient.lastColorChosen/25)];
		}

		Particle.entityArray.push(this);
	}
	static particleIndex() {
		return 0;
	}
	static spawn(xPos, yPos, speed, direction, context) {
		new Gradient(xPos, yPos, speed, direction, context);
		new Gradient(xPos, yPos, speed, direction, context);
		new Gradient(xPos, yPos, speed, direction, context);

		if (Gradient.colorShiftAscending) {
			if (Gradient.lastColorChosen == 99) {
				Gradient.colorShiftAscending = false;
				Gradient.lastColorChosen--;
			} else {
				Gradient.lastColorChosen++;
			}
		} else {
			if (Gradient.lastColorChosen == 0) {
				Gradient.colorShiftAscending = true;
				Gradient.lastColorChosen++;
			} else {
				Gradient.lastColorChosen--;
			}
		}
	}
	draw() {
		// Draws filled in circle
		this.context.beginPath();
		this.context.arc(this.xPos, this.yPos, this.radius, 0, 2 * Math.PI, false);
		this.context.fillStyle = this.strokeColor;
		this.context.fill();
		// alert("hi");
	}
}
Gradient.lastColorChosen = 0;
Gradient.colorShiftAscending = true;
