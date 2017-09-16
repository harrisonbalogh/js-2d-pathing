// Handles dynamic canvas drawing on the background of the home "scene"

// Classes in JavaScript are not hoisted. All other variables/functions are lifted to the top of their scope for order-less reference
// So order matters for 'class' declarations
// ==================================================================================================================== Variables =====

// Safari glitch calls mouse move twice as fast when focused on web window
// Need a timeout function to slow down calls.
var MOUSE_HERTZ = 20;
var mouseClock = null;
var mouseReady = true;

var RENDER_HERTZ = 1000 / 60; // Render update speed
var canvasRunning = true; // when the GUI setting is enabled or not. Override drawing.
var canvasDrawing = true; // when the cursor is within the canvas bounds. Optimize drawing.
var canvasUpdating = false; // if update has yet to resume
var canvasFlush = true; // if drawing frames are cleared or retained
var canvasMasterContext; // The primary canvas particles are drawn on
var masterCircleContext; // Only draws circle connecting orbs

// Rotating orbs for selecting style type
var selectedOrb = -1; // -1 implies no orb selected
var ORB_COUNT = 5; // Number of orbs to initialize
var orbs = []; // Contains all orb elements
var orbsRevolveRadius; // How far from center orbs should reside
var orbsCurrentRevolveAngle = 0; // For tracking and incrementing orb angle
var ORB_COLORS = ["rgb(0,102,153)","rgb(0,119,180)","rgb(51,153,204)","rgb(51,198,245)","rgb(51,153,204)"];
var wisps = []

// ID references
var homeScene = document.getElementById('scene-home');
var disableButtonText = document.getElementById('home-settings--toggle-drawing-text');
var canvas_bg = document.getElementById("bgCanvas");
var canvas_circle = document.getElementById("circleCanvas");
var mouseTracker = document.getElementById("mouseTracker");

// Get all properties of the user's mouse cotained here
var mouse = {
	down: false,
	button: 1,
	x: 0,
	y: 0,
	px: 0,
	py: 0,
	stopTimer: null,
	zeroVelocity() {
		this.px = this.x;
		this.py = this.y;
	}
};

// ==================================================================================================== Style Buttons Initialization =====
function initializeCircles() {

	var mouseEnter_styleButton = function(elem, style) {
		return function() {
			if (selectedOrb != -1)
				TweenLite.to(orbs[selectedOrb], 0.2, {backgroundColor: ORB_COLORS[selectedOrb]});
				if (selectedOrb == style) {
					selectedOrb = -1;
				} else {
					selectedOrb = style;
					TweenLite.to(elem, 0.2, {backgroundColor: __color_foreground});
				}
		};
	};
	var mouseLeave_styleButton = function(elem) {
		return function() {
			TweenLite.to(elem, 0.2, {borderColor: "white"});
		};
	};

	var scene_home = document.getElementById('scene-home');

	for (b = 0; b < ORB_COUNT; b++) {
		var newDiv = document.createElement("div");
		newDiv.setAttribute("id", "scene-home-button-style_" + b);
		newDiv.setAttribute("class", "scene-home-button-style");
		// TweenLite.set(newDiv, {backgroundColor: ORB_COLORS[b]});
		newDiv.style.backgroundColor = ORB_COLORS[b];
		newDiv.onmouseenter = mouseEnter_styleButton(newDiv, b);
		newDiv.onmouseleave = mouseLeave_styleButton(newDiv);
		scene_home.appendChild(newDiv);
		orbs.push(newDiv);
	}
	positionCirclesToFrameRadius();
}

function positionCirclesToFrameRadius() {
	var limitingDimension = Math.min(canvas_bg.width, canvas_bg.height);
	orbsRevolveRadius = Math.min(300, Math.max(limitingDimension/4, 150));
};

function drawCirclesMasterCircle() {
	// Draw the large ring connecting all other style circles
	masterCircleContext.beginPath();
	masterCircleContext.arc(canvas_bg.width/2, canvas_bg.height/2, orbsRevolveRadius, 0, 2 * Math.PI);
	masterCircleContext.strokeStyle = __color_background;
	masterCircleContext.stroke();
}

