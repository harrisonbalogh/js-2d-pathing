import { Point, Segment, Vector, equals } from '@harxer/geometry'
import Layout from '@harxer/engine-2d/helpers/layout/Layout.js'
import * as LayoutManager from '@harxer/engine-2d/helpers/layout/tools/LayoutManager.js'
import * as Collision from '@harxer/engine-2d/helpers/colliders/colliders.js'
import { renderLogData, disableLogging, selectLogNext, selectLogPrev, attachLogOut, addLogSelectedNotifier } from './log.js'
import log, { clear as clearConsole, toggleTextLabels } from './log.js'
import * as TickClock from '@harxer/engine-2d/core/TickClock.js'
import Mesh from '@harxer/engine-2d/helpers/layout/Mesh.js'

// ============================================================================ Camera View Attributes =====
const RENDER_SCALING = 1
const RENDER_HERTZ = 30
const SCALE_MIN = 1;
const SCALE_MAX = 8;
const SCALE_DELTA_MAX = 1; // 0.1;
/** Camera attributes. */
const view = {
  /** Camera X world center. */
  x: 0,
  /** Camera Y world center. */
  y: 0,
  scale: 1,
  scaleAt: function(dScale, origin = undefined) {
    // Default to center if no origin specified
    if (!origin) origin = {x: 0, y: 0}; // {x: 0.5, y: 0.5};
    // Get actual scale change after imposed limits
    let targetScale = Math.max(Math.min(this.scale - dScale, SCALE_MAX), SCALE_MIN);
    dScale = targetScale - this.scale;
    // Reset scale-velocity on hitting boundary
    if (targetScale === this.scale) {
      scaleVel = 0
      return;
    };

    this.scale = targetScale;

    // Anchor to origin
    let xOffset = (origin.x - view.x) * dScale / this.scale;
    let yOffset = (origin.y - view.y) * dScale / this.scale;

    this.pan(xOffset, yOffset);
  },
  /** Pan view by world coordinate deltas. */
  pan: function(dX, dY) {
    this.x += dX;
    this.y += dY;
    this.applyTransform();
  },
  applyTransform: function() {
    canvasMasterContext.setTransform(
      this.scale, 0,
      0, this.scale,
      (canvasElem.width / 2 - this.x * this.scale), (canvasElem.height / 2 - this.y * this.scale)
    );
  },
  /** Convert screen corodinates to world coordinates. @param {Point} loc screen location. @returns {Point} */
  screenToWorld: function(loc) {
    // With origin centered:
    return new Point((view.x + (loc.x - (canvasElem.width / 2))/ this.scale), (view.y + (loc.y - (canvasElem.height / 2))/ this.scale))
    // With origin top-left:
    // return new Point((this.loc.x - view.x) / view.scale, (this.loc.y - view.y) / view.scale)
  },
  /** Convert world corodinates to screen coordinates. @param {Point} loc world location. @returns {Point} */
  worldToScreen: function(loc) {
    return new Point(loc.x - view.x + (canvasElem.width / 2), loc.y - view.y + (canvasElem.height / 2))
  }
}

let scaleAccel = 0.05;
let scaleAccelMax = 0.1
let scaleDecelModifier = 0.1;
let scaleDecel = scaleAccel * scaleDecelModifier;
let scaleVel = 0;

