
// ====== CURVE Particle
class Curve extends Particle {
	constructor(xPos, yPos, speed, direction, context) {
		super(xPos, yPos, speed, direction, Curve.HOVER_RADIUS, 0, 0, 0, context);

		this.pX = [xPos, xPos, xPos, xPos];
		this.pY = [yPos, yPos, yPos, yPos];
		this.siblingX = null;
		this.siblingY = null;

		this.strokeColor = null;
		var bubbleColors = ["rgb(51,198,245)", "rgb(51,153,204)", "rgb(0,119,180)", "rgb(0,90,141)", "rgb(255,204,51)"];
		if (Math.floor(Math.random()*41) == 40) {
			this.strokeColor = bubbleColors[4];
		} else {
			this.strokeColor = bubbleColors[Math.floor(Curve.lastColorChosen/25)];
		}

		Particle.entityArray.push(this);
	}
	static particleIndex() {
		return 3;
	}
	static spawn(xPos, yPos, speed, direction, context) {
		if (speed == 0) {
			xPos += (Math.floor(Math.random()*201) - 100);
			yPos += (Math.floor(Math.random()*201) - 100);
		} else {
			xPos += (Math.floor(Math.random()*101) - 50);
			yPos += (Math.floor(Math.random()*101) - 50);
		}

		if (Curve.currentCurvePoint == 4) {
			Curve.currentCurvePoint = 1;
			if (Curve.currentCurve != null) {
				Curve.currentCurve.siblingX = xPos;
				Curve.currentCurve.siblingY = yPos;
			}
			Curve.currentCurve = new Curve(xPos, yPos, speed, direction, context);
		} else if (mouse.x != 0 || mouse.y != 0) {
			Curve.currentCurvePoint++;
		}

		if (Curve.colorShiftAscending) {
			if (Curve.lastColorChosen == 124) {
				Curve.colorShiftAscending = false;
				Curve.lastColorChosen--;
			} else {
				Curve.lastColorChosen++;
			}
		} else {
			if (Curve.lastColorChosen == 0) {
				Curve.colorShiftAscending = true;
				Curve.lastColorChosen++;
			} else {
				Curve.lastColorChosen--;
			}
		}
	}
	update() {
		this.lifespan -= (RENDER_HERTZ/1000) * 50;
		if (this.lifespan <= 1) {
			Particle.entityTrash++;
		}

		if (Curve.currentCurve == this) {
			for (var i = Curve.currentCurvePoint; i < 4; i++) {
				if (mouse.x != 0 || mouse.y != 0) {
					this.pX[i] = mouse.x;
					this.pY[i] = mouse.y;
				} else {
					Curve.currentCurvePoint = 4;
					Curve.currentCurve = null;
				}
			}
		}
	}
	draw() {
		this.context.beginPath();
		this.context.moveTo(this.pX[0], this.pY[0]);
		this.context.bezierCurveTo(this.pX[1], this.pY[1], this.pX[2], this.pY[2], this.pX[3], this.pY[3]);
		this.context.strokeStyle = this.strokeColor;
		this.context.stroke();

		if (this.siblingX != null && this.siblingY != null) {
			this.context.beginPath();
			this.context.moveTo(this.pX[3], this.pY[3]);
			this.context.lineTo(this.siblingX, this.siblingY);
			this.context.strokeStyle = this.strokeColor;
			this.context.stroke();
		}
	}
}
Curve.currentCurvePoint = 4;
Curve.currentCurve = null;
Curve.lastColorChosen = 0;
Curve.colorShiftAscending = true;
