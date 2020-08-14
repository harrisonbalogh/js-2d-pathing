// Classes in JavaScript are not hoisted. All other variables/functions are lifted to the top of their scope for order-less reference
// So order matters for 'class' declarations
// ==================================================================================================================== Variables =====

let RENDER_HERTZ = 1000 / 60 // Render update speed
const RENDER_SCALING = 2
let canvasRunning = true // when the GUI setting is enabled or not. Override drawing.
let canvasUpdating = false // if update has yet to resume
let canvasFlush = true // if drawing frames are cleared or retained
let canvas_bg = document.getElementById("bgCanvas");
let canvasMasterContext = canvas_bg.getContext('2d') // The primary canvas particles are drawn on
let draggingParallelLines = false;
let showingParallelSetters = false;
let usingTopParallelSetter = false;
let usingLeftParallelSetter = false;
let origin = new Point(0, 0);
let to = new Point(0, 0);
let boundsBlocker = undefined
let mouse = new Point(0, 0)
let mouseLabelsVisible = true;
let editingBlockers = false;
let gridify = false;
let optimizeGridify = false;

canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

// ================================================================================================ Settings Initialization =====
// document.getElementById('setting-item-updateToggle').onclick = toggleCanvasRunning
document.getElementById('setting-item-updateToggle').onclick = function(){settingToggle(this, toggleCanvasRunning)}
document.getElementById('setting-item-mouseLabelToggle').onclick = function(){settingToggle(this, toggleMouseLabel)}
document.getElementById('setting-item-smearToggle').onclick = function(){settingToggle(this, toggleSmearRendering)}
document.getElementById('setting-item-randomizerToggle').onclick = function(){settingToggle(this, toggleRandomizer)}
document.getElementById('setting-item-parallelLinesToggle').onclick = function(){settingToggle(this, toggleParallelLines)}
document.getElementById('setting-item-editMode').onclick = function(){settingToggle(this, toggleEditMode)}
document.getElementById('setting-item-gridified').onclick = function(){settingToggle(this, toggleGridified)}
document.getElementById('setting-item-optimize').onclick = function(){settingToggle(this, toggleOptimizeGrid)}

function settingToggle(elem, logic) {
  elem.className = elem.className == "active" ? "" : "active"
  logic()
}
function toggleCanvasRunning() {
  canvasRunning = !canvasRunning
  if (!canvasUpdating && canvasRunning) update()
}
function toggleMouseLabel() {
  mouseLabelsVisible = !mouseLabelsVisible
}
function toggleSmearRendering() {
  canvasFlush = !canvasFlush
}
function toggleRandomizer() {
  randomizingPaths = !randomizingPaths;
  clearTimeout(randomizerClock);
  if (randomizingPaths) randomizeMousePoint();
}
function toggleParallelLines() {
  showingParallelSetters = !showingParallelSetters
}
function toggleEditMode() {
  editingBlockers = !editingBlockers
  if (!editingBlockers) {
    Blocker.finishConstruction(true)
    if (gridify) generateGrid()
  }
}
function toggleGridified() {
  gridify = !gridify;
  if (gridify) generateGrid()
}
function toggleOptimizeGrid() {
  optimizeGridify = !optimizeGridify
  if (gridify) generateGrid()
}

// =================================================================================================================== Test stuff =====
let test_points = [];
let test_lines = [];
let test_circles = [];
let test_polygons = [];
let contentOut = document.getElementById("content-output")
let contentOutScrolling = false
let contentOutTrackLastMouseMove = 0
let print_data = []
const RANDOMIZER_HERTZ = 0.05 * 1000;
let randomizerClock = null;
let randomizingPaths = false;
let lastSideChosen = 0;

