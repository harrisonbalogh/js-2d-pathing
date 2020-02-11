// Handles dynamic canvas drawing on the background of the home "scene"

// Classes in JavaScript are not hoisted. All other variables/functions are lifted to the top of their scope for order-less reference
// So order matters for 'class' declarations
// ==================================================================================================================== Variables =====

var MOUSE_HERTZ = 20;
var mouseClock = null;
var mouseReady = true;

var RENDER_HERTZ = 1000 / 60; // Render update speed
var canvasRunning = true; // when the GUI setting is enabled or not. Override drawing.
var canvasDrawing = true; // when the cursor is within the canvas bounds. Optimize drawing.
var canvasUpdating = false; // if update has yet to resume
var canvasFlush = true; // if drawing frames are cleared or retained
var canvasMasterContext; // The primary canvas particles are drawn on

var wisps = []

var waypoints = [];
var origin = new Point(0, 0);
var to = new Point(0, 0);

// ID references
var homeScene = document.getElementById('scene-home');
var canvas_bg = document.getElementById("bgCanvas");

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

const RENDER_SCALING = 1

// ================================================================================================ Settings Initialization =====
var setting_updateToggle = document.getElementById('setting-item-updateToggle');
var setting_smearToggle = document.getElementById('setting-item-smearToggle');
var setting_randomizerToggle = document.getElementById('setting-item-randomizerToggle');
var setting_parallelLinesToggle = document.getElementById('setting-item-parallelLinesToggle');
var setting_mouseLabelToggle = document.getElementById('setting-item-mouseLabelToggle');
var setting_wispToggle = document.getElementById('setting-item-wispToggle');
var setting_editMode = document.getElementById('setting-item-editMode');

setting_updateToggle.onclick = toggleCanvasDrawing;
setting_mouseLabelToggle.onclick = toggleMouseLabel;
setting_smearToggle.onclick = toggleSmearDrawing;
setting_randomizerToggle.onclick = toggleRandomizer;
setting_parallelLinesToggle.onclick = toggleParallelLines;
setting_wispToggle.onclick = toggleWisp;
setting_editMode.onclick = toggleEditMode;

var mouseLabelsVisible = true;
function toggleCanvasDrawing() {
	canvasRunning = !canvasRunning;
	if (!canvasRunning) {
		// Is not drawing
		setting_updateToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
	} else {
		// Is drawing
		setting_updateToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
		if (!canvasUpdating && canvasRunning) {
			update();
		}
	}
};
function toggleMouseLabel() {
	mouseLabelsVisible = !mouseLabelsVisible;
	if (mouseLabelsVisible) {
		setting_mouseLabelToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
	} else {
		setting_mouseLabelToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
	}
};
function drawMouseLabel() {
	if (mouseLabelsVisible) {
		canvasMasterContext.font = '20px sans-serif';
	  canvasMasterContext.fillText(mouse.x+', '+mouse.y, mouse.x+5, mouse.y-5);
	}
}
/**
 * To clean smear visuals, this array tracks blockers that have already been rendered when
 * smearing is active. This will prevent them from redrawing on top of themselves which produces
 * sharp pixelated renders.
 */
let smearClean_blockersRendered = [];
function toggleSmearDrawing() {
	canvasFlush = !canvasFlush;
	if (!canvasFlush) {
		setting_smearToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
		smearClean_blockersRendered = [];
	} else {
		setting_smearToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
	}
};

var RANDOMIZER_HERTZ = 0.05 * 1000;
var randomizerClock = null;
var randomizingPaths = false;
var editingBlockers = false;
var lastSideChosen = 0;

function toggleRandomizer() {
	randomizingPaths = !randomizingPaths;
	if (!randomizingPaths) {
		setting_randomizerToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
		clearTimeout(randomizerClock);
	} else {
		setting_randomizerToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
		clearTimeout(randomizerClock);
		randomizeMousePoint();
	}
};