// ============================================================================ Mouse Attributes =====
const MOUSE_TOOL = {
  POINTER: {
    id: 'settings-item-toolbox-pointer',
    description: `
      <b>Canvas Pointer tool</b><br>
      Left-click updates mesh context selection - indicated by blue highlight in the canvas.
      The current mesh context has various affects on other tools. Left-click over a hole polygon
      to change context. Left-click outside current context to change to parent polygon.
      Drag right-click to pan canvas.
    `,
    onDown: _ => {
      if (mouse.down === MOUSE_LEFT) {
        layout2D.contextSelection(mouse.worldLoc);
        if (!TickClock.running()) render();
      }
    },
    onMove: function() {
      if (mouse.down === undefined) return;

      if (mouse.down === MOUSE_RIGHT) {
        view.pan(-mouse.dLoc.x / view.scale, -mouse.dLoc.y / view.scale);
      }
    }
  },
  MESH_CONSTRUCTOR: {
    id: 'settings-item-toolbox-constructor',
    description: `
      <b>Mesh Construction tool</b><br>
      Create new polygon by left-clicking to add vertices.
      Close shape by overlaying first and last vertex. Undo vertices with right-click (no vertices is a pan).
      Clockwise versus counter-clockwise affects generated mesh. Shape goes into current selected context.
      If no polygons are present, the first polygon created has to be counter-clockwise.
    `,
    /** Distance to first construction point to trigger close polygon. @type {int} */
    _snapDistance: 8,
    onDown: _ => {
      if (mouse.down === MOUSE_LEFT ) {
        LayoutManager.addConstructionPoint(layout2D, mouse.worldLoc);
      } else if (mouse.down === MOUSE_RIGHT ) {
        LayoutManager.undoConstructionPoint();
      }
      if (!TickClock.running()) render();
    },
    onMove: _ => {
      LayoutManager.constructionMouseMoveHandler(mouse.worldLoc.x, mouse.worldLoc.y);

      if (mouse.down === MOUSE_RIGHT) {
        if (!LayoutManager.hasConstructorVertices()) {
          view.pan(-mouse.dLoc.x / view.scale, -mouse.dLoc.y / view.scale);
        }
      }
    }
  },
  MESH_ERASER: {
    id: 'settings-item-toolbox-eraser',
    description: `
      <b>Mesh Destruction tool</b><br>
      Right-click hole mesh to delete polygon and all its child polygons. Right-click outside
      bounding polygon (highest level context) to delete bounding polygon.
      Left-click performs context selection like the <i>Pointer tool</i>.
    `,
    onDown: _ => {
      if (mouse.down === MOUSE_LEFT) {
        layout2D.contextSelection(mouse.worldLoc);
      } else if (mouse.down === MOUSE_RIGHT) {
        if (layout2D.deleteMeshUnderPoint(mouse.worldLoc)) {
          LayoutManager.writeLayout(layout2D);
        }
      }
    }
  },
  PATHER: {
    id: 'settings-item-toolbox-pather',
    description: `
      <b>Pathing tool</b><br>
      Left-click, and/or drag, to set the starting point. Right-click, and/or drag, to set the
      destination point. Path is routed through current mesh context.
    `,
    onSelection: function() {
      this.onDown();
    },
    _lastLeftClick: undefined,
    _lastRightClick: undefined,
    onDown: function() {
      // Get mouse location
      let contextLeftMouse, contextRightMouse;
      if (mouse.down === MOUSE_LEFT) {
        this._lastLeftClick = mouse.screenLoc;
      } else if (mouse.down === MOUSE_RIGHT) {
        this._lastRightClick = mouse.screenLoc;
      }
      // Render circles at start/finish
      flushTestShapes();
      if (this._lastLeftClick) {
        contextLeftMouse = view.screenToWorld(this._lastLeftClick);
        testCircle(contextLeftMouse.x, contextLeftMouse.y, 6);
      }
      if (this._lastRightClick) {
        contextRightMouse = view.screenToWorld(this._lastRightClick);
        testCircle(contextRightMouse.x, contextRightMouse.y, 6);
      }
      // Route path
      if (contextLeftMouse && contextRightMouse) {
        LayoutManager.setPathfindingRoute(layout2D.contextRoute(contextLeftMouse, contextRightMouse));
      }
    },
    onMove: function() {
      if (mouse.down === undefined) return;
      // Dragging mouse is same as click
      this.onDown();
    }
  },
  PHYSICS_DEBUGGER: {
    id: 'settings-item-toolbox-physcisDebugger',
    description: `
      <b>Physics tool</b><br>
      Left-click, and/or drag, to spawn physics objects that will collide with the current mesh context.
    `,
    _heldPhysicsBall: undefined,
    onDown: function() {
      if (mouse.down === MOUSE_LEFT) { // Left click
        let rSqrd = physicsDebug.endPointRadius * physicsDebug.endPointRadius;
        if (Segment.distanceSqrd(mouse.worldLoc, physicsDebug.segment.a) < rSqrd) {
          physicsDebug.holdingPoint = 1;
        } else if (Segment.distanceSqrd(mouse.worldLoc, physicsDebug.segment.b) < rSqrd) {
          physicsDebug.holdingPoint = 2;
        } else {
          let intersect = physicsBalls.find(ball => Vector.fromSegment(mouse.worldLoc, ball.position).magnitudeSqrd() <= (ball.radius * 2)**2);
          if (intersect) {
            this._heldPhysicsBall = intersect;
          } else {
            physicsBalls.push(new PhysicsBall(mouse.worldLoc.x, mouse.worldLoc.y, layout2D.meshContext))
            physicsDebug.draggingAir = true;
            TickClock.addInterval('spawn_bubbles', _ => {
              physicsBalls.push(new PhysicsBall(mouse.worldLoc.x, mouse.worldLoc.y, layout2D.meshContext))
            }, 15);
          }
        }
      }
    },
    onMove: function() {
      if (mouse.down === undefined) return;

      if (this._heldPhysicsBall) {
        // this._heldPhysicsBall.velocity = Vector.fromSegment(this._heldPhysicsBall.position, mouse.worldLoc).normalize().multiplyBy(0.06);

        this._heldPhysicsBall.velocity = new Vector(0,0);
        this._heldPhysicsBall.prevPosition = mouse.worldLoc;
        this._heldPhysicsBall.position = mouse.worldLoc.minus(this._heldPhysicsBall.meshContext.bounds.edges[8].vector.perpendicular());
      } else
      if (physicsDebug.holdingPoint) {
        if (physicsDebug.holdingPoint === 1) {
          physicsDebug.segment = new Segment(mouse.worldLoc, physicsDebug.segment.vector)
        } else
        if (physicsDebug.holdingPoint === 2) {
          physicsDebug.segment = new Segment(physicsDebug.segment.a, mouse.worldLoc)
        }
        physicsDebug.staticCollisionTest();
      } else if (mouse.down === MOUSE_RIGHT) {
        view.pan(-mouse.dLoc.x / view.scale, -mouse.dLoc.y / view.scale);
      }
    },
    onUp: function() {
      this._heldPhysicsBall = undefined;
      physicsDebug.holdingPoint = 0;
      if (physicsDebug.draggingAir) {
        TickClock.removeInterval('spawn_bubbles');
        physicsDebug.draggingAir = false;
      }
    }
  },
}
const getMouseToolById = id => Object.values(MOUSE_TOOL).find(tool => tool.id === id);

