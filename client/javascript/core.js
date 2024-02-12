import './Layout2D/Error.js'
import { Point } from '../node_modules/@harxer/geometry/geometry.js'
import * as Layout from './Layout2D/Layout.js'
import { renderLogData, disableLogging, selectLogNext, selectLogPrev, attachLogOut } from './log.js'
import log, { clear as clearConsole } from './log.js'

// ==================================================================================================================== Variables =====
const RENDER_HERTZ = 1000 / 60 // Render update speed
const RENDER_SCALING = 2
const view = {
  x: 0,
  y: 0
}

let canvasRunning = true // when the GUI setting is enabled or not. Override drawing.
let canvasUpdating = false // if update has yet to resume
let canvasFlush = true // if drawing frames are cleared or retained
let canvas_bg = document.getElementById("bgCanvas")
let canvasMasterContext = canvas_bg.getContext('2d') // The primary canvas particles are drawn on

const MOUSE_TOOL = {
  POINTER: 0,
  MESH_CONSTRUCTOR: 1,
  MESH_ERASER: 2,
  PATHER: 3
}

export let mouse = {
  loc: new Point(0, 0),
  lastLeftClick: undefined,
  lastRightClick: undefined,
  tool: MOUSE_TOOL.POINTER,
  get contextLoc() {
    return new Point(this.loc.x - view.x, this.loc.y - view.y)
  }
}
// Set default toolbox selection to pointer
document.getElementById('settings-item-toolbox-pointer').className = 'active';
let mouseLabelsVisible = true;

let meshConstructorToolActive = false;
let meshEraserToolActive = false; // TODO NYI
/** 0 - no mouse drag, 1 - left mouse drag, 2 - right mouse drag */
let canvasMouseDragging = 0;

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
  // Triangulate settings
  'setting-item-triangulate-highlight-edges': toggleTriangulateHighlightEdges,
  'setting-item-triangulate-optimize-pass': toggleTriangulateOptimizationPass,
  // 'setting-item-randomizerToggle': toggleRandomizer
}
Object.keys(SETTING_TOGGLE_ELEMENTS_MAP).forEach(
  elemId => document.getElementById(elemId).addEventListener('click', e => {
    e.target.classList.toggle("active");
    SETTING_TOGGLE_ELEMENTS_MAP[elemId](e);
  })
)

const SETTING_BUTTON_ELEMENTS_MAP = {
  'setting-item-mesh-reset': resetLayout,
  'setting-item-mesh-load': loadLayout,
  'setting-item-mesh-print': printLayout,
  'setting-item-console-clear': clearConsole,
}
Object.keys(SETTING_BUTTON_ELEMENTS_MAP).forEach(
  elemId => document.getElementById(elemId).addEventListener('click', e => {
    SETTING_BUTTON_ELEMENTS_MAP[elemId](e);
  })
)

// -------------- Dev pane resizing setup
let devPaneContentResizing = false;
document.getElementById('dev-pane-content-divider').onmousedown = e => {
  devPaneContentResizing = true;
}
const ELEMENT_DEV_PANE = document.getElementById('dev-pane');
const ELEMENT_DEV_PANE_CONTROL_SETTINGS = document.getElementById('dev-pane-controls-settings');
ELEMENT_DEV_PANE.onmousemove = e => {
  if (!devPaneContentResizing) return;
  let scrollY = (e.target.getBoundingClientRect().top + e.offsetY) - ELEMENT_DEV_PANE.offsetTop - 10;
  // ELEMENT_DEV_PANE_CONTROL_SETTINGS.style.height = `${scrollY / ELEMENT_DEV_PANE.offsetHeight * 100}%`
  ELEMENT_DEV_PANE_CONTROL_SETTINGS.style.height = `${scrollY}px`
  e.preventDefault();
}
document.addEventListener('mouseup', e => {
  devPaneContentResizing = false;
})
// --------------

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
// function toggleRandomizer() {
//   mouseRandomizer.enabled = !mouseRandomizer.enabled;
//   disableLogging(mouseRandomizer.enabled)
//   clearTimeout(mouseRandomizer.clock);
//   if (mouseRandomizer.enabled) mouseRandomizer.randomizeMousePoint();
// }
function toggleTriangulateOptimizationPass(e) {
  Layout.triangulationOptimized(!Layout.optimizeTriangulation)
}

