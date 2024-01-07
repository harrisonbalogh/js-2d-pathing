import Mesh from './Mesh.js'
import { Polygon, Point, Segment } from '../../node_modules/@harxer/geometry/geometry.js';
import getRoute from './Pathfinding.js'
import getTriangulatedGraph from './Triangulation.js'
import { mouse } from '../core.js'
import log from '../log.js'


let constructingVertices = [];
export const hasConstructorVertices = _ => constructingVertices.length > 0;
let _constructingCcw = false;
let pathfindingRoute = []
let routing = undefined
let defaultJsonLayoutUrl = "javascript/Layout2D/layout_default.json";
export let bounds = {
  width: undefined,
  height: undefined,
  xInset: undefined,
  yInset: undefined
}

/**
 * This defines the current triangulation space. If the scene is empty, this
 * will be undefined. The first mesh to be added is the highest level mesh context.
 * The holes of this mesh can then be selected as the current context - down the
 * cascading tree of hole meshes.
 * @type {Mesh}
 */
let meshContext = undefined;
/**
 * Root-most mesh object present in scene. This object can be traversed for all other
 * meshes present in the scene through the Mesh `holes` property.
 * @type {Mesh}
 */
let rootMesh = undefined;
let layoutPolygons = [];

export let optimizeTriangulation = false
export function triangulationOptimized(val) {
  if (val != optimizeTriangulation) {
    if (meshContext) meshContext.needsTriangulation();
    optimizeTriangulation = val
  }
}

export let visibleTriangulation = false
export function triangulationVisible(val) {
  visibleTriangulation = val
}

/** Returns latest mesh addition. */
function insertMeshContextHole(vertices) {
  let polygon = new Polygon(vertices);

  // If scene is empty, need to define mesh root.
  if (meshContext === undefined) {
    if (polygon.counterclockwise) {
      console.error('Root boundary must be CCW.')
      return; // Root must be CCW
    }
    rootMesh = new Mesh(polygon);
    meshContext = rootMesh;
    layoutPolygons = [polygon];
    log(`Creating root boundary.`, [polygon])
    return meshContext;
  }

  meshContext.needsTriangulation();
  log(`Adding polygon.`, [polygon])
  layoutPolygons.push(polygon);
  return meshContext.applyHole(polygon);
}

export function contextSelection(p) {
  if (meshContext === undefined) return;
  let holeSelected = meshContext.holes.find(hole => !hole.bounds.containsPoint(p));

  if (holeSelected) {
    meshContext = holeSelected;
    log(`Selected hole`, [meshContext.bounds])
  } else {
    if (meshContext.bounds.containsPoint(p)) {
      if (meshContext.parent !== undefined) {
        meshContext = meshContext.parent;
      }
    }
  }
}

// TODO
// /** Returns removal count */
// function deleteBlocker(blockerIndex) {
//   needsTriangulation = true
//   if (blockers[blockerIndex] === bounds.blocker) bounds.blocker = undefined
//   return blockers.splice(blockerIndex, 1).length;
// }

export function addConstructionPoint(p) {
  if (constructingVertices.length == 0) {
    constructingVertices.push(p);
  } else {
    let mouseDistToStartSqrd = Segment.distanceSqrd(mouse.contextLoc, constructingVertices[0])
    if (constructingVertices.length > 2) {
      if (mouseDistToStartSqrd < 64) {
        finishConstruction()
        return
      } else {
        constructingVertices.push(p);
      }
    } else if (mouseDistToStartSqrd > 64) {
      constructingVertices.push(p);
    }
    syncConstructingCcw();
  }
}
export function undoConstructionPoint() {
  if (!hasConstructorVertices()) return;
  constructingVertices.pop();
  syncConstructingCcw();
}

function syncConstructingCcw() {
  let averageSlope = 0
  for (let i = 0; i < constructingVertices.length; i++) {
    let v = constructingVertices[i]
    let vNext = constructingVertices[(i + 1) % constructingVertices.length]
    averageSlope += (vNext.x - v.x) * (vNext.y + v.y)
  }
  _constructingCcw = (averageSlope > 0)
}

export function finishConstruction(p) {
  if (constructingVertices.length > 2) insertMeshContextHole(constructingVertices)
  clearConstruction();
  setCookie('layoutData', serialized(), 365)
}

