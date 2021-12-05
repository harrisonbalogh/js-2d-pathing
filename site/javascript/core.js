import './Layout2D/Error.js'
import { Point } from './Layout2D/Geometry.js'
import * as Layout from './Layout2D/Layout.js'
import { renderLogData, disableLogging, selectLogNext, selectLogPrev, attachLogOut } from './log.js'
import log from './log.js'

// ==================================================================================================================== Variables =====
const RENDER_HERTZ = 1000 / 60 // Render update speed
const RENDER_SCALING = 2

let canvasRunning = true // when the GUI setting is enabled or not. Override drawing.
let canvasUpdating = false // if update has yet to resume
let canvasFlush = true // if drawing frames are cleared or retained
let canvas_bg = document.getElementById("bgCanvas")
let canvasMasterContext = canvas_bg.getContext('2d') // The primary canvas particles are drawn on

export let mouse = {
  loc: new Point(0, 0),
  lastLeftClick: new Point(0, 0),
  lastRightClick: new Point(0, 0)
}
let mouseLabelsVisible = true;

let gridify = false;

let editingBlockers = false;
let editingBlockersSmooth = false;
let editingBlockersSmoothTracking = false;

let parallelBarsVisible = false;
let parallelBarDragging = {top: false, left: false}
const PARALLEL_SETTER_TOP_X = 80
const PARALLEL_SETTER_TOP_Y = 14
const PARALLEL_SETTER_TOP_H = 20

canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

// ================================================================================================ Settings Initialization =====
const SETTING_TOGGLE_ELEMENTS_MAP = {
  'setting-item-updateToggle': toggleCanvasRunning,
  'setting-item-mouseLabelToggle': toggleMouseLabel,
  'setting-item-smearToggle': toggleSmearRendering,
  'setting-item-randomizerToggle': toggleRandomizer,
  'setting-item-parallelLinesToggle': toggleParallelLines,
  'setting-item-editMode': toggleEditMode,
  'setting-item-editMode-smooth': toggleEditModeSmooth,
  'setting-item-gridified': toggleGridified,
  'setting-item-gridified-optimize': toggleOptimizeGrid,
  'setting-item-gridified-visible': toggleVisibleGridify,
  'setting-item-defaultLayout': resetLayout,
  'setting-item-printLayout': printLayout
}
Object.keys(SETTING_TOGGLE_ELEMENTS_MAP).forEach(elemId => {
  let elem = document.getElementById(elemId) 
  elem.onclick = () => {
    elem.className = elem.className == "active" ? "" : "active"
    SETTING_TOGGLE_ELEMENTS_MAP[elemId]()
  }
})

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
  mouseRandomizer.enabled = !mouseRandomizer.enabled;
  disableLogging(mouseRandomizer.enabled)
  clearTimeout(mouseRandomizer.clock);
  if (mouseRandomizer.enabled) mouseRandomizer.randomizeMousePoint();
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

  let visibleClass = 'setting-sub' + (Layout.visibleTriangulation ? ' active' : '') + (gridify ? '' : ' hidden')
  document.getElementById('setting-item-gridified-visible').className = visibleClass
}
function toggleOptimizeGrid() {
  Layout.triangulationOptimized(!Layout.optimizeTriangulation)

  let optimizeClass = 'setting-sub' + (Layout.optimizeTriangulation ? ' active' : '') + (gridify ? '' : ' hidden')
  document.getElementById('setting-item-gridified-optimize').className = optimizeClass
}
function toggleVisibleGridify() {
  Layout.triangulationVisible(!Layout.visibleTriangulation)

  let visibleClass = 'setting-sub' + (Layout.visibleTriangulation ? ' active' : '') + (gridify ? '' : ' hidden')
  document.getElementById('setting-item-gridified-visible').className = visibleClass
}
function resetLayout() {
  Layout.reset()
  document.getElementById('setting-item-defaultLayout').className = ''
}
function printLayout() {
  log(Layout.serialized())
  document.getElementById('setting-item-printLayout').className = ''
}

