import './Layout2D/Error.js'
import { Point } from './Layout2D/Geometry.js'
import * as Layout from './Layout2D/Layout.js'
import { renderLogData, disableLogging, selectLogNext, selectLogPrev, setup as logSetup } from './log.js'
import log from './log.js'

// Classes in JavaScript are not hoisted! Variables/functions are lifted to the top of their scope for order-less reference
// ==================================================================================================================== Variables =====
let RENDER_HERTZ = 1000 / 60 // Render update speed
const RENDER_SCALING = 2
let canvasRunning = true // when the GUI setting is enabled or not. Override drawing.
let canvasUpdating = false // if update has yet to resume
let canvasFlush = true // if drawing frames are cleared or retained
let canvas_bg = document.getElementById("bgCanvas")
let canvasMasterContext = canvas_bg.getContext('2d') // The primary canvas particles are drawn on
let parallelBarsVisible = false;
let parallelBarDragging = {top: false, left: false}
export let mouse = {
  loc: new Point(0, 0),
  lastLeftClick: new Point(0, 0),
  lastRightClick: new Point(0, 0)
}
let mouseLabelsVisible = true;
let editingBlockers = false;
let editingBlockersSmooth = false;
let editingBlockersSmoothTracking = false;
let gridify = false;

canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

// ================================================================================================ Settings Initialization =====
document.getElementById('setting-item-updateToggle').onclick = function(){settingToggle(this, toggleCanvasRunning)}
document.getElementById('setting-item-mouseLabelToggle').onclick = function(){settingToggle(this, toggleMouseLabel)}
document.getElementById('setting-item-smearToggle').onclick = function(){settingToggle(this, toggleSmearRendering)}
document.getElementById('setting-item-randomizerToggle').onclick = function(){settingToggle(this, toggleRandomizer)}
document.getElementById('setting-item-parallelLinesToggle').onclick = function(){settingToggle(this, toggleParallelLines)}
document.getElementById('setting-item-editMode').onclick = function(){settingToggle(this, toggleEditMode)}
document.getElementById('setting-item-editMode-smooth').onclick = function(){settingToggle(this, toggleEditModeSmooth)}
document.getElementById('setting-item-gridified').onclick = function(){settingToggle(this, toggleGridified)}
document.getElementById('setting-item-gridified-optimize').onclick = function(){settingToggle(this, toggleOptimizeGrid)}
document.getElementById('setting-item-defaultLayout').onclick = function(){settingToggle(this, resetLayout)}
document.getElementById('setting-item-printLayout').onclick = function(){settingToggle(this, printLayout)}

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
  disableLogging(randomizingPaths)
  clearTimeout(randomizerClock);
  if (randomizingPaths) randomizeMousePoint();
}
function toggleParallelLines() {
  parallelBarsVisible = !parallelBarsVisible
}
function toggleEditMode() {
  editingBlockers = !editingBlockers
  if (!editingBlockers) {
    Layout.clearConstruction()
    Layout.saveToCookies()
  }
  let smoothClass = 'setting-sub' + (editingBlockersSmooth ? ' active' : '') + (editingBlockers ? '' : ' hidden')
  document.getElementById('setting-item-editMode-smooth').className = smoothClass
}
function toggleEditModeSmooth() {
  editingBlockersSmooth = !editingBlockersSmooth
  let smoothClass = 'setting-sub' + (editingBlockersSmooth ? ' active' : '') + (editingBlockers ? '' : ' hidden')
  document.getElementById('setting-item-editMode-smooth').className = smoothClass
}
function toggleGridified() {
  gridify = !gridify;

  let optimizeClass = 'setting-sub' + (Layout.optimizeTriangulation ? ' active' : '') + (gridify ? '' : ' hidden')
  document.getElementById('setting-item-gridified-optimize').className = optimizeClass
}
function toggleOptimizeGrid() {
  Layout.triangulationOptimized(!Layout.optimizeTriangulation)

  let optimizeClass = 'setting-sub' + (Layout.optimizeTriangulation ? ' active' : '') + (gridify ? '' : ' hidden')
  document.getElementById('setting-item-gridified-optimize').className = optimizeClass
}
function resetLayout() {
  Layout.reset()
  document.getElementById('setting-item-defaultLayout').className = ''
}
function printLayout() {
  log(Layout.serialized())
  document.getElementById('setting-item-printLayout').className = ''
}