function spinCircles() {
	for(c = 0; c < ORB_COUNT; c++) {
		var angle = orbsCurrentRevolveAngle + c * 360 / ORB_COUNT;
		var yCalc = orbsRevolveRadius * Math.sin((angle) * Math.PI / 180) - orbs[c].offsetHeight/2;
		var xCalc = orbsRevolveRadius * Math.cos((angle) * Math.PI / 180) - orbs[c].offsetWidth/2;
		TweenLite.set(orbs[c], {x: xCalc, y: yCalc});
	}
	orbsCurrentRevolveAngle += 0.10;
	if (orbsCurrentRevolveAngle >= 360) {
		orbsCurrentRevolveAngle = 0;
	}
}

// ================================================================================================ Disable Button Initialization =====

document.getElementById('scene-home-settings').onmouseenter = function() {
	TweenLite.to(document.getElementById('scene-home-settings'), 0.75, {width: 114});
	TweenLite.to(document.getElementById('home-settings-icon'), 0.75, {rotation: 180});
	TweenLite.to(document.getElementById('home-settings--toggle-drawing'), 0.75, {width: 89});
};
document.getElementById('scene-home-settings').onmouseleave = function() {
	TweenLite.to(document.getElementById('scene-home-settings'), 1, {width: 25, ease: Power4.easeInOut});
	TweenLite.to(document.getElementById('home-settings-icon'), 1, {rotation: 0, ease: Power4.easeInOut});
	TweenLite.to(document.getElementById('home-settings--toggle-drawing'), 1, {width: 0, ease: Power4.easeInOut});
};

document.getElementById('home-settings--toggle-drawing').onclick = function() {toggleCanvasDrawing();};

function toggleCanvasDrawing() {
	canvasRunning = !canvasRunning;
	if (!canvasRunning) {
		disableButtonText.innerHTML = "<strike>Canvas Painting</strike>";
	} else {
		disableButtonText.innerHTML = "<u>Canvas Painting</u>";
		if (!canvasUpdating && canvasRunning) {
			update();
		}
	}
};

// ================================================================================================ Spacebar Press Initialization =====

// Spacebar acts like pressing 'Toggle Canvas Drawing' button
document.onkeypress = function(e) {
	e = e || window.event;

	console.log("e.keyCode: " + e.keyCode);

	// pressing 'spacebar'
	if (e.keyCode == 32) {
		// toggleCanvasDrawing();
		canvasFlush = !canvasFlush;

		// Pressing 'e' key
	} else if (e.keyCode == 101) {
		if (wisps.length > 0) {
			if (wisps[0].state == STATE_EXPLODED) {
				wisps[0].reform();
			} else if (wisps[0].state == STATE_NONE) {
				wisps[0].explode();
			}
		}

		// Pressing 'p' key
	} else if (e.keyCode == 112) {
		if (wisps.length > 0) {
			if (wisps[0].state == STATE_PHASED) {
				wisps[0].phaseIn();
			} else if (wisps[0].state == STATE_NONE) {
				wisps[0].phaseOut();
			}
		}
	}
};


// ============================================================================================= Canvas Resizing on Window Resize =====

function homeRefit() {
	// Called by base.js on window resize
	canvas_bg.width = homeScene.offsetWidth;
	canvas_bg.height = homeScene.offsetHeight;
	canvas_circle.width = homeScene.offsetWidth;
	canvas_circle.height = homeScene.offsetHeight;

	positionCirclesToFrameRadius();
	masterCircleContext.clearRect(0, 0, canvas_bg.width, canvas_bg.height);
	drawCirclesMasterCircle();
	if (!canvasUpdating) {
		// spinCircles();
	}

	Particle.entitiesDraw();
}

// ======================================================================================================================== Clock =====
window.requestAnimFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
			window.setTimeout(callback, RENDER_HERTZ);
	};