// =================================================================================================================== Test rendering =====
let test_points = [];
let test_lines = [];
let test_circles = [];

let contentOut = document.getElementById("content-output")
let contentOutScrolling = false
let contentOutTrackLastMouseMove = 0
const CONTENT_OUT_SCROLL_SPEED = 1
attachLogOut(contentOut)
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

const RANDOMIZER_HERTZ = 0.05 * 1000;
let mouseRandomizer = {
  clock: null,
  enabled: false,
  lastSideChosen: 0,
  randomizeMousePoint: () => {
    if (!enabled || Layout.bounds.blocker === undefined) return

    let w = Layout.bounds.width, h = Layout.bounds.height, x = Layout.bounds.xInset, y = Layout.bounds.yInset

    lastSideChosen = (lastSideChosen + 1 + Math.floor(Math.random() * 2)) % 4;
    mouse.loc = new Point(Math.floor(Math.random() * w), Math.floor(Math.random() * h))
  
    if (lastSideChosen == 0) mouse.loc.y = x
    else if (lastSideChosen == 1) mouse.loc.x = w
    else if (lastSideChosen == 2) mouse.loc.y = h
    else if (lastSideChosen == 3) mouse.loc.x = y
    mouse.lastLeftClick = new Point(mouse.lastRightClick.x, mouse.lastRightClick.y);
    mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)
  
    Layout.route(mouse.lastLeftClick, mouse.lastRightClick)
  
    clock = setTimeout(() => { randomizeMousePoint(); }, RANDOMIZER_HERTZ);
  }
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
    let x = Layout.bounds.xInset + PARALLEL_SETTER_TOP_X;
    let y = Layout.bounds.yInset + PARALLEL_SETTER_TOP_Y;
    let w = PARALLEL_SETTER_TOP_H; 
    let h = PARALLEL_SETTER_TOP_H; 
    canvasMasterContext.strokeStyle = "rgb(44,54,64)";
    // Top Setter
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(x, y);
    canvasMasterContext.lineTo(Layout.bounds.width-tSX, tSY);
    canvasMasterContext.arc(randomizerBoundsWidth-tSX, tSY+tSH/2, tSH/2, -Math.PI/2, Math.PI/2, false);
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
    canvasMasterContext.lineTo(tSY, randomizerBoundsWidth-tSX);
    canvasMasterContext.arc(tSY+tSH/2, randomizerBoundsWidth-tSX, tSH/2, Math.PI, 0, true);
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
  canvasMasterContext.strokeStyle = "rgb(20, 180, 20)";
  canvasMasterContext.fillStyle = "rgb(20, 180, 20)";
  canvasMasterContext.font = '16px sans-serif';

  renderLogData(canvasMasterContext)
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
  if (canvasFlush) {
    canvasMasterContext.clearRect(0, 0, canvas_bg.width, canvas_bg.height)
    Layout.renderBlockers(canvasMasterContext)
  }

  if (editingBlockers) Layout.constructionRender(canvasMasterContext)
  if (gridify && !editingBlockers) Layout.renderTriangulation(canvasMasterContext)
  if (contentOutScrolling) contentOut.scrollTop += CONTENT_OUT_SCROLL_SPEED

  renderTestShapes()

  if (canvasRunning) window.requestAnimFrame(update)
  else canvasUpdating = false
}

// ======================================================================================================================= Window Setup =====
const KEY_CODE = {
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  SPACEBAR: 32,
  G: 71,
  E: 69,
  M: 77,
  P: 80,
  R: 82,
  S: 83
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
    case KEY_CODE.R:
      settingToggle(document.getElementById('setting-item-randomizerToggle'), toggleRandomizer);
      break;
    case KEY_CODE.S:
      settingToggle(document.getElementById('setting-item-smearToggle'), toggleSmearRendering);
      break;
  }
}
document.addEventListener('keydown', handleKeyDown)