function randomizeMousePoint() {
	if (randomizingPaths) {

		lastSideChosen = (lastSideChosen + 1 + Math.floor(Math.random() * 2)) % 4;
		mouse.x = Math.floor(Math.random() * canvas_bg.width);
		mouse.y = Math.floor(Math.random() * canvas_bg.height);

		mouse.px = mouse.x;
		mouse.py = mouse.y;
		if (lastSideChosen == 0) {
			mouse.y = 0;
		} else
		if (lastSideChosen == 1) {
			mouse.x = canvas_bg.width;
		} else
		if (lastSideChosen == 2) {
			mouse.y = canvas_bg.height
		} else
		if (lastSideChosen == 3) {
			mouse.x = 0;
		}
		origin = new Point(to.x, to.y);
		to = new Point(mouse.x, mouse.y)
		waypoints = pathGen(origin, to, {blockers: Blocker.blockers});

		for (var w = 0; w < waypoints.length-1; w++) {
			testLine(waypoints[w], waypoints[w+1]);
		}

		// Only change code above this line within this function. Following line is for looping.
		randomizerClock = setTimeout(function() { randomizeMousePoint(); }, RANDOMIZER_HERTZ);
	}
}

var draggingParallelLines = false;
var showingParallelSetters = true;
var usingTopParallelSetter = false;
var usingLeftParallelSetter = false;
var PARALLEL_SETTER_TOP_X = 80;
var PARALLEL_SETTER_TOP_Y = 14;
var PARALLEL_SETTER_TOP_H = 20;

function toggleParallelLines() {
	showingParallelSetters = !showingParallelSetters;
	if (!showingParallelSetters) {
		setting_parallelLinesToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
	} else {
		setting_parallelLinesToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
	}
};

function toggleEditMode() {
	editingBlockers = !editingBlockers;
	if (editingBlockers) {
		setting_editMode.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
	} else {
		setting_editMode.style.backgroundImage = "url(images/icon_settings@2x.png)";
		Blocker.finishConstruction(true);
	}
}

function drawParallelSetters() {
	if (showingParallelSetters) {
		var tSX = PARALLEL_SETTER_TOP_X; // topSetterX		// Inversed for left setter
		var tSY = PARALLEL_SETTER_TOP_Y; // topSetterY
		var tSH = PARALLEL_SETTER_TOP_H; // topSetterHeight
		canvasMasterContext.strokeStyle = "rgb(44,54,64)";
		// Top Setter
		canvasMasterContext.beginPath();
		canvasMasterContext.moveTo(tSX, tSY);
		canvasMasterContext.lineTo(canvas_bg.width-tSX, tSY);
		canvasMasterContext.arc(canvas_bg.width-tSX, tSY+tSH/2, tSH/2, -Math.PI/2, Math.PI/2, false);
		canvasMasterContext.lineTo(tSX, tSY+tSH);
		canvasMasterContext.arc(tSX, tSY+tSH/2, tSH/2, Math.PI/2, -Math.PI/2, false);
		canvasMasterContext.stroke();
		if (usingTopParallelSetter) {
			canvasMasterContext.fillStyle = "rgb(44,54,64)";
			canvasMasterContext.beginPath();
			canvasMasterContext.arc(to.x, tSY+tSH/2, tSH/2, 0, Math.PI*2, false);
			canvasMasterContext.fill();
		}
		// Left Setter
		canvasMasterContext.beginPath();
		canvasMasterContext.moveTo(tSY, tSX);
		canvasMasterContext.lineTo(tSY, canvas_bg.height-tSX);
		canvasMasterContext.arc(tSY+tSH/2, canvas_bg.height-tSX, tSH/2, Math.PI, 0, true);
		canvasMasterContext.lineTo(tSY+tSH, tSX);
		canvasMasterContext.arc(tSY+tSH/2, tSX, tSH/2, 0, -Math.PI, true);
		canvasMasterContext.stroke();
		if (usingLeftParallelSetter) {
			canvasMasterContext.fillStyle = "rgb(44,54,64)";
			canvasMasterContext.beginPath();
			canvasMasterContext.arc(tSY+tSH/2, to.y, tSH/2, 0, Math.PI*2, false);
			canvasMasterContext.fill();
		}
	}
}
function toggleWisp() {
	if (wisps.length > 0) {
		if (wisps[0].state == STATE_EXPLODED) {
			setting_wispToggle.style.backgroundImage = "url(images/icon_settings_x@2x.png)";
			for (x = 0; x < wisps.length; x++) {
				wisps[x].reform();
			}
		} else if (wisps[0].state == STATE_NONE) {
			setting_wispToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
			for (x = 0; x < wisps.length; x++) {
				wisps[x].explode();
			}
		}
	} else {
		setting_wispToggle.style.backgroundImage = "url(images/icon_settings@2x.png)";
	}
};