function update(delta) {
	if (canvasFlush) {
		canvasMasterContext.clearRect(0, 0, canvas_bg.width, canvas_bg.height);
	}

	// spinCircles();
	// console.log("Update call with orb selected: " + selectedOrb + ". dT: " + delta);

	// if (mouse.px != 0 && mouse.py != 0 && selectedOrb != -1)
	// 	Particle.spawnEntityArray(mouse.x, mouse.y, mouse.x - mouse.px, mouse.y - mouse.py, selectedOrb, canvasMasterContext);
	// Particle.entitiesDraw();
	// Particle.entitiesUpdate();
	// Particle.entitiesFlush();

	for (var b = 0; b < Blocker.blockers.length; b++) {
		Blocker.blockers[b].render();
	}

	// Wisp Rendering!
	for (var w = 0; w < wisps.length; w++) {
		wisps[w].render();
		wisps[w].update();
	}
	// if (selectedOrb == 4) {
	// 	Tunnel.tunnelBuilder.update();
	// }
	if (canvasRunning && canvasDrawing) { // && (canvasDrawing || Particle.entityArray.length != 0)) {
		window.requestAnimFrame(update);
		canvasUpdating = true;
	} else {
		canvasUpdating = false;
	}
}
// ======================================================================================================================= Launch =====

(function start() {
	canvasMasterContext = canvas_bg.getContext('2d');
	masterCircleContext = canvas_circle.getContext('2d');

	canvas_bg.width = homeScene.offsetWidth;
	canvas_bg.height = homeScene.offsetHeight;
	canvas_circle.width = homeScene.offsetWidth;
	canvas_circle.height = homeScene.offsetHeight;

	// initializeCircles();
	// drawCirclesMasterCircle()
	update();

	wisps.push(new Wisp(canvas_bg.width/2, canvas_bg.height/2, canvasMasterContext));
	new Blocker([200, 300, 300, 200], [200, 200, 300, 300], canvasMasterContext);
	new Blocker([400, 450, 430, 390], [270, 290, 310, 290], canvasMasterContext);
	new Blocker([300, 380, 370, 280], [480, 499, 520, 490], canvasMasterContext);
	new Blocker([350, 440, 430, 340], [358, 390, 420, 370], canvasMasterContext);
	new Blocker([480, 500, 510, 470], [400, 390, 450, 445], canvasMasterContext);
	new Blocker([480, 500, 510, 470], [300, 290, 350, 345], canvasMasterContext);
	new Blocker([480, 500, 510, 470], [200, 190, 250, 245], canvasMasterContext);
	new Blocker([600, 700, 700, 600], [200, 200, 300, 300], canvasMasterContext);
	new Blocker([600, 650, 630, 590], [470, 490, 510, 490], canvasMasterContext);

	mouseTracker.onmousedown = function (e) {
		// canvasFlush = !canvasFlush;
		for (x = 0; x < wisps.length; x++) {
			wisps[x].setWaypoint(mouse.x, mouse.y); // Wisp!!!!
		}
	};

	mouseTracker.onmouseenter = function (e) {
		canvasDrawing = true;
		if (!canvasUpdating && canvasRunning) {
			update();
		}
	};

	mouseTracker.onmouseleave = function (e) {
		mouse.x = 0;
		mouse.y = 0;
	};

	var TERMINAL_VELOCITY = 24;
  mouseTracker.onmousemove = function (e) {
		if (canvasRunning && mouseReady) {
			var rect   = mouseTracker.getBoundingClientRect();
			mouse.px   = mouse.x;
			mouse.py   = mouse.y;
			mouse.x    = Math.floor(e.clientX - rect.left);
			mouse.y    = e.clientY - rect.top;
			// console.log("Get Mouse Move.");
			// console.log("    Previously:");
			// console.log("    (" + mouse.px + "," + mouse.py + ")");
			// console.log("    Currently:");
			// console.log("    (" + mouse.x + "," + mouse.y + ")");
			clearTimeout(mouse.stopTimer);
			mouse.stopTimer = setTimeout(function(){mouse.zeroVelocity();}, 250);
			// Reset mouse cooldown period
			mouseReady = false;
			clearTimeout(mouseClock);
			mouseClock = setTimeout(function(){mouseReady = true}, MOUSE_HERTZ);
		}
		e.preventDefault();
  };

  mouseTracker.oncontextmenu = function (e) {
      e.preventDefault();
  };
})();
