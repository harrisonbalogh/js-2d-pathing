import Blocker from './Blocker.js'
import { Polygon, Point, Segment } from '../../node_modules/@harxer/geometry/geometry.js';
import getRoute from './Pathfinding.js'
import getTriangulatedGraph from './Triangulation.js'
import { mouse } from '../core.js'
import log from '../log.js'

let blockers = [];
let constructingVertices = []; // Used by editMode
let constructingCcw = false
let needsTriangulation = true
let triangulationTriangles = undefined
let pathfindingRoute = []
let routing = undefined
let IS_BOUNDS_BLOCKER = true
let defaultJsonLayoutUrl = "javascript/Layout2D/layout_default.json";
export let bounds = {
  blocker: undefined,
  width: undefined,
  height: undefined,
  xInset: undefined,
  yInset: undefined
}

export let optimizeTriangulation = true
export function triangulationOptimized(val) {
  if (val != optimizeTriangulation) {
    needsTriangulation = true
    optimizeTriangulation = val
  }
}

export let visibleTriangulation = false
export function triangulationVisible(val) {
  if (val != visibleTriangulation) {
    visibleTriangulation = val
  }
}

/// TODO: Test if any edges overlap here in blocker creation. This means the blocker is invalid
/**
 * Provides convenience construction and render methods for polygons. Pathfinding will use the global
 * blockers array to create the world graph layout. Each object will track its original constructing
 * vertices but its final polygon may be altered in the case of unions or holes.
 * @param vertices - Array of points that make up a blocker. CW fills internally. CCW fills externally.
 * @param originalVertices - Array of vertices that formed this blocker's polygon before union.
 * @param holes - Array of polygons. Primarly used for drawing inaccessible areas. NYI.
 */
export function newBlocker(vertices, isBoundsBlocker = false) {
  // Dep: Extrude blocker to keep pathers from getting too close to blocker
  // vertices = extrudeVertices(vertices, 10)
  let originalVertices = [vertices]
  let newPolygon = new Polygon(vertices)

  // Union overlapping blockers
  for (let b = 0; b < blockers.length; b++) {
    if (newPolygon.overlaps(blockers[b].polygon)) {
      newPolygon = newPolygon.union(blockers[b].polygon)
      originalVertices = originalVertices.concat(blockers[b].originalVertices)
      b -= deleteBlocker(b)
    }
  }

  needsTriangulation = true
  blockers.push(new Blocker(newPolygon, originalVertices));
  if (isBoundsBlocker) {
    console.log(`Set bounds blocker ${vertices}`)
    // Assumes the first blocker (bounds blocker) is a square. TODO - update
    bounds.blocker = blockers[blockers.length - 1]
    bounds.xInset = newPolygon.vertices[0].x
    bounds.yInset = newPolygon.vertices[0].y
    bounds.width = newPolygon.vertices[3].x - bounds.xInset
    bounds.height = newPolygon.vertices[1].y - bounds.yInset
  }
}
/** Returns removal count */
function deleteBlocker(blockerIndex) {
  needsTriangulation = true
  if (blockers[blockerIndex] === bounds.blocker) bounds.blocker = undefined
  return blockers.splice(blockerIndex, 1).length;
}

export function renderBlockers(context) {
  blockers.forEach(blocker => blocker.render(context))
}

export function addConstructionPoint(p) {
  if (constructingVertices.length == 0) {
    constructingVertices.push(p);
  } else {
    let mouseDistToStartSqrd = Segment.distanceSqrd(mouse.loc, constructingVertices[0])
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

    let averageSlope = 0
    for (let i = 0; i < constructingVertices.length; i++) {
      let v = constructingVertices[i]
      let vNext = constructingVertices[(i + 1) % constructingVertices.length]
      averageSlope += (vNext.x - v.x) * (vNext.y + v.y)
    }
    constructingCcw = (averageSlope > 0)
  }
}

export function finishConstruction(p) {
  if (constructingVertices.length > 2) newBlocker(constructingVertices, bounds.blocker === undefined)
  else if (constructingVertices.length == 0 && p !== undefined) {
    // Delete blocker if contains right click
    for (let b = 0; b < blockers.length; b++) {
      if (blockers[b].polygon.containsPoint(p)) {
        deleteBlocker(b)
        break
      }
    }
  }
  clearConstruction()
}

export function clearConstruction() {
  constructingVertices = [];
  constructingCcw = false
}