const MOUSE_LEFT = 0;
const MOUSE_RIGHT = 1;
export let mouse = {
  /** Last mouse screen location. @type {Point} */
  _screenLoc: new Point(0, 0),
  /** Last mouse world location. @type {Point} */
  _worldLoc: undefined,
  set screenLoc(loc) {
    this._screenLoc = loc;
    this._worldLoc = undefined;
  },
  get screenLoc() {
    return this._screenLoc.copy;
  },
  get worldLoc() {
    if (this._worldLoc === undefined) {
      this._worldLoc = view.screenToWorld(this.screenLoc);
    }
    return this._worldLoc.copy;
  },
  /** Change in mouse location between mouse movements. @type {Vector} */
  dLoc: new Vector(0, 0),
  /** @type {MOUSE_TOOL} */
  selectedTool: undefined,
  /** @type {undefined | MOUSE_LEFT | MOUSE_RIGHT} */
  down: undefined,
  /** Flag for mouse label rendering. @type {boolean} */
  labelVisible: false,
}

/** Only log if not running engine. */
function debugLog() {
  if (TickClock.running()) return;
  log(...arguments);
}

// ===================================================================================== Physics =====

/** @type {[PhysicsBall]} */
let physicsBalls = [];
let _physicsBallGarbage = false;
// Number of collisions that can be compounded in a single tick
const MAX_COLLISIONS = 10;
const PHYSICS_BALL_RADIUS = 10;
const PHYSICS_BALL_FRICTION_MAGNITUDE = 12; //
const PHYSICS_BALL_GRAVITY_MAGNITUDE = 3000;
const PHYSICS_BALL_GRAVITY = new Vector(0, -PHYSICS_BALL_GRAVITY_MAGNITUDE);
const PHYSICS_BALL_REMOVE_DIST_SQRD = 4500*4500;
let physicsBallDamping = 0.7; // %
let physicsBallElastic = 1; // %

export class Circle {
  constructor(position, radius, color = 'green') {
    this.x = position.x;
    this.y = position.y;
    this.radius = radius;
    this.color = color;
  }
  get copy() {
    return this;
  }
}