/** Delete blocker if contains point `p` */
export function deleteMeshUnderPoint(p) {
  if (meshContext === undefined) return;
  let iHoleCollision = meshContext.holes.findIndex(hole => !hole.bounds.containsPoint(p))
  if (iHoleCollision > -1) {
    meshContext.holes.splice(iHoleCollision, 1);
    meshContext.needsTriangulation();
    setCookie('layoutData', serialized(), 365)
  } else {
    if (meshContext === rootMesh && rootMesh.bounds.containsPoint(p)) {
        // Remove root if highlighted and outer click
        meshContext = undefined;
        rootMesh = undefined;
    }
  }
}

export function clearConstruction() {
  constructingVertices = [];
  _constructingCcw = false
}

export function constructionRender(context) {
  // Draw postprocessed blocker
  layoutPolygons.forEach(blocker => {
    if (blocker === undefined) return
    // Draw boundaries
    context.strokeStyle = "gray";
    context.beginPath();
    blocker.vertices.forEach((vertex, i) => {
      if (i == 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.lineTo(blocker.vertices[0].x, blocker.vertices[0].y);
    context.stroke();

    // Draw holes
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    blocker.holes.forEach((hole) => {
      hole.vertices.forEach((vertex, i) => {
        if (i == 0) {
          context.beginPath();
          context.moveTo(vertex.x, vertex.y);
        } else {
          context.lineTo(vertex.x, vertex.y);
        }
      });
      context.lineTo(hole.vertices[0].x, hole.vertices[0].y);
      context.fill();
    });
  });

  // Draw construction vertices
  let mouseDistToStartSqrd = undefined
  if (constructingVertices.length > 0) {
    mouseDistToStartSqrd = Segment.distanceSqrd(mouse.contextLoc, constructingVertices[0])
  }
  context.strokeStyle = _constructingCcw ? "Blue" : "Red";
  context.fillStyle = _constructingCcw ? "Blue" : "Red";
  context.font = '14px sans-serif';
  for (let c = 0; c < constructingVertices.length; c++) {
    let vertex = constructingVertices[c];
    if (c == 0) {
      if (constructingVertices.length < 2 || mouseDistToStartSqrd > 64) {
        context.fillText(vertex.logString(), vertex.x+5, vertex.y-5);
      } else {
        context.beginPath();
        context.arc(vertex.x, vertex.y, 8, 0, 2 * Math.PI, false);
        context.stroke();
        context.fillText((constructingVertices.length > 2) ? 'Close Polygon' : 'Too Small', vertex.x+6, vertex.y-6);
      }
    } else {
      context.fillText(vertex.logString(), vertex.x+5, vertex.y-5);
    }
    if (c > 0) {
      context.beginPath();
      context.moveTo(constructingVertices[c-1].x, constructingVertices[c-1].y);
      context.lineTo(vertex.x, vertex.y);
      context.stroke();
    }
    if (c == constructingVertices.length - 1 ) {
      context.beginPath();
      context.moveTo(vertex.x, vertex.y);
      if (mouseDistToStartSqrd > 64) {
        context.lineTo(mouse.contextLoc.x, mouse.contextLoc.y);
      } else {
        context.lineTo(constructingVertices[0].x, constructingVertices[0].y);
      }
      context.stroke();

      if (mouseDistToStartSqrd > 64) {
        context.beginPath();
        context.arc(mouse.contextLoc.x, mouse.contextLoc.y, 3, 0, 2 * Math.PI, false);
        context.stroke();
      }
    }

    context.beginPath();
    context.arc(vertex.x, vertex.y, 3, 0, 2 * Math.PI, false);
    context.stroke();
  }
}

export function route(origin, destination, logged = true) {
  origin = meshContext.bounds.closestPointOutsideFrom(origin)
  destination = meshContext.bounds.closestPointOutsideFrom(destination)

  meshContext.holes.forEach(hole => {
    origin = hole.bounds.closestPointOutsideFrom(origin)
    destination = hole.bounds.closestPointOutsideFrom(destination)
  })

  // move origin and destination outside of any blockers
  // blockers.forEach(blocker => {
  //   origin = blocker.polygon.closestPointOutsideFrom(origin)
  //   destination = blocker.polygon.closestPointOutsideFrom(destination)
  // })

  routing = {origin: origin, destination: destination}
  let route = getRoute(getTriangulation(), origin, destination, logged)

  let routePolygons = (route.route || []).map(r => r.polygon)
  meshContext.triangulationPolygons.forEach(triangle => triangle.highlighted = routePolygons.includes(triangle))

  let pathBuilder = []
  for (let p = 1; p < (route.path || []).length; p++) {
    pathBuilder.push(new Segment(route.path[p-1], route.path[p]))
  }
  pathfindingRoute = pathBuilder
}

/**
 * Ensure triangles are generated or regenerated if the layout was changed between the last triangulation
 */
function getTriangulation() {
  if (meshContext === undefined) return;
  if (meshContext._needsTriangulation) {
    try {
      meshContext.setTriangulation(getTriangulatedGraph(meshContext.bounds, meshContext.holes.map(hole => hole.bounds.copy.reverse())))
    } catch(e) {
      console.log(`No bridges ${e}`, e)
      meshContext.setTriangulation([]);
    }
    log(`Triangles`, meshContext.triangulationPolygons)
    if (routing !== undefined) route(routing.origin, routing.destination)
  }

  return meshContext.triangulationPolygons
}

export function renderTriangulation(context) {
  if (meshContext === undefined) return;
  getTriangulation()

  meshContext.triangulationPolygons.forEach(polygon => {
    context.strokeStyle = "rgba(50, 50, 200, 0.2)"
    context.fillStyle = "rgba(55, 55, 180, 0.1)"
    if (polygon.highlighted !== undefined && polygon.highlighted) {
      context.fillStyle = "rgba(50, 50, 200, 0.2)"
    }
    context.beginPath();
    context.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
    polygon.vertices.forEach(vertex => context.lineTo(vertex.x, vertex.y))
    context.lineTo(polygon.vertices[0].x, polygon.vertices[0].y);
    if (polygon.counterclockwise) context.fill()
    if (visibleTriangulation) context.stroke();
  });

  pathfindingRoute.forEach(segment => {
    context.strokeStyle = "rgb(50, 50, 50)"
    context.fillStyle = "rgb(100, 100, 100)"

    context.beginPath()
    context.arc(segment.a.x, segment.a.y, 2, 0, 2 * Math.PI, false)
    context.stroke()
    context.beginPath()
    context.arc(segment.b.x, segment.b.y, 2, 0, 2 * Math.PI, false)
    context.fill()
    context.beginPath()
    context.moveTo(segment.a.x, segment.a.y)
    context.lineTo(segment.b.x, segment.b.y)
    context.stroke()
  })
}

/** Recursive JSON builder for layout meshes. */
export function serialized() {
  if (rootMesh === undefined) return;

  const _serializeNode = (node) => { return {
    bounds: node.bounds.vertices.map(v => {return {x: v.x, y: v.y}}),
    holes: node.holes.map(_serializeNode)
  }}

  return JSON.stringify([_serializeNode(rootMesh)]);
}

export function reset() {
  setCookie('layoutData', '', 0)
  loadFromServer()
}

export function load() {
  if (!loadFromCookies()) {
    loadFromServer()
  }
}

/// Load cookie cached layout
function loadFromCookies() {
  let cookieData = getCookie('layoutData')
  if (cookieData !== '') {
    parseLayout(cookieData);
    return true
  }
  return false
}

/// Load default server layout JSON
function loadFromServer() {
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      parseLayout(this.responseText);
      // Save to cookies
      setCookie('layoutData', serialized(), 365)
    }
  };
  xmlhttp.open("GET", defaultJsonLayoutUrl, true);
  xmlhttp.send();
}

/** Parses a serialized (to JSON) layout string. */
export function parseLayout(serializedLayoutString) {
  const _processNode = (node, parent) => {
    node.holes.forEach(hole => {
      let polygon = new Polygon(hole.bounds).reverse();
      layoutPolygons.push(polygon);
      _processNode(hole, parent.applyHole(polygon));
    })
  }
  let node = JSON.parse(serializedLayoutString)[0];
  meshContext = undefined; // Reset root
  _processNode(node, insertMeshContextHole(node.bounds));
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}