export function constructionRender(context) {
  // Draw postprocessed blocker
  blockers.forEach(blocker => {
    if (blocker.polygon === undefined) return
    // Draw boundaries
    context.strokeStyle = "Green";
    context.beginPath();
    blocker.vertices().forEach((vertex, i) => {
      if (i == 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.lineTo(blocker.vertices()[0].x, blocker.vertices()[0].y);
    context.stroke();

    // Draw holes
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    blocker.polygon.holes.forEach((hole) => {
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
    mouseDistToStartSqrd = Segment.distanceSqrd(mouse.loc, constructingVertices[0])
  }
  context.strokeStyle = constructingCcw ? "Blue" : "Red";
  context.fillStyle = constructingCcw ? "Blue" : "Red";
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
        context.lineTo(mouse.loc.x, mouse.loc.y);
      } else {
        context.lineTo(constructingVertices[0].x, constructingVertices[0].y);
      }
      context.stroke();

      if (mouseDistToStartSqrd > 64) {
        context.beginPath();
        context.arc(mouse.loc.x, mouse.loc.y, 3, 0, 2 * Math.PI, false);
        context.stroke();
      }
    }

    context.beginPath();
    context.arc(vertex.x, vertex.y, 3, 0, 2 * Math.PI, false);
    context.stroke();
  }
}

// /**
//    * Checks blocker collisions against a segment, ray, or line the starts from a vertex
//    * on the perimeter of the blocker.
//    * @param Ray ray The ray cast out to collide with any blockers.
//    * @returns undefined if no collision or ray is internal to self. Else returns a hash with
//    * the index of the blocker it collided with, the index of the side of the blocker that
//    * was collided with, and the intersection point.
//    * @example
//    * {
//    *   intersectionPoint: Point,
//    *   blocker: Blocker,
//    *   side: Segment
//    * }
//    */
// export function raycast(ray) {
//   // TODO: Sides that lay along the cast line count shouldn't count as intersect
//   // Check if ray goes inside its own blocker. If so, return undefined

//   let pierce = {
//     side: undefined,
//     distanceSqrd: undefined,
//     point: undefined
//   };

//   for (let b = 0; b < blockers.length; b++) {
//     if (blockers[b].polygon === undefined) continue
//     let pierceData = blockers[b].pierce(ray)
//     if (pierceData !== undefined &&
//       (pierce.distanceSqrd === undefined || pierceData.distanceSqrd < pierce.distanceSqrd)) {
//       pierce = pierceData
//     }
//   }

//   return pierce
// }

export function route(origin, destination, logged = true) {
  // move origin and destination outside of any blockers
  blockers.forEach(blocker => {
    origin = blocker.polygon.closestPointOutsideFrom(origin)
    destination = blocker.polygon.closestPointOutsideFrom(destination)
  })

  routing = {origin: origin, destination: destination}
  let route = getRoute(getTriangulation(), origin, destination, logged)

  let routePolygons = (route.route || []).map(r => r.polygon)
  triangulationTriangles.forEach(triangle => triangle.highlighted = routePolygons.includes(triangle))

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
  if (triangulationTriangles === undefined || needsTriangulation) {
    let holePolygons = []
    blockers.forEach(holeBlocker => {
      if (holeBlocker == bounds.blocker) return
      holePolygons.push(holeBlocker.polygon)
    })
    console.log(`Bounds blocker ${bounds.blocker.polygon.logString()}. Holes: ${holePolygons.map(p => p.logString()).join(', ')}`)
    try {
      triangulationTriangles = getTriangulatedGraph(bounds.blocker.polygon, holePolygons)
    } catch(e) {
      console.log(`No bridges ${e}`, e)
      triangulationTriangles = [];
    }
    log(`Triangles`, triangulationTriangles)
    needsTriangulation = false
    if (routing !== undefined) route(routing.origin, routing.destination)
  }

  return triangulationTriangles
}

export function renderTriangulation(context) {
  getTriangulation()

  if (visibleTriangulation) {
    triangulationTriangles.forEach(polygon => {
      context.strokeStyle = "rgba(50, 50, 200, 0.2)"
      context.fillStyle = "rgba(50, 50, 200, 0.02)"
      if (polygon.highlighted !== undefined && polygon.highlighted) {
        context.fillStyle = "rgba(50, 50, 200, 0.2)"
      }
      context.beginPath();
      context.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
      polygon.vertices.forEach(vertex => context.lineTo(vertex.x, vertex.y))
      context.lineTo(polygon.vertices[0].x, polygon.vertices[0].y);
      if (!polygon.clockwise) context.fill()
      context.stroke();
    });
  }

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
    // context.fillText(segment.a.logString(), segment.a.x+5, segment.a.y - 5)
    // context.fillText(segment.b.logString(), segment.b.x+5, segment.b.y - 5)
  })
}

export function saveToCookies() {
  setCookie('layoutData', serialized(), 365)
}

export function serialized() {
  let serializedBlockers = []
  blockers.forEach(blocker => {
    serializedBlockers = serializedBlockers.concat(blocker.serialized())
  })
  return JSON.stringify(serializedBlockers)
}

export function reset() {
  blockers = []
  needsTriangulation = true
  bounds.blocker = undefined
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
    let blockers = JSON.parse(cookieData)
    blockers.forEach(b => newBlocker(b.map(v => new Point(v[0], v[1])), bounds.blocker === undefined))
    return true
  }
  return false
}

/// Load default server layout JSON
function loadFromServer() {
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let blockers = JSON.parse(this.responseText)
      blockers.forEach(b => newBlocker(b.map(p => new Point(p[0], p[1])), bounds.blocker === undefined))

      saveToCookies()
    }
  };
  xmlhttp.open("GET", defaultJsonLayoutUrl, true);
  xmlhttp.send();
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