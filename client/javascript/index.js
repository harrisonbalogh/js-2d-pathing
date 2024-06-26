import { Point } from '@harxer/geometry'
import Layout from '@harxer/engine-2d/helpers/layout/Layout.js'
import * as LayoutManager from '@harxer/engine-2d/helpers/layout/tools/LayoutManager.js'
import { renderLogData, disableLogging, selectLogNext, selectLogPrev, attachLogOut } from './log.js'
import log, { clear as clearConsole } from './log.js'
import * as TickClock from '@harxer/engine-2d/core/TickClock.js'

// ==================================================================================================================== Variables =====
const RENDER_SCALING = 2
const RENDER_HERTZ = 30
const view = {
  x: 0,
  y: 0
}

let canvasFlush = true // if drawing frames are cleared or retained
let canvas_bg = document.getElementById("bgCanvas")
let canvasMasterContext = canvas_bg.getContext('2d') // The primary canvas particles are drawn on
/** @type {Layout} */
let layout2D = undefined;

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
  },
  labelVisible: false
}
// Set default toolbox selection to pointer
document.getElementById('settings-item-toolbox-pointer').className = 'active';
/** 0 - no mouse drag, 1 - left mouse drag, 2 - right mouse drag */
let canvasMouseDragging = 0;

canvas_bg.width = RENDER_SCALING * canvas_bg.offsetWidth;
canvas_bg.height = RENDER_SCALING * canvas_bg.offsetHeight;

// ================================================================================================ Settings Initialization =====
const SETTING_TOGGLE_ELEMENTS_MAP = {
  'setting-item-updateToggle': toggleCanvasRunning,
  'setting-item-mouseLabelToggle': toggleMouseLabel,
  'setting-item-smearToggle': toggleSmearRendering,
  // Triangulate settings
  'setting-item-triangulate-highlight-edges': toggleTriangulateHighlightEdges,
  'setting-item-triangulate-optimize-pass': _ => {}
}
Object.keys(SETTING_TOGGLE_ELEMENTS_MAP).forEach(
  elemId => document.getElementById(elemId).addEventListener('click', e => {
    e.target.classList.toggle("active");
    SETTING_TOGGLE_ELEMENTS_MAP[elemId](e);
    e.preventDefault();
  })
)

const SETTING_BUTTON_ELEMENTS_MAP = {
  'setting-item-mesh-reset': resetLayout,
  'setting-item-mesh-load': loadLayout,
  'setting-item-mesh-print': printLayout,
  'setting-item-console-clear': clearConsole,
  'setting-item-randomPath': randomPath,
  'setting-item-hide-control-window': hideControlWindow
}
Object.keys(SETTING_BUTTON_ELEMENTS_MAP).forEach(
  elemId => document.getElementById(elemId).addEventListener('click', e => {
    SETTING_BUTTON_ELEMENTS_MAP[elemId](e);
    e.preventDefault();
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
  TickClock.running() ? TickClock.stop() : TickClock.resume();
}
function toggleMouseLabel() {
  mouse.labelVisible = !mouse.labelVisible
}
function toggleSmearRendering() {
  canvasFlush = !canvasFlush
}
function randomPath() {
  let { point: p1 } = layout2D.meshContext.getRandomPoint();
  let { point: p2 } = layout2D.meshContext.getRandomPoint();
  testCircle(p1.x, p1.y, 6, true)
  testCircle(p2.x, p2.y, 6)
  LayoutManager.setPathfindingRoute(
    layout2D.contextRoute(p1, p2)
  );
}

function toggleTriangulateHighlightEdges(e) {
  LayoutManager.triangulationVisible(!LayoutManager.visibleTriangulation)
}
document.getElementById('modal-layout-load-close').addEventListener('click', _ => {
  document.getElementById('modal-layout-load').style.display = 'none';
})
document.getElementById('modal-layout-button-load').addEventListener('click', _ => {
  let inputElement = document.getElementById('modal-layout-load-input');
  layout2D = Layout.fromJson(inputElement.value);
  inputElement.value = '';
  document.getElementById('modal-layout-load').style.display = 'none';
})
function hideControlWindow(e) {
  if (document.getElementById('dev-pane').classList.contains("hidden")) {
    e.target.innerHTML = "Minimize Dev Pane";
  } else {
    e.target.innerHTML = "Maximize Dev Pane";
  }
  document.getElementById('dev-pane').classList.toggle("hidden");
  document.getElementById('dev-pane-controls-settings').classList.toggle("hidden");
}
function loadLayout() {
  document.getElementById('modal-layout-load').style.display = 'block';
}
function resetLayout() {
  LayoutManager.reloadDefaultLayout().then(layout => layout2D = layout);
}
function printLayout() {
  log(layout2D.serialized())
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
  if (mouse.labelVisible) {
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
  canvasMasterContext.strokeStyle = "rgb(20, 180, 20)";
  canvasMasterContext.fillStyle = "rgb(20, 180, 20)";
  canvasMasterContext.font = '16px sans-serif';

  renderLogData(canvasMasterContext)
}

// ======================================================================================================================== Clock =====

function render() {
  if (canvasFlush) {
    canvasMasterContext.clearRect(-view.x, -view.y, canvas_bg.width, canvas_bg.height)
  }

  LayoutManager.constructionRender(canvasMasterContext)
  LayoutManager.renderTriangulation(layout2D, canvasMasterContext)
  if (contentOutScrolling) contentOut.scrollTop += CONTENT_OUT_SCROLL_SPEED

  renderTestShapes()
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
      LayoutManager.addConstructionPoint(layout2D, mouse.contextLoc);
    } else { // Right click take back last constructor vertex
      LayoutManager.undoConstructionPoint();
    }

  } else if (mouse.tool === MOUSE_TOOL.MESH_ERASER) {

    if (layout2D.deleteMeshUnderPoint(mouse.contextLoc)) {
      LayoutManager.writeLayout(layout2D);
    }

  } else if (mouse.tool === MOUSE_TOOL.POINTER) {

    if (e.button === 0) { // Left click
      console.log(`Loc:`, mouse.contextLoc)
      layout2D.contextSelection(mouse.contextLoc);
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
      LayoutManager.setPathfindingRoute(
        layout2D.contextRoute(contextLeftMouse, contextRightMouse)
      );
    }

  }

  e.preventDefault();
}

canvas_bg.onmousemove = e => {
  e.preventDefault()
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

      LayoutManager.setPathfindingRoute(
        layout2D.contextRoute(contextLeftMouse, contextRightMouse)
      );
    }
  } else {
    if (mouse.tool === MOUSE_TOOL.MESH_CONSTRUCTOR) {
      LayoutManager.constructionMouseMoveHandler(mouse.contextLoc.x, mouse.contextLoc.y)
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
  LayoutManager.setLayoutCookieKey('js-2d-pathing-layout')
  LayoutManager.setDefaultJsonLayoutUrl('layout_default.json')
  layout2D = new Layout();
  LayoutManager.initLayout().then(layout => {
    layout2D = layout;
  });

  TickClock.addInterval('render', render, RENDER_HERTZ)
  TickClock.start()

  document.getElementById('setting-item-hide-control-window').click();
}