canvas_bg.onmousedown = e => {
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
      mouse.loc.x > PARALLEL_SETTER_TOP_X && mouse.loc.x < (randomizerBoundsWidth - PARALLEL_SETTER_TOP_X) &&
      PARALLEL_SETTER_TOP_Y < mouse.loc.y && mouse.loc.y < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H)
    ) {
      parallelBarDragging.top = true;
      parallelBarDragging.left = false;
      return;
    } else
    if (
      PARALLEL_SETTER_TOP_Y < mouse.loc.x && mouse.loc.x < (PARALLEL_SETTER_TOP_Y + PARALLEL_SETTER_TOP_H) &&
      mouse.loc.y > PARALLEL_SETTER_TOP_X && mouse.loc.y < (randomizerBoundsWidth - PARALLEL_SETTER_TOP_X)
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

    // testLine(mouse.lastLeftClick, mouse.lastRightClick)
    testCircle(mouse.lastLeftClick.x, mouse.lastLeftClick.y, 6)
    testCircle(mouse.lastRightClick.x, mouse.lastRightClick.y, 6)
  }
}

canvas_bg.onmouseup = e => {
  parallelBarDragging = {top: false, left: false}
  if (editingBlockersSmoothTracking && editingBlockers && editingBlockersSmooth) {
    Layout.finishConstruction(mouse.loc);
  }
  editingBlockersSmoothTracking = false
}

canvas_bg.onmousemove = e => {
  e.preventDefault()
  if (!canvasRunning) return
  let rect = canvas_bg.getBoundingClientRect();
  mouse.loc = new Point(RENDER_SCALING * Math.floor(e.clientX - rect.left), RENDER_SCALING * (e.clientY - rect.top))

  // Parallel bar dragging
  if (parallelBarsVisible) disableLogging(parallelBarDragging.top || parallelBarDragging.left)
  if (parallelBarDragging.top || parallelBarDragging.left) {
    if (parallelBarDragging.top) {
      mouse.lastLeftClick = new Point(Math.min(Math.max(mouse.loc.x, PARALLEL_SETTER_TOP_X), randomizerBoundsWidth - PARALLEL_SETTER_TOP_X), 0)
      mouse.lastRightClick = new Point(Math.min(Math.max(mouse.loc.x, PARALLEL_SETTER_TOP_X), randomizerBoundsWidth - PARALLEL_SETTER_TOP_X), randomizerBoundsWidth)
    } else
    if (parallelBarDragging.left) {
      mouse.lastLeftClick = new Point(0, Math.min(Math.max(mouse.loc.y, PARALLEL_SETTER_TOP_X), randomizerBoundsWidth - PARALLEL_SETTER_TOP_X))
      mouse.lastRightClick = new Point(randomizerBoundsWidth, Math.min(Math.max(mouse.loc.y, PARALLEL_SETTER_TOP_X), randomizerBoundsWidth - PARALLEL_SETTER_TOP_X))
    }
    disableLogging(true)
    Layout.route(mouse.lastLeftClick, mouse.lastRightClick)
    disableLogging(false)
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

        // testLine(mouse.lastLeftClick, mouse.lastRightClick)
        testCircle(mouse.lastLeftClick.x, mouse.lastLeftClick.y, 6)
        testCircle(mouse.lastRightClick.x, mouse.lastRightClick.y, 6)
      }
    }
  } else if (editingBlockers && editingBlockersSmooth) {
    if (editingBlockersSmoothTracking) {
      Layout.addConstructionPoint(new Point(mouse.loc.x, mouse.loc.y));
    }
  }
}

canvas_bg.oncontextmenu = e => e.preventDefault()

window.onresize = () => homeRefit()

function homeRefit() {
  canvas_bg.width = canvas_bg.offsetWidth * RENDER_SCALING;
  canvas_bg.height = canvas_bg.offsetHeight * RENDER_SCALING;
}

// ======================================================================================================================= Launch =====
{
  homeRefit()
  Layout.load()
  update()
}