// =================================================================================================================== Test stuff =====
let test_points = [];
let test_lines = [];
let test_circles = [];
let test_polygons = [];
let contentOut = document.getElementById("content-output")
logSetup(contentOut)
let contentOutScrolling = false
let contentOutTrackLastMouseMove = 0

const RANDOMIZER_HERTZ = 0.05 * 1000;
let randomizerClock = null;
let randomizingPaths = false;
let lastSideChosen = 0;

function randomizeMousePoint() {
  if (!randomizingPaths) return

  lastSideChosen = (lastSideChosen + 1 + Math.floor(Math.random() * 2)) % 4;
  mouse.loc = new Point(Math.floor(Math.random() * canvas_bg.width), Math.floor(Math.random() * canvas_bg.height))

  if (lastSideChosen == 0) mouse.loc.y = 0
  else if (lastSideChosen == 1) mouse.loc.x = canvas_bg.width
  else if (lastSideChosen == 2) mouse.loc.y = canvas_bg.height
  else if (lastSideChosen == 3) mouse.loc.x = 0
  mouse.lastLeftClick = new Point(mouse.lastRightClick.x, mouse.lastRightClick.y);
  mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)

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
    canvasMasterContext.fillText(mouse.loc.x+', '+mouse.loc.y, mouse.loc.x+5, mouse.loc.y-5);
  }
  if (parallelBarsVisible) {
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
    if (parallelBarDragging.top) {
      canvasMasterContext.fillStyle = "rgb(44,54,64)";
      canvasMasterContext.beginPath();
      canvasMasterContext.arc(mouse.lastRightClick.x, tSY+tSH/2, tSH/2, 0, Math.PI*2, false);
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
    if (parallelBarDragging.left) {
      canvasMasterContext.fillStyle = "rgb(44,54,64)";
      canvasMasterContext.beginPath();
      canvasMasterContext.arc(tSY+tSH/2, mouse.lastRightClick.y, tSH/2, 0, Math.PI*2, false);
      canvasMasterContext.fill();
    }
  }
  canvasMasterContext.strokeStyle = "rgb(80, 180, 80)";
  canvasMasterContext.fillStyle = "rgb(80, 180, 80)";
  canvasMasterContext.font = '16px sans-serif';

  renderLogData(canvasMasterContext)
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

  Layout.renderBlockers(canvasMasterContext)
  if (editingBlockers) Layout.constructionRender(canvasMasterContext)
  if (gridify && !editingBlockers) Layout.renderTriangulation(canvasMasterContext)
  if (contentOutScrolling) contentOut.scrollTop += 1

  renderTestShapes()

  if (canvasRunning) window.requestAnimFrame(update)
  else canvasUpdating = false
}

// ======================================================================================================================= Launch =====

const KEY_CODE = {
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  SPACEBAR: 32,
  G: 71,
  E: 69,
  M: 77,
  P: 80
}
const handleKeyDown = keyDownEvent => {
  keyDownEvent = keyDownEvent || window.event;
  // log(`Log key: ${keyDownEvent.keyCode}`)
  switch(keyDownEvent.keyCode) {
    case KEY_CODE.ARROW_UP:
      selectLogPrev(); 
      break;
    case KEY_CODE.ARROW_DOWN:
      selectLogNext();
      break;
    case KEY_CODE.SPACEBAR:
      settingToggle(document.getElementById('setting-item-updateToggle'), toggleCanvasRunning);
      break;
    case KEY_CODE.G:
      settingToggle(document.getElementById('setting-item-gridified'), toggleGridified);
      break;
    case KEY_CODE.E:
      settingToggle(document.getElementById('setting-item-editMode'), toggleEditMode);
      break;
    case KEY_CODE.M:
      settingToggle(document.getElementById('setting-item-mouseLabelToggle'), toggleMouseLabel);
      break;
    case KEY_CODE.P:
      printLayout();
      break;
  }
}
document.addEventListener('keydown', handleKeyDown)