// ================================================================================================ Spacebar Press Initialization =====

document.onkeypress = function(e) {
	e = e || window.event;
	// pressing 'spacebar'
	if (e.keyCode == 32) {
		// toggleCanvasDrawing();
		toggleCanvasDrawing();

		// Pressing 'e' key
	} else if (e.keyCode == 101) {
		toggleWisp();

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


// ============================================================================================== Canvas Resizing on Window Resize =====

function homeRefit() {
	// Called by base.js on window resize
	canvas_bg.width = canvas_bg.offsetWidth*2;
	canvas_bg.height = canvas_bg.offsetHeight*2;

	Particle.entitiesDraw();
}

// =================================================================================================================== Test stuff =====
var test_points = [];
var test_lines = [];
var test_circles = [];

function testLine(a, b, color = "rgb(44,54,64)") {
	test_lines.push( {a: a, b: b, color: color} );
}
function testPoint(x, y, color = "rgb(44,54,64)") {
	test_points.push( {x: x, y: y, color: color} );
}
function testCircle(x, y, r, color = "rgb(44,54,64)") {
	test_circles.push( {x: x, y: y, r: r, color: color});
}
function drawTestCircles() {
	test_circles.forEach(function(circle) {
		canvasMasterContext.strokeStyle = circle.color;
		canvasMasterContext.beginPath();
		canvasMasterContext.arc(circle.x, circle.y, circle.r, 0, 2 * Math.PI, false);
		canvasMasterContext.stroke();
	});
}
function drawTestLines() {
	test_lines.forEach(function(line) {
		canvasMasterContext.strokeStyle = line.color;
		canvasMasterContext.beginPath();
		canvasMasterContext.moveTo(line.a.x, line.a.y);
		canvasMasterContext.lineTo(line.b.x, line.b.y);
		canvasMasterContext.stroke();
	});
}
function drawTestPoints() {
	test_points.forEach(function(point) {
		canvasMasterContext.fillStyle = point.color;
	  canvasMasterContext.beginPath();
	  canvasMasterContext.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
	  canvasMasterContext.fill();
	});
}

var contentOut = document.getElementById("content-output");
var contentOutScrolling = false;
contentOut.onmousemove = e => {
	let y  = (e.clientY - contentOut.offsetTop);
	contentOutScrolling = (y > contentOut.offsetHeight);
};
contentOut.onmouseleave = () => {
	contentOutScrolling = false;
}
var date = new Date();
print_data = [];
function drawPrintData() {
	canvasMasterContext.strokeStyle = "Green";
	canvasMasterContext.fillStyle = "Green";
	canvasMasterContext.font = '16px sans-serif';
	for (var p = 0; p < print_data.length; p++) {
		if (print_data[p].a != undefined && print_data[p].b != undefined) {
			// This is a segment
			canvasMasterContext.beginPath();
			canvasMasterContext.arc(print_data[p].a.x, print_data[p].a.y, 4, 0, 2 * Math.PI, false);
			canvasMasterContext.fill();
			canvasMasterContext.beginPath();
			canvasMasterContext.arc(print_data[p].b.x, print_data[p].b.y, 4, 0, 2 * Math.PI, false);
			canvasMasterContext.fill();
			canvasMasterContext.beginPath();
			canvasMasterContext.moveTo(print_data[p].a.x, print_data[p].a.y);
			canvasMasterContext.lineTo(print_data[p].b.x, print_data[p].b.y);
			canvasMasterContext.stroke();
			canvasMasterContext.fillText(print_data[p].a.print(), print_data[p].a.x+5, print_data[p].a.y-5);
			canvasMasterContext.fillText(print_data[p].b.print(), print_data[p].b.x+5, print_data[p].b.y-5);
		} else if (print_data[p].x != undefined && print_data[p].y != undefined) {
			// This is a vector (or point)
			canvasMasterContext.beginPath();
			canvasMasterContext.arc(print_data[p].x, print_data[p].y, 4, 0, 2 * Math.PI, false);
			canvasMasterContext.fill();
			canvasMasterContext.fillText(print_data[p].print(), mouse.x+5, mouse.y-5);
			canvasMasterContext.fillText(print_data[p].print(), print_data[p].x+5, print_data[p].y-5);
		} else if (print_data[p] instanceof Blocker || print_data[p].vertices) {
			// This is a Blocker
			canvasMasterContext.beginPath();
			canvasMasterContext.moveTo(print_data[p].vertices[0].x, print_data[p].vertices[0].y);
			for (var x = 1; x < print_data[p].vertices.length; x++) {
				canvasMasterContext.lineTo(print_data[p].vertices[x].x, print_data[p].vertices[x].y);
			}
			canvasMasterContext.lineTo(print_data[p].vertices[0].x, print_data[p].vertices[0].y);
			canvasMasterContext.stroke();
		}
 	}
}
/**
 * Text is required and will be placed into the output list
 * in its own list item.
 * Optional parameter 'data' can be a mixed array of
 * segments, points, and blockers.
 * Passing true or false into the optional 'flush' argument
 * will clear all output before printing the text.
 */
function print(text, data, flush) {
	if (randomizingPaths || draggingParallelLines) { return; }
	// Optional(overloaded) parameter handling...
	if (!Array.isArray(data)) {
		if (typeof data == typeof true) flush = data;
		data = [];
	} else flush = flush || false;
	var li = document.createElement("li");
	// ...
	li.innerHTML = text;
	li.onmouseenter = function() { print_data = data; }
	li.onmouseleave = function() { print_data = [];   }
	if (flush) {
		contentOut.innerHTML = "";
		contentOut.appendChild(li);
	} else {
		contentOut.appendChild(li);
		// contentOut.insertBefore(li, contentOut.childNodes[0]);
	}
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
	if (contentOutScrolling) {
		contentOut.scrollTop += 2;
	}
	
	if (canvasFlush || (smearClean_blockersRendered.length == 0 && Blocker.blockers.length != 0)) {
		canvasMasterContext.clearRect(0, 0, canvas_bg.width, canvas_bg.height);
	}

	// Render blockers
	if (canvasFlush) {
		for (var b = 0; b < Blocker.blockers.length; b++) {
			Blocker.blockers[b].render(canvasMasterContext);
		}
	} else {
		// Special smear logic
		Blocker.blockers.forEach(blocker => {
			if (!smearClean_blockersRendered.includes(blocker)) {
				blocker.render(canvasMasterContext);
				smearClean_blockersRendered.push(blocker);
			}
		});
	}
	

	// Render Construction Vertices
	if (editingBlockers) {
		Blocker.constructionRender(canvasMasterContext);
	}

	// Wisp Rendering!
	// for (var w = 0; w < wisps.length; w++) {
	// 	wisps[w].render();
	// 	wisps[w].update();
	// }

	drawParallelSetters();
	drawMouseLabel();

	// Draw test points and lines... for path gen
	drawTestLines();
	drawTestPoints();
	drawTestCircles();
	drawPrintData();

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

	canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
	canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

	print("Harxer Pathfinding ("+(date.getUTCHours()+4)+":"+date.getUTCMinutes()+":"+date.getUTCSeconds()+").");

	update();

	new Blocker([
		new Point(200, 200),
		new Point(300, 200),
		new Point(300, 300),
		new Point(200, 300)
	]);
	new Blocker([
		new Point(220, 160),
		new Point(230, 160),
		new Point(230, 210),
		new Point(220, 210)
	]);
	new Blocker([
		new Point(280, 160),
		new Point(290, 160),
		new Point(290, 210),
		new Point(280, 210)
	]);
	new Blocker([
		new Point(220, 160),
		new Point(290, 160),
		new Point(290, 170),
		new Point(220, 170)
	]);
	new Blocker([
		new Point(400, 270),
		new Point(450, 290),
		new Point(430, 310),
		new Point(390, 290)
	]);
	new Blocker([
		new Point(300, 480),
		new Point(380, 499),
		new Point(370, 520),
		new Point(280, 490)
	]);
	new Blocker([
		new Point(350, 358),
		new Point(440, 390),
		new Point(430, 420),
		new Point(340, 370)
	]);
	new Blocker([
		new Point(480, 400),
		new Point(500, 390),
		new Point(510, 450),
		new Point(470, 445)
	]);
	new Blocker([
		new Point(480, 300),
		new Point(500, 290),
		new Point(510, 350),
		new Point(470, 345)
	]);
	new Blocker([
		new Point(480, 200),
		new Point(500, 190),
		new Point(510, 250),
		new Point(470, 245)
	]);
	new Blocker([
		new Point(600, 200),
		new Point(700, 200),
		new Point(700, 300),
		new Point(600, 300)
	]);
	new Blocker([
		new Point(675, 175),
		new Point(775, 175),
		new Point(775, 300),
		new Point(675, 275)
	]);
	new Blocker([
		new Point(650, 250),
		new Point(750, 250),
		new Point(750, 350),
		new Point(650, 350)
	]);
	new Blocker([
		new Point(600, 470),
		new Point(650, 490),
		new Point(630, 510),
		new Point(590, 490)
	]);
	new Blocker([
		new Point(600, 480),
		new Point(725, 500),
		new Point(705, 520),
		new Point(665, 500)
	]);
	new Blocker([
		new Point(500, 600),
		new Point(800, 600),
		new Point(810, 620),
		new Point(490, 620)
	]);

	// wisps.push(new Wisp(canvas_bg.width/2, canvas_bg.height/2, canvasMasterContext));

	bgCanvas.onmousedown = function (e) {
		if (editingBlockers) {
			if (e.button === 0) {
				// Left click add vertex
				Blocker.constsructingVertices.push(new Point(mouse.x, mouse.y));
			} else {
				// Right click finish vertex
				Blocker.finishConstruction();
			}
			return;
		}

		// canvasFlush = !canvasFlush;
		// for (x = 0; x < wisps.length; x++) {
		// 	wisps[x].setWaypoint(mouse.x, mouse.y); // Wisp!!!!
		// }

		// Check top parallel setter intersection
		if (showingParallelSetters) {
			if (
				PARALLEL_SETTER_TOP_X < mouse.x && mouse.x < (canvas_bg.width - PARALLEL_SETTER_TOP_X) &&
				PARALLEL_SETTER_TOP_Y < mouse.y && mouse.y < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H)
			) {
				draggingParallelLines = true;
				usingTopParallelSetter = true;
				usingLeftParallelSetter = false;
				return;
			} else
			if (
				PARALLEL_SETTER_TOP_Y < mouse.x && mouse.x < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H) &&
				PARALLEL_SETTER_TOP_X < mouse.y && mouse.y < (canvas_bg.height - PARALLEL_SETTER_TOP_X)
			) {
				draggingParallelLines = true;
				usingLeftParallelSetter = true;
				usingTopParallelSetter = false;
				return;
			} else {
				usingTopParallelSetter = false;
				usingLeftParallelSetter = false;
			}
		}

		if (e.button === 0) {
			// Left click origin point
			origin = new Point(mouse.x, mouse.y)
		} else {
			// Right click destination point
			to = new Point(mouse.x, mouse.y)
		}

		waypoints = pathGen(origin, to, {blockers: Blocker.blockers});

		if (waypoints.length <= 0) {
			print("Error: "+waypoints.length+" waypoints.");
		} else {
			for (var w = 0; w < waypoints.length-1; w++) {
				testLine(waypoints[w], waypoints[w+1]);
			}
		}
	};
	bgCanvas.onmouseup = function (e) {
		draggingParallelLines = false;
	}

	bgCanvas.onmouseenter = function (e) {
		canvasDrawing = true;
		if (!canvasUpdating && canvasRunning) {
			update();
		}
	};

	bgCanvas.onmouseleave = function (e) {
		mouse.x = 0;
		mouse.y = 0;
	};

	var TERMINAL_VELOCITY = 24;
  	bgCanvas.onmousemove = function (e) {
		if (canvasRunning && mouseReady) {
			var rect = bgCanvas.getBoundingClientRect();
			mouse.px = mouse.x;
			mouse.py = mouse.y;
			mouse.x  = RENDER_SCALING * Math.floor(e.clientX - rect.left);
			mouse.y  = RENDER_SCALING * (e.clientY - rect.top);
			clearTimeout(mouse.stopTimer);
			mouse.stopTimer = setTimeout(function(){mouse.zeroVelocity();}, 250);
			// Reset mouse cooldown period
			mouseReady = false;
			clearTimeout(mouseClock);
			mouseClock = setTimeout(function(){mouseReady = true}, MOUSE_HERTZ);
			// Parallel setter dragging
			if (draggingParallelLines) {
				if (usingTopParallelSetter) {
					origin.x = Math.min(Math.max(mouse.x, PARALLEL_SETTER_TOP_X), bgCanvas.width - PARALLEL_SETTER_TOP_X);
					origin.y = 0;
					to.x = Math.min(Math.max(mouse.x, PARALLEL_SETTER_TOP_X), bgCanvas.width - PARALLEL_SETTER_TOP_X);
					to.y = bgCanvas.height;
				} else
				if (usingLeftParallelSetter) {
					origin.x = 0;
					origin.y = Math.min(Math.max(mouse.y, PARALLEL_SETTER_TOP_X), bgCanvas.height - PARALLEL_SETTER_TOP_X);
					to.x = bgCanvas.width;
					to.y = Math.min(Math.max(mouse.y, PARALLEL_SETTER_TOP_X), bgCanvas.height - PARALLEL_SETTER_TOP_X);
				}
				waypoints = pathGen(origin, to, {blockers: Blocker.blockers});

				for (var w = 0; w < waypoints.length-1; w++) {
					testLine(waypoints[w], waypoints[w+1]);
				}
			} else if (!editingBlockers) {
				// Drag pathing
				if (e.buttons === 1 || e.buttons == 2) {
					if (e.buttons === 1) {
						origin = new Point(mouse.x, mouse.y)
					} else if (e.buttons == 2) {
						to = new Point(mouse.x, mouse.y)
					}
					waypoints = pathGen(origin, to, {blockers: Blocker.blockers});

					if (waypoints.length <= 0) {
						print("Error: "+waypoints.length+" waypoints.");
					} else {
						for (var w = 0; w < waypoints.length-1; w++) {
							testLine(waypoints[w], waypoints[w+1]);
						}
					}
				}
			}
		}
		e.preventDefault();
	};

	bgCanvas.oncontextmenu = function (e) {
		e.preventDefault();
	};

	// If no wisps were created at the start, initialize wisp button
	if (wisps.length == 0) {
		toggleWisp();
	}
})();