const physicsDebug = {
  endPointRadius: 10,
  /** undefined - no hold, 1 - holding endpoint a, 2 - holding endpoint b */
  holdingPoint: 0,
  draggingAir: false,
  segment: new Segment({x: 100, y: 100}, {x: 200, y: 200}),
  isStaticIntersecting: false,
  intersectionPoint: false,
  reflectionPoint: false,
  render: function(context) {
    context.strokeStyle = this.isStaticIntersecting ? "green" : "red";
    context.lineWidth = this.endPointRadius * 2;
    context.beginPath();
    context.moveTo(this.segment.a.x, this.segment.a.y);
    context.lineTo(this.segment.b.x, this.segment.b.y);
    context.stroke();
    context.beginPath();
    context.lineWidth = 1;

    context.fillStyle = "white"
    context.beginPath();
    context.arc(this.segment.a.x, this.segment.a.y, this.endPointRadius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(this.segment.b.x, this.segment.b.y, this.endPointRadius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();

    if (this.isStaticIntersecting) {
      context.fillStyle = "blue"
      context.beginPath();
      context.arc(this.intersectionPoint.x, this.intersectionPoint.y, 4, 0, 2 * Math.PI);
      context.fill();

      context.beginPath();
      context.moveTo(this.intersectionPoint.x, this.intersectionPoint.y);
      context.lineTo(this.reflectionPoint.x, this.reflectionPoint.y);
      context.stroke();
      context.beginPath();
    }
  },
  staticCollisionTest: function() {
    let { intersectTime, collisionNormal, edge } = layout2D.meshContext.bounds.edges.reduce((smallest, edge, i) => {
      let {intersectTime, collisionNormal} = Collision.capsuleInSegment(edge, this.endPointRadius, this.segment);
      if (intersectTime === undefined || intersectTime > 1) return smallest;
      return (intersectTime < smallest.intersectTime) ? {intersectTime, collisionNormal, edge} : smallest;
    }, {intersectTime: Infinity});

    if (!collisionNormal) {
      this.isStaticIntersecting = false;
      return;
    };

    this.isStaticIntersecting = true;
    this.intersectionPoint = this.segment.a.copy.add(this.segment.vector.copy.multiplyBy(intersectTime));

    let reflectionVector = this.segment.vector.reflect(collisionNormal).multiplyBy(1 - intersectTime);
    this.reflectionPoint = this.intersectionPoint.copy.add(reflectionVector);

    // debugLog(`Reflection point ${}`)
  }
}

class PhysicsBall {
  constructor(x, y, meshContext, initVelocity) {
    this.position = new Point(x, y)
    this.prevPosition = this.position.copy;
    /** @type {Vector} */
    this.velocity = initVelocity ? initVelocity : new Vector(0, 0);
    /** @type {Mesh} */
    this.meshContext = meshContext;
    this.garbage = false;
    this.color = `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`
    this.radius = PHYSICS_BALL_RADIUS;
  }
  /** Apply tick to entity.
   * Entity accumulates velocity as impulses (forces) are applied. That velocity value, as a descriptor of its movement over time,
   * is applied to the position of the entity. This tick will be given the difference in time from the last tick executed.
   *
   * Forces are applied at a discrete point in time. The entity is immediately accelerated.
   *
   * We apply friction before velocity-on-position so that entities can be "stuck" to the ground until enough force
   * is applied to move it.
   * We apply gravity before velocity-on-position so that an object spawned in the air does not
   * "float" for one frame before being accelerated.
   */
  update(dT) {
    this.prevPosition = this.position.copy;
    debugLog(`Tick. Start: ${this.prevPosition.logString()} dT:${dT}`, [new Circle(this.prevPosition, this.radius, this.color), this.prevPosition.copy]);

    // Applying a constant downwards force simulates gravity. This creates the effect of an observer on the same plane as the world...
    if (!equals(PHYSICS_BALL_GRAVITY.magnitudeSqrd(), 0)) {
      this.velocity.minus(PHYSICS_BALL_GRAVITY.copy.multiplyBy(dT));
    } else // ..or..
    // Applying a constant reduction to velocity simulates friction. This creates the effect of looking down from above at the world.
    if (!equals(this.velocity.magnitudeSqrd(), 0) && PHYSICS_BALL_FRICTION_MAGNITUDE !== 0) {
      this.velocity.reduceBy(PHYSICS_BALL_FRICTION_MAGNITUDE * dT);
    }

    // Apply velocity to position based on how much time has passed since last tick (dT)
    if (!equals(this.velocity.magnitudeSqrd(), 0)) {
      debugLog(`--vInit: ${this.velocity.logString()}`, [new Circle(this.prevPosition, this.radius, this.color), new Segment(this.prevPosition.copy, this.velocity.copy.multiplyBy(dT))]);
      this.position.add(this.velocity.copy.multiplyBy(dT));
    }

    // Check static collisions - TODO - broad scope pass
    let intersections = 0;
    while (intersections < MAX_COLLISIONS) {
      let displaceA = new Segment(this.prevPosition, this.position);
      let edgesToCheck = [...this.meshContext.holes.map(hole => hole.bounds.edges).flat(), ...this.meshContext.bounds.edges];
      let { intersectTime, collisionNormal, edge } = edgesToCheck.reduce((smallest, edge, i) => {
        let {intersectTime, collisionNormal} = Collision.capsuleInSegment(edge, this.radius, displaceA);
        if (intersectTime === undefined || intersectTime > 1) return smallest;
        return (intersectTime < smallest.intersectTime) ? {intersectTime, collisionNormal, edge} : smallest;
      }, {intersectTime: Infinity});

      if (!collisionNormal) break;

      let aHitpoint = displaceA.a.copy.add(displaceA.vector.copy.multiplyBy(intersectTime));
      debugLog(` - Intersect (${intersections}) t: ${intersectTime}`, [new Circle(aHitpoint.copy, this.radius, this.color), new Segment(aHitpoint.copy, new Vector({magnitude: this.velocity.copy.multiplyBy(dT).magnitude, angle: collisionNormal.angle})), edge, new Segment(this.prevPosition.copy, this.velocity.copy.multiplyBy(dT))]);
      // let bHitpoint = edge.a.copy.add(edge.vector.copy.multiplyBy(intersectTime));

      // let remainingVelMagnitude = this.velocity.copy.multiplyBy(1 - intersectTime).magnitude;

      this.position = aHitpoint.copy; // TODO - no need to copy but easier debugLog

      // TODO - escape vectors if start position is inside a collider
      // Since we don't have good escape vector handling, we want to avoid entities being inside each other (start pos of capsule is colliding; intersectionTime == 0).
      // If there are multiple intersections in a tick, its harder to tell how to escape the entity if we keep moving the prevPosition to the point of intersection.
      // So we're not going to move the start position up to the collision point and re-evaluate from there even though this is more accurate to the path travelled.
      // We'll keep start position where it is, and treat the final position after bounce reflection as the end point. We could also keep prevPosition and still
      // re-evaluate the new capsule starting from the first intersection point but then how do we create an escape vector with the original position in mind...
      // What can we even do with that original information? So we'll leave out prevPosition updating:
      // this.prevPosition = this.position.copy;

      if (!equals(this.velocity.magnitudeSqrd(), 0)) {
        // TODO hitting an endcap, the normal for obj elastic should be a sphere on sphere escape vector (not wall segment)
        this.velocity = this.velocity.reflect(collisionNormal, physicsBallElastic, physicsBallDamping);
        this.position.add(this.velocity.copy.multiplyBy(dT).multiplyBy(1 - intersectTime));
      } else {
        // TODO - until capsule intersection returns an escape vector, if there's no velocity, it'll never leave penetrated peer
        break;
      }

      // TODO - lets just resolve all intersections (for loop until no more collisions, keep advancing the object)
      // Why: We won't be dealing with fast objects. its end-use will be slow moving pellets for wisp tank.
      // Sequential solution but deep level of intersection resolution in a tick

      // Move by remaining velocity in this tick


      // // Add remaining velocity in this tick
      // this.velocity.extendBy(remainingVelMagnitude);

      // TODO add a check for intersectTime being zero - need to make sure we move obj out of capsule
      // TODO can run entire intersection step over again for those that had intersections (on new prevPos/pos)
      debugLog(` - Reflect. ${this.velocity.logString()}`, [new Circle(aHitpoint.copy, this.radius, this.color), new Segment(aHitpoint.copy, new Vector({magnitude: this.velocity.copy.multiplyBy(dT).magnitude, angle: collisionNormal.angle})), edge]);

      intersections++;
    }

    // // Apply velocity - if no collision
    // if (!equals(this.velocity.magnitudeSqrd(), 0)) {
    //   this.position.add(this.velocity.copy.multiplyBy(dT))
    // }

    // Delete below dead zone

    if (Segment.distanceSqrd({x: -view.x, y: -view.y}, this.position) > PHYSICS_BALL_REMOVE_DIST_SQRD) {
      this.remove();
    }
  }

  // Check peer collision should happen after physics applied to all bodies so
  // collision interpolation can be performed.
  // Assumes this and peer are circles. Does not check capsule collision - only line collision
  handleCollisionTick(dT, peer) {
    if (this === peer || peer.garbage) return;

    let displaceA = new Segment(this.prevPosition, this.position);
    let displaceB = new Segment(peer.prevPosition, peer.position);

    let intersectTime = Collision.capsuleInCapsule(displaceA, this.radius, displaceB, peer.radius);
    if (intersectTime === undefined || intersectTime > 1) return;

    let aHitpoint = displaceA.a.copy.add(displaceA.vector.copy.multiplyBy(intersectTime));
    let bHitpoint = displaceB.a.copy.add(displaceB.vector.copy.multiplyBy(intersectTime));

    let vDisplace = Vector.fromSegment(aHitpoint, bHitpoint); // position b - a
    let velResult = peer.velocity.copy.minus(this.velocity); // vel b - a

    // Apply elastic collision
    this.velocity.minus(
      vDisplace.copy.flip().multiplyBy(velResult.copy.flip().dotProduct(vDisplace.copy.flip()) / Math.pow(vDisplace.magnitude, 2))
    );
    peer.velocity.minus(
      vDisplace.copy.multiplyBy(velResult.dotProduct(vDisplace) / Math.pow(vDisplace.magnitude, 2))
    );

    // Move colliders out of each other
    this.position = aHitpoint;
    peer.position = bHitpoint;

    this.position.add(this.velocity.copy.multiplyBy(dT).multiplyBy(1 - intersectTime))
    peer.position.add(peer.velocity.copy.multiplyBy(dT).multiplyBy(1 - intersectTime))
  }

  render(context) {
    context.strokeStyle = 'gray';
    context.beginPath();
    context.moveTo(this.prevPosition.x, this.prevPosition.y);
    context.lineTo(this.position.x, this.position.y);
    context.stroke();

    context.fillStyle = this.color;
    context.beginPath();
    context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI)
    context.fill();
  }

  remove() {
    this.garbage = true;
    _physicsBallGarbage = true;
  }
}

// ===================================================================================== UI Setup =====
const canvasElem = document.getElementById("bgCanvas");
const toolboxButtonsElem = document.getElementById('settings-item-toolbox-buttons');
const toolboxDescriptionElem = document.getElementById('settings-item-toolbox-description');
const devPaneElem = document.getElementById('dev-pane');
const devPaneControlSettingsElem = document.getElementById('dev-pane-controls-settings');
const settingItemClearBallsElem = document.getElementById('setting-item-clearBalls');
const settingItemConsoleToggleElem = document.getElementById('setting-item-console-toggle');

/** Primary canvas element 2D context @type {CanvasRenderingContext2D} */
const canvasMasterContext = canvasElem.getContext('2d');

/** Flag controlling canvas clearing. @type {boolean} */
let canvasFlush = true;
/** Primary layout obj. @type {Layout} */
let layout2D = undefined;

// Toggles
Object.entries({
  'setting-item-updateToggle': toggleCanvasRunning,
  'setting-item-mouseLabelToggle': toggleMouseLabel,
  'setting-item-canvasOrigin': toggleCanvasOrigin,
  'setting-item-renderIndicator': toggleRenderIndicator,
  'setting-item-smearToggle': toggleSmearRendering,
  'setting-item-triangulate-highlight-edges': toggleTriangulateHighlightEdges,
  // 'setting-item-triangulate-optimize-pass': _ => {},
  'setting-item-console-text-render': toggleConsoleTextLabels,
  'setting-item-console-toggle': toggleConsole
}).forEach(([elemId, callback]) =>
  document.getElementById(elemId).addEventListener('click', e => {
    e.target.classList.toggle("active");
    callback(e);
    e.preventDefault();
  })
);

// Buttons
Object.entries({
  'setting-item-mesh-reset': resetLayout,
  'setting-item-centerCamera': centerCamera,
  'setting-item-mesh-load': loadLayout,
  'setting-item-mesh-print': printLayout,
  'setting-item-console-clear': clearConsole,
  'setting-item-randomPath': randomPath,
  'setting-item-toggle-control-window': toggleControlWindow,
  'setting-item-stepTick': TickClock.stepTick,
  'setting-item-clearBalls': clearPhysicsBalls
}).forEach(([elemId, callback]) =>
  document.getElementById(elemId).addEventListener('click', e => {
    callback(e);
    e.preventDefault();
  })
);

// Inputs
Object.entries({
  'setting-item-input-damping': updateDamping,
  'setting-item-input-elastic': updateElastic
}).forEach(([elemId, callback]) => {
  let elem = document.getElementById(elemId);
  let text = elem.innerHTML;
  elem.innerHTML = '';
  let inputElem = document.createElement('input');
  inputElem.setAttribute('title', text);
  inputElem.setAttribute('id', `${elemId}-input`);
  elem.append(inputElem);
  let labelElem = document.createElement('p');
  labelElem.innerHTML = text;
  elem.append(labelElem);
  inputElem.addEventListener('keydown', e => {
    if (e.keyCode === KEY_CODE.ENTER) {
      callback(inputElem);
      e.preventDefault();
    }
  })
})

// Directional arrow setter
Object.entries({
  'setting-item-arrow-gravity': setupGravityControl
}).forEach(([elemId, callback]) => {
  let elem = document.getElementById(elemId);
  let text = elem.innerHTML;
  elem.innerHTML = '';
  let canvasElem = document.createElement('canvas');
  canvasElem.setAttribute('id', `canvas-${elemId}`);
  canvasElem.width = 60;
  canvasElem.height = 60;
  elem.append(canvasElem);
  let labelElem = document.createElement('p');
  labelElem.innerHTML = text;
  elem.append(labelElem);
  callback(canvasElem);
})

// Mouse Toolbox
Array.of(
  'settings-item-toolbox-pointer',
  'settings-item-toolbox-constructor',
  'settings-item-toolbox-eraser',
  'settings-item-toolbox-pather',
  'settings-item-toolbox-physcisDebugger'
).forEach(elemId => document.getElementById(elemId).addEventListener('click', handleToolboxClick));

// Dev pane resizing
const devPaneMouseMoveHandler = e => {
  let scrollY = (e.target.getBoundingClientRect().top + e.offsetY) - devPaneElem.offsetTop - 10;
  const MIN_SIZE = 30;
  if (scrollY > devPaneElem.offsetHeight - MIN_SIZE) {
    document.removeEventListener('mousemove', devPaneMouseMoveHandler);
    settingItemConsoleToggleElem.click();
  } else {
    devPaneControlSettingsElem.style.height = `${scrollY}px`
  }
  e.preventDefault();
}
document.getElementById('dev-pane-content-divider').addEventListener('mousedown', e => {
  document.addEventListener('mousemove', devPaneMouseMoveHandler)
  e.preventDefault();
});
document.addEventListener('mouseup', e => {
  document.removeEventListener('mousemove', devPaneMouseMoveHandler)
  e.preventDefault();
});
document.addEventListener('mouseleave', e => {
  document.removeEventListener('mousemove', devPaneMouseMoveHandler)
})

function updateDamping(inputElement) {
  let parsed = parseInt(inputElement.value);
  if (isNaN(parsed)) {
    inputElement.value = `${physicsBallDamping}`
  } else {
    physicsBallDamping = inputElement.value
  }
}
function updateElastic(inputElement) {
  let parsed = parseInt(inputElement.value);
  if (isNaN(parsed)) {
    inputElement.value = `${physicsBallElastic}`
  } else {
    physicsBallElastic = inputElement.value
  }
}
function setupGravityControl(canvasElem) {
  let gravityControlContext = canvasElem.getContext('2d');
  gravityControlContext.strokeStyle = 'black';
  gravityControlContext.fillStyle = 'gray';
  let width = 60;
  let height = 60;
  let pCenter = new Point(width / 2, height / 2);
  const renderIndicator = vDirectionIndicator => {
    let pDirectionIndicator = pCenter.copy.add(vDirectionIndicator);
    gravityControlContext.clearRect(0, 0, width, height)
    gravityControlContext.beginPath();
    gravityControlContext.arc(pCenter.x, pCenter.y, 2, 0, 2 * Math.PI);
    gravityControlContext.fill();
    gravityControlContext.beginPath();
    gravityControlContext.moveTo(pCenter.x, pCenter.y)
    gravityControlContext.lineTo(pDirectionIndicator.x, pDirectionIndicator.y);
    gravityControlContext.stroke();
  }
  const mouseMoveHandler = e => {
    // Get mouse location
    e.preventDefault();
    let rect = canvasElem.getBoundingClientRect();
    let loc = new Point(Math.floor(e.clientX - rect.left), (e.clientY - rect.top))

    // Compute new gravity direction
    let vDirectionIndicator = Vector.fromSegment(pCenter, loc);
    PHYSICS_BALL_GRAVITY.angle = vDirectionIndicator.angle - Math.PI;

    // Render indicator
    vDirectionIndicator.magnitude = width;
    renderIndicator(vDirectionIndicator);
  }
  canvasElem.addEventListener('mousedown', e => {
    document.addEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler(e);
  });
  document.addEventListener('mouseup', _ => document.removeEventListener('mousemove', mouseMoveHandler));
  document.addEventListener('mouseleave', _ => document.removeEventListener('mousemove', mouseMoveHandler));

  renderIndicator(PHYSICS_BALL_GRAVITY.copy.flip());
}
function toggleCanvasRunning() {
  TickClock.running() ? TickClock.stop() : TickClock.resume();
}
function toggleRenderIndicator() {
  tickClockRunningIndicator = !tickClockRunningIndicator;
}
function toggleCanvasOrigin() {
  canvasOriginIndicator = !canvasOriginIndicator;
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
  if (!TickClock.running()) render();
}
function toggleTriangulateHighlightEdges() {
  LayoutManager.triangulationVisible(!LayoutManager.visibleTriangulation)
}
function toggleConsole() {
  devPaneControlSettingsElem.style.height = '';
  devPaneControlSettingsElem.classList.toggle("max-height");
}
function toggleConsoleTextLabels() {
  toggleTextLabels()
  if (!TickClock.running()) render();
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
function toggleControlWindow(e) {
  if (devPaneElem.classList.contains("hidden")) {
    e.target.innerHTML = "Minimize Dev Pane";
    devPaneControlSettingsElem.style.overflowY = "";
    devPaneControlSettingsElem.classList.remove('disabled');
  } else {
    e.target.innerHTML = "Maximize Dev Pane";
    devPaneControlSettingsElem.style.overflowY = "hidden";
    devPaneControlSettingsElem.classList.add('disabled');
  }
  devPaneElem.classList.toggle("hidden");
  devPaneControlSettingsElem.classList.toggle("hidden");
}
function clearPhysicsBalls() {
  physicsBalls.forEach(ball => ball.remove());
}
function loadLayout() {
  document.getElementById('modal-layout-load').style.display = 'block';
}
function resetLayout() {
  LayoutManager.reloadDefaultLayout().then(layout => layout2D = layout);
}
function centerCamera() {
  view.x = 0;
  view.y = 0;
  view.applyTransform();
}
function printLayout() {
  log(layout2D.serialized());
}

function handleToolboxClick(e) {
  for (const child of toolboxButtonsElem.children) {
    child.className = ""
  }

  let selectedTool = getMouseToolById(e.target.id);
  if (!selectedTool) throw Error('Mouse tool target unknown.');

  e.target.className = "active";
  toolboxDescriptionElem.innerHTML = selectedTool.description || "";
  LayoutManager.setPathfindingRoute([]);
  flushTestShapes();

  if (mouse.down) {
    mouse.selectedTool?.onUp?.bind(mouse.selectedTool)();
  }
  mouse.selectedTool = selectedTool;
  mouse.selectedTool.onSelection?.bind(mouse.selectedTool)();
}

// ============================================================================== Test rendering =====
let test_points = [];
let test_lines = [];
let test_circles = [];

let contentOut = document.getElementById("content-output")
let contentOutScrolling = false
let contentOutTrackLastMouseMove = 0
const CONTENT_OUT_SCROLL_SPEED = 1
attachLogOut(contentOut)
addLogSelectedNotifier(_ => {
  if (!TickClock.running()) render();
});
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
    canvasMasterContext.font = `${20 / view.scale}px sans-serif`;
    canvasMasterContext.fillText(Math.floor(mouse.worldLoc.x)+', '+Math.floor(mouse.worldLoc.y), mouse.worldLoc.x+5/view.scale, mouse.worldLoc.y-5/view.scale);
  }
  if (mouse.selectedTool === MOUSE_TOOL.MESH_CONSTRUCTOR) {
    canvasMasterContext.strokeStyle = "red"
    canvasMasterContext.lineWidth = 1 / view.scale;
    canvasMasterContext.beginPath();
    let length = MOUSE_TOOL.MESH_CONSTRUCTOR._snapDistance / view.scale;
    let xCenter = mouse.worldLoc.x;
    let yCenter = mouse.worldLoc.y;
    canvasMasterContext.moveTo(xCenter - length, yCenter);
    canvasMasterContext.lineTo(xCenter + length, yCenter);
    canvasMasterContext.moveTo(xCenter, yCenter - length);
    canvasMasterContext.lineTo(xCenter, yCenter + length);
    canvasMasterContext.moveTo(xCenter + length, yCenter);
    canvasMasterContext.arc(xCenter, yCenter, length, 0, 2 * Math.PI)
    canvasMasterContext.stroke();
    canvasMasterContext.lineWidth = 1;
  }
  canvasMasterContext.strokeStyle = "rgb(20, 180, 20)";
  canvasMasterContext.fillStyle = "rgb(20, 180, 20)";
  canvasMasterContext.font = '16px sans-serif';

  renderLogData(canvasMasterContext)
}
function flushTestShapes() {
  test_circles = [];
}