function toggleTriangulateHighlightEdges(e) {
  Layout.triangulationVisible(!Layout.visibleTriangulation)
}
function resetLayout() {
  Layout.reset()
}
document.getElementById('modal-layout-load-close').addEventListener('click', _ => {
  document.getElementById('modal-layout-load').style.display = 'none';
})
document.getElementById('modal-layout-button-load').addEventListener('click', _ => {
  let inputElement = document.getElementById('modal-layout-load-input');
  Layout.parseLayout(inputElement.value)
  inputElement.value = '';
  document.getElementById('modal-layout-load').style.display = 'none';
})
function loadLayout() {
  document.getElementById('modal-layout-load').style.display = 'block';
}
function printLayout() {
  log(Layout.serialized())
  if (mouse.tool === MOUSE_TOOL.PATHER) {
    log(`Left mouse: ${mouse.lastLeftClick?.logString()}. Right mouse: ${mouse.lastRightClick?.logString()}`)
  }
}

function handleToolboxClick(e) {
  for (const child of document.getElementById('settings-item-toolbox-buttons').children) {
    child.className = ""
  }
  e.target.className = "active";
  if (e.target.id === 'settings-item-toolbox-pointer') {
    mouse.tool = MOUSE_TOOL.POINTER;
  } else
  if (e.target.id === 'settings-item-toolbox-constructor') {
    mouse.tool = MOUSE_TOOL.MESH_CONSTRUCTOR;
  } else
  if (e.target.id === 'settings-item-toolbox-eraser') {
    mouse.tool = MOUSE_TOOL.MESH_ERASER;
  } else
  if (e.target.id === 'settings-item-toolbox-pather') {
    mouse.tool = MOUSE_TOOL.PATHER;
  }
}
document.getElementById('settings-item-toolbox-pointer').addEventListener('click', handleToolboxClick)
document.getElementById('settings-item-toolbox-constructor').addEventListener('click', handleToolboxClick)
document.getElementById('settings-item-toolbox-eraser').addEventListener('click', handleToolboxClick)
document.getElementById('settings-item-toolbox-pather').addEventListener('click', handleToolboxClick)

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

// const RANDOMIZER_HERTZ = 0.01 * 1000;
// let mouseRandomizer = {
//   clock: null,
//   enabled: false,
//   lastSideChosen: 0,
//   randomizeMousePoint: () => {
//     if (!mouseRandomizer.enabled || Layout.bounds.blocker === undefined) return

//     let w = Layout.bounds.width, h = Layout.bounds.height, x = Layout.bounds.xInset, y = Layout.bounds.yInset

//     mouseRandomizer.lastSideChosen = (mouseRandomizer.lastSideChosen + 1 + Math.floor(Math.random() * 2)) % 4;
//     mouse.loc = new Point(Math.floor(Math.random() * w), Math.floor(Math.random() * h))

//     if (mouseRandomizer.lastSideChosen == 0) mouse.loc.y = x + 2
//     else if (mouseRandomizer.lastSideChosen == 1) mouse.loc.x = w
//     else if (mouseRandomizer.lastSideChosen == 2) mouse.loc.y = h
//     else if (mouseRandomizer.lastSideChosen == 3) mouse.loc.x = y + 2
//     mouse.lastLeftClick = new Point(mouse.lastRightClick.x, mouse.lastRightClick.y);
//     mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)

//     Layout.route(mouse.lastLeftClick, mouse.lastRightClick)