function randomizeMousePoint() {
  if (!randomizingPaths) return

  lastSideChosen = (lastSideChosen + 1 + Math.floor(Math.random() * 2)) % 4;
  mouse = new Point(Math.floor(Math.random() * canvas_bg.width), Math.floor(Math.random() * canvas_bg.height))

  if (lastSideChosen == 0) mouse.y = 0
  else if (lastSideChosen == 1) mouse.x = canvas_bg.width
  else if (lastSideChosen == 2) mouse.y = canvas_bg.height
  else if (lastSideChosen == 3) mouse.x = 0
  origin = new Point(to.x, to.y);
  to = new Point(mouse.x, mouse.y)

  randomizerClock = setTimeout(() => { randomizeMousePoint(); }, RANDOMIZER_HERTZ);
}
function testLine(a, b, flush = false) {
  if (flush) test_lines = []
  test_lines.push( {a: a, b: b, color: "rgb(44,54,64)"} );
}
function testPoint(x, y, flush = false) {
  if (flush) test_points = []
  test_points.push( {x: x, y: y, color:  "rgb(44,54,64)"} );
}
function testCircle(x, y, r, flush = false) {
  if (flush) test_circles = []
  test_circles.push( {x: x, y: y, r: r, color:  "rgb(44,54,64)"});
}
function renderTestShapes() {
  test_circles.forEach(circle => {
    canvasMasterContext.strokeStyle = circle.color;
    canvasMasterContext.beginPath();
    canvasMasterContext.arc(circle.x, circle.y, circle.r, 0, 2 * Math.PI, false);
    canvasMasterContext.stroke();
  });
  test_lines.forEach(line => {
    canvasMasterContext.strokeStyle = line.color;
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(line.a.x, line.a.y);
    canvasMasterContext.lineTo(line.b.x, line.b.y);
    canvasMasterContext.stroke();
  })
  test_points.forEach(point => {
    canvasMasterContext.fillStyle = point.color;
    canvasMasterContext.beginPath();
    canvasMasterContext.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
    canvasMasterContext.fill();
  })
  if (mouseLabelsVisible) {
    canvasMasterContext.fillStyle = "black"
    canvasMasterContext.font = '20px sans-serif';
    canvasMasterContext.fillText(mouse.x+', '+mouse.y, mouse.x+5, mouse.y-5);
  }
  if (showingParallelSetters) {
    let tSX = 80; // topSetterX    // Inversed for left setter
    let tSY = 14; // topSetterY
    let tSH = 20; // topSetterHeight
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
  canvasMasterContext.strokeStyle = "rgb(80, 180, 80)";
  canvasMasterContext.fillStyle = "rgb(80, 180, 80)";
  canvasMasterContext.font = '16px sans-serif';

  print_data.forEach(data => {
    if (data instanceof Ray) {
      data = new Segment(data.origin, new Point(999999 * Math.cos(data.angle), 999999 * Math.sin(data.angle)))
    } else
    if (data instanceof Blocker) {
      data = data.polygon
    } else
    if (data instanceof Vector) {
      data = new Point(data.x(), data.y())
    }

    if (data instanceof Segment) {
      canvasMasterContext.beginPath()
      canvasMasterContext.arc(data.a().x, data.a().y, 4, 0, 2 * Math.PI, false)
      canvasMasterContext.stroke()
      canvasMasterContext.beginPath()
      canvasMasterContext.arc(data.b().x, data.b().y, 4, 0, 2 * Math.PI, false)
      canvasMasterContext.fill()
      canvasMasterContext.beginPath()
      canvasMasterContext.moveTo(data.a().x, data.a().y)
      canvasMasterContext.lineTo(data.b().x, data.b().y)
      canvasMasterContext.stroke()
      canvasMasterContext.fillText(data.a().print(), data.a().x+5, data.a().y - 5)
      canvasMasterContext.fillText(data.b().print(), data.b().x+5, data.b().y - 5)
    } else
    if (data instanceof Point) {
      canvasMasterContext.beginPath();
      canvasMasterContext.arc(data.x, data.y, 4, 0, 2 * Math.PI, false);
      canvasMasterContext.fill();
      canvasMasterContext.fillText(data.print(), mouse.x + 5, mouse.y - 5);
      canvasMasterContext.fillText(data.print(), data.x + 5, data.y - 5);
    } else
    if (data instanceof Polygon) {
      data.vertices.forEach((vertex, vIndex) => {
        let cirleRadius = vIndex == 1 || vIndex == 0 ? 4 : 2
        canvasMasterContext.beginPath();
        canvasMasterContext.arc(vertex.x, vertex.y, cirleRadius, 0, 2 * Math.PI, false);
        if (vIndex == 0) canvasMasterContext.stroke();
        else canvasMasterContext.fill()
      })
      canvasMasterContext.fillStyle = "rgba(80, 180, 80, 0.2)";
      canvasMasterContext.beginPath();
      canvasMasterContext.moveTo(data.vertices[0].x, data.vertices[0].y);
      data.vertices.forEach(vertex => canvasMasterContext.lineTo(vertex.x, vertex.y))
      canvasMasterContext.lineTo(data.vertices[0].x, data.vertices[0].y);
      if (!data.counterclockwise) canvasMasterContext.fill()
      canvasMasterContext.stroke();
    }
  })
}
contentOut.onmousemove = e => {
  let offsetY = contentOut.offsetTop
  contentOutTrackLastMouseMove = e.clientY - offsetY
  contentOutScrolling = (e.clientY > offsetY + contentOut.offsetHeight - 30);
}
contentOut.onmouseleave = () => {
  contentOutScrolling = false;
}
contentOut.onscroll = () => {
  let y = contentOutTrackLastMouseMove + contentOut.scrollTop
  let listItems = contentOut.children
  for (let i = 0; i < listItems.length; i++) {
    let listItem = listItems[i]
    if (listItem.offsetTop < y && listItem.offsetTop + listItem.offsetHeight > y) {
      listItem.dispatchEvent(new Event('mouseenter'))
      break
    }
  }
}
/**
 * Text is required and will be placed into the output list in its own list item.
 * Optional parameter 'data' can be an array with segments, points, vectors, rays, polygons, and blockers.
 * Passing true or false into the optional 'flush' argument will clear all output before printing the text.
 */
function print(text, data, flush) {
  if (randomizingPaths || draggingParallelLines) { return; }

  // Optional(overloaded) parameter handling...
  if (!Array.isArray(data)) {
    if (typeof data == typeof true) flush = data;
    data = [];
  } else flush = flush || false;
  let li = document.createElement("li");

  li.innerHTML = text;
  li.onmouseenter = () => print_data = data
  li.onmouseleave = () => print_data = []
  if (flush) {
    contentOut.innerHTML = "";
    contentOut.appendChild(li);
  } else {
    contentOut.appendChild(li);
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
  canvasUpdating = true
  if (canvasFlush) canvasMasterContext.clearRect(0, 0, canvas_bg.width, canvas_bg.height)

  Blocker.blockers.forEach(blocker =>  blocker.render(canvasMasterContext))
  if (editingBlockers) Blocker.constructionRender(canvasMasterContext)
  if (gridify && !editingBlockers) drawGrid(canvasMasterContext)
  if (contentOutScrolling) contentOut.scrollTop += 1

  renderTestShapes()

  if (canvasRunning) window.requestAnimFrame(update)
  else canvasUpdating = false
}

// ======================================================================================================================= Launch =====

document.onkeypress = e => {
  e = e || window.event;
  // pressing 'spacebar'
  if (e.keyCode == 32) {
    // toggleCanvasRunning();
    toggleCanvasRunning();
  }
}

bgCanvas.onmousedown = e => {
  if (editingBlockers) {
    if (e.button === 0) {  // Left click add vertex
      Blocker.constsructingVertices.push(new Point(mouse.x, mouse.y));
    } else { // Right click finish vertex
      Blocker.finishConstruction();
    }
    return
  }

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

  if (e.button === 0) { // Left click origin point
    origin = new Point(mouse.x, mouse.y)
  } else { // Right click destination point
    to = new Point(mouse.x, mouse.y)
  }

  if (!editingBlockers && gridify) {
    test_lines = []
    test_circles = []
    test_points = []

    let polygons = getRoute(origin, to)
    cache_triangulation.forEach(polygon => {
      if (polygons.indexOf(polygon) == -1) {
        polygon.highlighted = false
      } else {
        polygon.highlighted = true
      }
    })
    testLine(origin, to)
    testPoint(origin.x, origin.y)
    testPoint(to.x, to.y)
  }
}

bgCanvas.onmouseup = e => { draggingParallelLines = false; }

bgCanvas.onmousemove = e => {
  if (canvasRunning) {
    let rect = bgCanvas.getBoundingClientRect();
    mouse = new Point(RENDER_SCALING * Math.floor(e.clientX - rect.left), RENDER_SCALING * (e.clientY - rect.top))

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
    } else if (!editingBlockers) {
      // Drag pathing
      if (e.buttons === 1 || e.buttons == 2) {
        if (e.buttons === 1) {
          origin = new Point(mouse.x, mouse.y)
        } else if (e.buttons == 2) {
          to = new Point(mouse.x, mouse.y)
        }

        if (!editingBlockers && gridify) {
          test_lines = []
          test_circles = []
          test_points = []

          let polygons = getRoute(origin, to, false)
          cache_triangulation.forEach(polygon => {
            if (polygons.indexOf(polygon) == -1) {
              polygon.highlighted = false
            } else {
              polygon.highlighted = true
            }
          })
          testLine(origin, to)
          testPoint(origin.x, origin.y)
          testPoint(to.x, to.y)
        }
      }
    }
  }
  e.preventDefault()
}

bgCanvas.oncontextmenu = e => e.preventDefault()

function homeRefit() {
  canvas_bg.width = canvas_bg.offsetWidth * RENDER_SCALING;
  canvas_bg.height = canvas_bg.offsetHeight * RENDER_SCALING;
}

{
  canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
  canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

  boundsBlocker = new Blocker([
    new Point(15, 15),
    new Point(15, canvas_bg.height - 15),
    new Point(canvas_bg.width - 15, canvas_bg.height - 15),
    new Point(canvas_bg.width - 15, 15)
  ])
  new Blocker([
    new Point(200, 200),
    new Point(300, 200),
    new Point(300, 300),
    new Point(200, 300)
  ])
  new Blocker([
    new Point(220, 160),
    new Point(230, 160),
    new Point(230, 210),
    new Point(220, 210)
  ])
  new Blocker([
    new Point(280, 160),
    new Point(290, 160),
    new Point(290, 210),
    new Point(280, 210)
  ])
  new Blocker([
    new Point(220, 160),
    new Point(290, 160),
    new Point(290, 170),
    new Point(220, 170)
  ])
  new Blocker([
    new Point(400, 270),
    new Point(450, 290),
    new Point(430, 310),
    new Point(390, 290)
  ])
  new Blocker([
    new Point(300, 480),
    new Point(480, 499),
    new Point(370, 600),
    new Point(280, 560)
  ])
  new Blocker([
    new Point(350, 358),
    new Point(440, 390),
    new Point(430, 420),
    new Point(340, 370)
  ])
  new Blocker([
    new Point(480, 400),
    new Point(500, 390),
    new Point(510, 450),
    new Point(470, 445)
  ])
  new Blocker([
    new Point(480, 300),
    new Point(500, 290),
    new Point(510, 350),
    new Point(470, 345)
  ])
  new Blocker([
    new Point(480, 200),
    new Point(500, 190),
    new Point(510, 250),
    new Point(470, 245)
  ])
  new Blocker([
    new Point(600, 200),
    new Point(700, 200),
    new Point(700, 300),
    new Point(600, 300)
  ])
  new Blocker([
    new Point(675, 175),
    new Point(775, 175),
    new Point(775, 300),
    new Point(675, 275)
  ])
  new Blocker([
    new Point(650, 250),
    new Point(750, 250),
    new Point(750, 350),
    new Point(650, 350)
  ])
  new Blocker([
    new Point(600, 470),
    new Point(650, 490),
    new Point(630, 510),
    new Point(590, 490)
  ])
  new Blocker([
    new Point(600, 480),
    new Point(725, 500),
    new Point(705, 520),
    new Point(665, 500)
  ])
  new Blocker([
    new Point(500, 600),
    new Point(800, 600),
    new Point(810, 620),
    new Point(490, 620)
  ])
  new Blocker([
    new Point(60, 800),
    new Point(100, 823),
    new Point(96, 884),
    new Point(58, 886)
  ])
}

update()