// =========================================================================================== Clock =====

function update(dT) {
  // Cleanup entities
  if (_physicsBallGarbage) {
    physicsBalls = physicsBalls.filter(ball => !ball.garbage);
    _physicsBallGarbage = false;
  }
  settingItemClearBallsElem.innerHTML = `Clear Physics Balls (${physicsBalls.length})`;

  physicsBalls.forEach(ball => ball.update(dT));

  // Check collisions
  for (let iA = 0; iA < physicsBalls.length; iA++) {
    let peerA = physicsBalls[iA];
    for (let iB = iA + 1; iB < physicsBalls.length; iB++) {
      let peerB = physicsBalls[iB];
      peerA.handleCollisionTick(dT, peerB);
    }
  }

  // Scale accel
  if (Math.abs(scaleVel) <= scaleDecel) scaleVel = 0;
  else {
    view.scaleAt(scaleVel, mouse.worldLoc);
    scaleVel -= Math.sign(scaleVel) * scaleDecel;
  };
}

function render() {
  if (canvasFlush) {
    // Reset to identity matrix for cleaning
    // canvasMasterContext.setTransform(1, 0, 0, 1, 0, 0);
    // canvasMasterContext.clearRect(0, 0, canvasElem.width, canvasElem.height)
    // view.applyTransform();

    let worldLocStart = view.screenToWorld({x: 0, y: 0});
    let worldLocEnd = view.screenToWorld({x: canvasElem.width, y: canvasElem.height});
    let w = worldLocEnd.x - worldLocStart.x;
    let h = worldLocEnd.y - worldLocStart.y;
    canvasMasterContext.clearRect(worldLocStart.x, worldLocStart.y, w, h);
  }

  physicsBalls.forEach(ball => ball.render(canvasMasterContext));

  let heldPhysicsBall = MOUSE_TOOL.PHYSICS_DEBUGGER._heldPhysicsBall;
  if (heldPhysicsBall) {
    canvasMasterContext.strokeStyle = 'red';
    canvasMasterContext.beginPath();
    canvasMasterContext.moveTo(heldPhysicsBall.position.x, heldPhysicsBall.position.y);
    canvasMasterContext.lineTo(mouse.worldLoc.x, mouse.worldLoc.y);
    canvasMasterContext.stroke();
  }

  TCRI_render(canvasMasterContext);
  canvasOrigin_render(canvasMasterContext);

  LayoutManager.renderPathfinding(canvasMasterContext);
  if (canvasFlush) {
    LayoutManager.renderTriangulation(layout2D, canvasMasterContext);
    LayoutManager.constructionRender(canvasMasterContext);
  }

  if (contentOutScrolling) contentOut.scrollTop += CONTENT_OUT_SCROLL_SPEED

  // Render physics debug line
  if(mouse.selectedTool === MOUSE_TOOL.PHYSICS_DEBUGGER) {
    physicsDebug.render(canvasMasterContext);
  }

  renderTestShapes()
}