//     mouseRandomizer.clock = setTimeout(() => { mouseRandomizer.randomizeMousePoint(); }, RANDOMIZER_HERTZ);
//   }
// }

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
    canvasMasterContext.fillText(mouse.contextLoc.x+', '+mouse.contextLoc.y, mouse.contextLoc.x+5, mouse.contextLoc.y-5);
  }
  if (mouse.tool === MOUSE_TOOL.MESH_CONSTRUCTOR) {
    canvasMasterContext.strokeStyle = "black"
    canvasMasterContext.lineWidth = 3;
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(mouse.contextLoc.x - 20, mouse.contextLoc.y);
    canvasMasterContext.lineTo(mouse.contextLoc.x + 20, mouse.contextLoc.y);
    canvasMasterContext.moveTo(mouse.contextLoc.x, mouse.contextLoc.y - 20);
    canvasMasterContext.lineTo(mouse.contextLoc.x, mouse.contextLoc.y + 20);
    canvasMasterContext.stroke();
    canvasMasterContext.lineWidth = 1;
  }
  if (parallelBarsVisible) {
    let h = PARALLEL_SETTER_TOP_H;
    let x = Layout.bounds.xInset + PARALLEL_SETTER_TOP_X;
    let y = Layout.bounds.yInset + PARALLEL_SETTER_TOP_Y;
    canvasMasterContext.strokeStyle = "rgb(44,54,64)";
    // Top Setter
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(x, y);
    canvasMasterContext.lineTo(Layout.bounds.width-x, y);
    canvasMasterContext.arc(Layout.bounds.width-x, y+h/2, h/2, -Math.PI/2, Math.PI/2, false);
    canvasMasterContext.lineTo(x, y+h);
    canvasMasterContext.arc(x, y+h/2, h/2, Math.PI/2, -Math.PI/2, false);
    canvasMasterContext.stroke();
    if (parallelBarDragging.top) {
      canvasMasterContext.fillStyle = "rgb(44,54,64)";
      canvasMasterContext.beginPath();
      canvasMasterContext.arc(mouse.lastRightClick.x, y+h/2, h/2, 0, Math.PI*2, false);
      canvasMasterContext.fill();
    }
    // Left Setter
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(y, x);
    canvasMasterContext.lineTo(y, Layout.bounds.width-x);
    canvasMasterContext.arc(y+h/2, Layout.bounds.width-x, h/2, Math.PI, 0, true);
    canvasMasterContext.lineTo(y+h, x);
    canvasMasterContext.arc(y+h/2, x, h/2, 0, -Math.PI, true);
    canvasMasterContext.stroke();
    if (parallelBarDragging.left) {
      canvasMasterContext.fillStyle = "rgb(44,54,64)";
      canvasMasterContext.beginPath();
      canvasMasterContext.arc(y+h/2, mouse.lastRightClick.y, h/2, 0, Math.PI*2, false);
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
    canvasMasterContext.clearRect(-view.x, -view.y, canvas_bg.width, canvas_bg.height)
  }

  Layout.constructionRender(canvasMasterContext)
  Layout.renderTriangulation(canvasMasterContext)
  if (contentOutScrolling) contentOut.scrollTop += CONTENT_OUT_SCROLL_SPEED

  renderTestShapes()

  if (canvasRunning) window.requestAnimFrame(update)
  else canvasUpdating = false
}

// ======================================================================================================================= Window Setup =====
const KEY_CODE = {
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
  ARROW_LEFT: 37,
  SPACEBAR: 32,
  G: 71,
  E: 69,
  M: 77,
  P: 80,
  R: 82,
  S: 83,
  V: 86
}
const handleKeyDown = keyDownEvent => {
  keyDownEvent = keyDownEvent || window.event;
  // log(`Log key: ${keyDownEvent.keyCode}`)
  switch(keyDownEvent.keyCode) {
    case KEY_CODE.ARROW_UP:
      selectLogPrev();
      keyDownEvent.preventDefault()
      break;
    case KEY_CODE.ARROW_DOWN:
      selectLogNext();
      keyDownEvent.preventDefault()
      break;
    case KEY_CODE.SPACEBAR:
      document.getElementById('setting-item-updateToggle').click();
      break;
    case KEY_CODE.V:
      let childElements = Array.from(document.getElementById('settings-item-toolbox-buttons').children);
      let iActive = childElements.findIndex(child => child.classList.contains('active'))
      iActive = (iActive + 1) % childElements.length;
      childElements[iActive].click();
      break;
  }
}
document.addEventListener('keydown', handleKeyDown)

