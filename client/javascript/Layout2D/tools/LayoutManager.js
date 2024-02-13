import { Point, Segment } from '../../../node_modules/@harxer/geometry/geometry.js'
import Layout from '../Layout.js';

let constructingVertices = [];
export const hasConstructorVertices = _ => constructingVertices.length > 0;
let _constructingCcw = false;

let constructionMouse = undefined;
const constructionSnappingEnabled = _ => constructionMouse !== undefined;
let constructionSnapDistance = 8; // pixels
let _withinSnapDistance = false;
export function setConstructionSnapDistance(val) {
  constructionSnapDistance = val;
  constructionSnapping = true;
}

let pathfindingRoute = []
export function setPathfindingRoute(route) {
  let pathBuilder = []
  for (let p = 1; p < (route.path || []).length; p++) {
    pathBuilder.push(new Segment(route.path[p-1], route.path[p]))
  }
  pathfindingRoute = pathBuilder;
}

/** @type {boolean} */
export let visibleTriangulation = false;
/** Update visibleTriangulation flag. @param {boolean} val  */
export function triangulationVisible(val) {
  visibleTriangulation = val;
}

let layoutPolygons = [];
export function setLayoutPolygons(polygons) {
  layoutPolygons = polygons;
}
export function pushLayoutPolygon(polygon) {
  layoutPolygons.push(polygon);
}

/** Add construction point. Finish construction if endpoints overlap. @param {Layout} layout @param {Point} p */
export function addConstructionPoint(layout, p) {
  // If using a mouse listener, snapping is enabled
  if (constructionSnappingEnabled() && constructingVertices.length >= 3) {
    let distMouseToStartSqrd = Segment.distanceSqrd(p, constructingVertices[0])
    // Complete construction if within snap distance
    if (distMouseToStartSqrd < Math.pow(constructionSnapDistance, 2)) {
      finishConstruction(layout);
      return;
    }
  }

  constructingVertices.push(p);
  syncConstructingCcw();
}

/** Removes last construction point if any exist. */
export function undoConstructionPoint() {
  if (!hasConstructorVertices()) return;
  constructingVertices.pop();
  syncConstructingCcw();
}

/** Finish construction with current vertices. @param {Layout} layout   */
export function finishConstruction(layout) {
  if (constructingVertices.length > 2) layout.insertContextHole(constructingVertices)
  clearConstruction();
  writeLayout(layout);
}

/** Remove any construction points. */
export function clearConstruction() {
  constructingVertices = [];
  _constructingCcw = false
  constructionMouse = undefined;
}

/** Draw layout polygons and construction vertices to given context. */
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

  context.strokeStyle = _constructingCcw ? "Blue" : "Red";
  context.fillStyle = _constructingCcw ? "Blue" : "Red";
  context.font = '14px sans-serif';
  for (let c = 0; c < constructingVertices.length; c++) {
    let vertex = constructingVertices[c];

    context.beginPath();
    context.arc(vertex.x, vertex.y, 3, 0, 2 * Math.PI, false);
    context.stroke();

    if (c == 0) {
      if (constructionSnappingEnabled()) {
        if (_withinSnapDistance) {
          if (constructingVertices.length >= 3) {
            context.fillText('Close Polygon', vertex.x+5, vertex.y-5);
          } else {
            context.fillText('Not enough vertices', vertex.x+5, vertex.y-5);
          }
        } else {
          context.fillText(vertex.logString(), vertex.x+5, vertex.y-5);
        }
      } else {
        context.fillText(vertex.logString(), vertex.x+5, vertex.y-5);
      }
    }

    // Connect vertices by line
    if (c > 0) {
      context.beginPath();
      context.moveTo(constructingVertices[c-1].x, constructingVertices[c-1].y);
      context.lineTo(vertex.x, vertex.y);
      context.stroke();
      context.fillText(vertex.logString(), vertex.x+5, vertex.y-5);
    }
    // Last vertex
    if (c == constructingVertices.length - 1 && constructionSnappingEnabled()) {

      // Connect to mouse or last start vertex
      context.beginPath();
      context.moveTo(vertex.x, vertex.y);
      if (_withinSnapDistance) {
        context.lineTo(constructingVertices[0].x, constructingVertices[0].y);
      } else {
        context.lineTo(constructionMouse.x, constructionMouse.y);
      }
      context.stroke();
    }
  }
}

/** Render triangulation. @param {Layout} layout @param {CanvasRenderingContext2D} context   */
export function renderTriangulation(layout, context) {
  if (layout === undefined || layout.meshContext === undefined) return;

  layout.meshContext.triangulatedGraph?.forEach(({triangle: polygon}) => {
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

  context.lineWidth = 3
  context.strokeStyle = "rgb(255, 120, 0 )"
  context.beginPath()
  if (pathfindingRoute.length) context.moveTo(pathfindingRoute[0].a.x, pathfindingRoute[0].a.y)
  pathfindingRoute.forEach(segment => context.lineTo(segment.b.x, segment.b.y))
  context.stroke()
  context.lineWidth = 1
}

/** Handle mouse update. Allows for snapping when creating blockers */
export function constructionMouseMoveHandler(x, y) {
  if (constructingVertices.length === 0) {
    constructionMouse = undefined;
    return;
  }
  constructionMouse = {x, y}

  // If using a mouse listener, snapping is enabled
  let distMouseToStartSqrd = Segment.distanceSqrd(constructionMouse, constructingVertices[0])
  _withinSnapDistance = distMouseToStartSqrd < Math.pow(constructionSnapDistance, 2);
}

/** INTERNAL: Memoizes current construction CCW state. */
function syncConstructingCcw() {
  let averageSlope = 0
  for (let i = 0; i < constructingVertices.length; i++) {
    let v = constructingVertices[i]
    let vNext = constructingVertices[(i + 1) % constructingVertices.length]
    averageSlope += (vNext.x - v.x) * (vNext.y + v.y)
  }
  _constructingCcw = (averageSlope > 0)
}

// ======================================================================================= Cookie Helpers ====

/** INTERNAL: Cookie set helper */
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

/** INTERNAL: Cookie get helper */
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

// ==================================================================================== Serialization Helpers ===

let defaultJsonLayoutUrl = 'javascript/Layout2D/layout_default.json';
export function setDefaultJsonLayoutUrl(val) {
  defaultJsonLayoutUrl = val;
}

let layoutCookieKey = 'layoutData';
export function setLayoutCookieKey(val) {
  layoutCookieKey = val;
}

export function reloadDefaultLayout() {
  setCookie(layoutCookieKey, '', 0)
  // Else load default server layout JSON
  let xmlhttp = new XMLHttpRequest();
  return new Promise((resolve) => {
    xmlhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // Save to cookies
        setCookie(layoutCookieKey, layout2D.serialized(), 365)
        return resolve(Layout.fromJson(this.responseText))
      }
    };
    xmlhttp.open("GET", defaultJsonLayoutUrl, true);
    xmlhttp.send();
  })
}

/** Write given layout to cookies. @param {Layout} layout  */
export function writeLayout(layout) {
  setCookie(layoutCookieKey, layout.serialized(), 365)
}

export function initLayout() {
  // Try to load layout from cookies
  let cookieData = getCookie(layoutCookieKey)
  if (cookieData !== '') {
    return Promise.resolve(Layout.fromJson(cookieData));
  } else {
    return reloadDefaultLayout();
  }
}