bgCanvas.onmousedown = e => {
  if (editingBlockers) {
    if (e.button === 0) {  // Left click add vertex unless smooth constructing
      if (!editingBlockersSmooth) {
        Layout.addConstructionPoint(mouse.loc);
      } else {
        editingBlockersSmoothTracking = true
      }
    } else { // Right click finish vertex
      Layout.finishConstruction(mouse.loc);
    }
    return
  }

  if (parallelBarsVisible) {
    if (
      PARALLEL_SETTER_TOP_X < mouse.loc.x && moumouse.locse.x < (canvas_bg.width - PARALLEL_SETTER_TOP_X) &&
      PARALLEL_SETTER_TOP_Y < mouse.loc.y && mouse.loc.y < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H)
    ) {
      parallelBarDragging.top = true;
      parallelBarDragging.left = false;
      return;
    } else
    if (
      PARALLEL_SETTER_TOP_Y < mouse.loc.x && mouse.loc.x < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H) &&
      PARALLEL_SETTER_TOP_X < mouse.loc.y && mouse.loc.y < (canvas_bg.height - PARALLEL_SETTER_TOP_X)
    ) {
      parallelBarDragging.left = true;
      parallelBarDragging.top = false;
      return;
    } else {
      parallelBarDragging.top = false;
      parallelBarDragging.left = false;
    }
  }

  if (e.button === 0) { // Left click
    mouse.lastLeftClick = new Point(mouse.loc.x, mouse.loc.y)
  } else { // Right click
    mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)
  }

  if (!editingBlockers && gridify) {
    test_lines = []
    test_circles = []
    test_points = []

    Layout.route(mouse.lastLeftClick, mouse.lastRightClick)

    testLine(mouse.lastLeftClick, mouse.lastRightClick)
    testPoint(mouse.lastLeftClick.x, mouse.lastLeftClick.y)
    testPoint(mouse.lastRightClick.x, mouse.lastRightClick.y)
  }
}

bgCanvas.onmouseup = e => {
  parallelBarDragging = {top: false, left: false}
  if (editingBlockersSmoothTracking && editingBlockers && editingBlockersSmooth) {
    Layout.finishConstruction(mouse.loc);
  }
  editingBlockersSmoothTracking = false
}

bgCanvas.onmousemove = e => {
  e.preventDefault()
  if (!canvasRunning) return
  let rect = bgCanvas.getBoundingClientRect();
  mouse.loc = new Point(RENDER_SCALING * Math.floor(e.clientX - rect.left), RENDER_SCALING * (e.clientY - rect.top))

  // Parallel bar dragging
  if (parallelBarsVisible) disableLogging(parallelBarDragging.top || parallelBarDragging.left)
  if (parallelBarDragging.top || parallelBarDragging.left) {
    if (parallelBarDragging.top) {
      mouse.lastLeftClick = new Point(Math.min(Math.max(mouse.loc.x, PARALLEL_SETTER_TOP_X), bgCanvas.width - PARALLEL_SETTER_TOP_X), 0)
      mouse.lastRightClick = new Point(Math.min(Math.max(mouse.loc.x, PARALLEL_SETTER_TOP_X), bgCanvas.width - PARALLEL_SETTER_TOP_X), bgCanvas.height)
    } else
    if (parallelBarDragging.left) {
      mouse.lastLeftClick = new Point(0, Math.min(Math.max(mouse.loc.y, PARALLEL_SETTER_TOP_X), bgCanvas.height - PARALLEL_SETTER_TOP_X))
      mouse.lastRightClick = new Point(bgCanvas.width, Math.min(Math.max(mouse.loc.y, PARALLEL_SETTER_TOP_X), bgCanvas.height - PARALLEL_SETTER_TOP_X))
    }
  } else if (!editingBlockers) {
    // Drag pathing
    if (e.buttons === 1 || e.buttons == 2) {
      if (e.buttons === 1) {
        mouse.lastLeftClick = new Point(mouse.loc.x, mouse.loc.y)
      } else if (e.buttons == 2) {
        mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)
      }

      if (!editingBlockers && gridify) {
        test_lines = []
        test_circles = []
        test_points = []

        disableLogging(true)
        Layout.route(mouse.lastLeftClick, mouse.lastRightClick)
        disableLogging(false)

        testLine(mouse.lastLeftClick, mouse.lastRightClick)
        testPoint(mouse.lastLeftClick.x, mouse.lastLeftClick.y)
        testPoint(mouse.lastRightClick.x, mouse.lastRightClick.y)
      }
    }
  } else if (editingBlockers && editingBlockersSmooth) {
    if (editingBlockersSmoothTracking) {
      Layout.addConstructionPoint(new Point(mouse.loc.x, mouse.loc.y));
    }
  }
}

bgCanvas.oncontextmenu = e => e.preventDefault()

window.onresize = () => {
  homeRefit();
}

function homeRefit() {
  canvas_bg.width = canvas_bg.offsetWidth * RENDER_SCALING;
  canvas_bg.height = canvas_bg.offsetHeight * RENDER_SCALING;
}

{
  canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
  canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

  Layout.load()
}

update()