// Tick Clock Running Indicator
let tickClockRunningIndicator = false;
let canvasOriginIndicator = false;
let TCRI_step = 0;
let _TCRI_radius = 10;
let _TCRI_subdiv_radius = 5;
let _TCRI_subdiv = 60;
let _TCRI_subdiv_angle = (2 * Math.PI) / _TCRI_subdiv;
let _TCRI_center = new Point(20, 20);
let _TCRI_pos_arr = Array(_TCRI_subdiv).fill().map((_, i) => _TCRI_center.copy.add(new Vector({magnitude: _TCRI_radius, angle: i * _TCRI_subdiv_angle})));
function TCRI_render(context) {
  if (!tickClockRunningIndicator) return;
  TCRI_step = (TCRI_step + 1) % _TCRI_subdiv;

  let worldLoc = view.screenToWorld(_TCRI_center);
  context.fillStyle = 'grey';
  context.beginPath();
  context.arc(worldLoc.x, worldLoc.y, (_TCRI_radius + _TCRI_subdiv_radius) / view.scale, 0, 2 * Math.PI);
  context.fill();
  let tcri_pos = view.screenToWorld(_TCRI_pos_arr[TCRI_step]);
  context.fillStyle = 'white';
  context.beginPath();
  context.arc(tcri_pos.x, tcri_pos.y, _TCRI_subdiv_radius / view.scale, 0, 2 * Math.PI);
  context.fill();
}
const _canvasOriginLength = 20;
function canvasOrigin_render(context) {
  if (!canvasOriginIndicator) return;

  let length = _canvasOriginLength / view.scale;
  context.lineWidth = 1 / view.scale;
  context.strokeStyle = 'orange';
  context.beginPath();
  context.moveTo(-length, 0);
  context.lineTo(length, 0);
  context.moveTo(0, -length);
  context.lineTo(0, length);
  context.stroke();
  context.lineWidth = 1;
}