canvas_bg.onmousedown = e => {
  if (e.button === 0) { // Left click
    mouse.lastLeftClick = mouse.loc.copy;
  } else { // Right click
    mouse.lastRightClick = mouse.loc.copy;
  }

  if (mouse.tool === MOUSE_TOOL.MESH_CONSTRUCTOR) {

    if (e.button === 0) {  // Left click add vertex or finish mesh if closed shape
      Layout.addConstructionPoint(mouse.contextLoc);
    } else { // Right click take back last constructor vertex or erase if no construction in progress
      if (Layout.hasConstructorVertices()) {
        Layout.undoConstructionPoint();
      } else {
        Layout.deleteMeshUnderPoint(mouse.contextLoc);
      }
    }

  } else if (mouse.tool === MOUSE_TOOL.MESH_ERASER) {

    Layout.deleteMeshUnderPoint(mouse.contextLoc);

  } else if (mouse.tool === MOUSE_TOOL.POINTER) {

    if (e.button === 0) { // Left click
      Layout.contextSelection(mouse.contextLoc);
    } else { // Right click
      canvasMouseDragging = 2;
    }

  } else if (mouse.tool === MOUSE_TOOL.PATHER) {

    canvasMouseDragging = e.button === 0 ? 1 : 2;

    let contextLeftMouse, contextRightMouse;

    if (mouse.lastLeftClick) {
      contextLeftMouse = mouse.lastLeftClick.copy.minus(view);
      testCircle(contextLeftMouse.x, contextLeftMouse.y, 6, true)
    }
    if (mouse.lastRightClick) {
      contextRightMouse = mouse.lastRightClick.copy.minus(view);
      testCircle(contextRightMouse.x, contextRightMouse.y, 6)
    }

    if (mouse.lastLeftClick && mouse.lastRightClick) {
      Layout.route(contextLeftMouse, contextRightMouse);
    }

  }

  e.preventDefault();
}

canvas_bg.onmousemove = e => {
  e.preventDefault()
  if (!canvasRunning) return
  let rect = canvas_bg.getBoundingClientRect();
  mouse.loc = new Point(RENDER_SCALING * Math.floor(e.clientX - rect.left), RENDER_SCALING * (e.clientY - rect.top))

  if (canvasMouseDragging > 0) {
    if (mouse.tool === MOUSE_TOOL.POINTER) {
      let x = mouse.loc.x - mouse.lastRightClick.x;
      let y = mouse.loc.y - mouse.lastRightClick.y;
      mouse.lastRightClick = new Point(mouse.loc.x, mouse.loc.y)
      canvasMasterContext.translate(x, y)
      view.x += x
      view.y += y
    } else if (mouse.tool === MOUSE_TOOL.PATHER) {
      if (canvasMouseDragging === 1) { // Left click
        mouse.lastLeftClick = mouse.loc.copy;
      } else { // Right click
        mouse.lastRightClick = mouse.loc.copy;
      }

      disableLogging(true);

      let contextLeftMouse = mouse.lastLeftClick.copy.minus(view);
      let contextRightMouse = mouse.lastRightClick.copy.minus(view);
      testCircle(contextLeftMouse.x, contextLeftMouse.y, 6, true)
      testCircle(contextRightMouse.x, contextRightMouse.y, 6)

      Layout.route(contextLeftMouse, contextRightMouse);
    }
  }
}

canvas_bg.onmouseup = e => {
  canvasMouseDragging = false;
  disableLogging(false);
}

canvas_bg.oncontextmenu = e => e.preventDefault()

window.onresize = () => homeRefit()

function homeRefit() {
  // Each time the height or width of a canvas is set,
  // the canvas transforms will be cleared.
  let transform = canvasMasterContext.getTransform()

  // Sync canvas size
  canvas_bg.width = canvas_bg.offsetWidth * RENDER_SCALING;
  canvas_bg.height = canvas_bg.offsetHeight * RENDER_SCALING;

  // Apply preserved context transformations
  canvasMasterContext.setTransform(transform)
}

// ======================================================================================================================= Launch =====
{
  homeRefit()
  Layout.load()
  update()
}