// ======================================================================================================================= Window Setup =====
const KEY_CODE = {
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
  ARROW_LEFT: 37,
  SPACEBAR: 32,
  ENTER: 13,
  TAB: 9,
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
    case KEY_CODE.ARROW_RIGHT:
      TickClock.stepTick();
      keyDownEvent.preventDefault()
      break;
    case KEY_CODE.TAB:
      document.getElementById('setting-item-toggle-control-window').click();
      keyDownEvent.preventDefault()
      break;
    case KEY_CODE.SPACEBAR:
      document.getElementById('setting-item-updateToggle').click();
      break;
    case KEY_CODE.V:
      let childElements = Array.from(toolboxButtonsElem.children);
      let iActive = childElements.findIndex(child => child.classList.contains('active'))
      iActive = (iActive + 1) % childElements.length;
      childElements[iActive].click();
      break;
  }
}
document.addEventListener('keydown', handleKeyDown)

canvasElem.addEventListener('mousedown', e => {
  mouse.screenLoc = new Point(e.offsetX, e.offsetY);
  mouse.down = (e.button === MOUSE_LEFT) ? MOUSE_LEFT : MOUSE_RIGHT;

  mouse.selectedTool?.onDown?.bind(mouse.selectedTool)();

  e.preventDefault();
})

canvasElem.addEventListener('mousemove', e => {
  let newLoc = new Point(e.offsetX, e.offsetY);
  mouse.dLoc = Vector.fromSegment(mouse.screenLoc, newLoc);
  mouse.screenLoc = newLoc;

  disableLogging(true); // Prevent log spam
  mouse.selectedTool?.onMove?.bind(mouse.selectedTool)();
  if (!TickClock.running()) render();
  disableLogging(false);

  e.preventDefault()
})

canvasElem.addEventListener('mouseup', _ => {
  mouse.down = undefined;

  mouse.selectedTool?.onUp?.bind(mouse.selectedTool)();
})

canvasElem.addEventListener('wheel', e => {
  scaleVel += Math.sign(e.deltaY) * scaleAccel;
  if (!TickClock.running()) render();
})

canvasElem.oncontextmenu = e => e.preventDefault()

window.onresize = () => homeRefit()

function homeRefit() {
  // Sync canvas size
  canvasElem.width = canvasElem.offsetWidth;
  canvasElem.height = canvasElem.offsetHeight;

  // Each time the height or width of a canvas is set,
  // the canvas transforms will be cleared. Reset transforms.
  view.applyTransform();
}

// ======================================================================================================================= Launch =====

{
  homeRefit();

  LayoutManager.setLayoutCookieKey('js-2d-pathing-layout')
  LayoutManager.setDefaultJsonLayoutUrl('layout_default.json')
  layout2D = new Layout();
  LayoutManager.initLayout().then(layout => {
    layout2D = layout;
  });

  TickClock.addInterval('update', update)
  TickClock.addInterval('render', render, RENDER_HERTZ)
  TickClock.start()
  handleToolboxClick({target: document.getElementById('settings-item-toolbox-pointer')});
  document.getElementById('setting-item-input-damping-input').value = `${physicsBallDamping}`;
  document.getElementById('setting-item-input-elastic-input').value = `${physicsBallElastic}`;

  document.getElementById('setting-item-toggle-control-window').click();
  document.getElementById('setting-item-canvasOrigin').click();
  LayoutManager.setConstructionSnapDistance(MOUSE_TOOL.MESH_CONSTRUCTOR._snapDistance);
}
