import { Segment, Line, Ray, Vector, Polygon, Point } from './Layout2D/Geometry.js'
import Blocker from './Layout2D/Blocker.js'

let logData = []
let loggingDisabled = false
export function disableLogging(val) {
  loggingDisabled = val
}

let contentOut = undefined
export function setup(ul) {
  contentOut = ul
}

/**
 * Text is required and will be placed into the output list in its own list item.
 * Optional parameter 'data' can be an array with segments, points, vectors, rays, polygons, and blockers.
 * Passing true or false into the optional 'flush' argument will clear all output before printing the text.
 */
export default function log(text, data, flush) {
  if (loggingDisabled) return
  if (!contentOut) throw 'Bad log setup()'

  // Optional(overloaded) parameter handling...
  if (!Array.isArray(data)) {
    if (typeof data == typeof true) flush = data;
    data = [];
  } else flush = flush || false;
  let li = document.createElement("li");

  li.innerHTML = text;
  li.onmouseenter = () => logData = data
  li.onmouseleave = () => logData = []
  if (flush) {
    contentOut.innerHTML = "";
    contentOut.appendChild(li);
  } else {
    contentOut.appendChild(li);
  }
}

export function renderLogData(context) {
  logData.forEach(data => {
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
      context.beginPath()
      context.arc(data.a().x, data.a().y, 4, 0, 2 * Math.PI, false)
      context.stroke()
      context.beginPath()
      context.arc(data.b().x, data.b().y, 4, 0, 2 * Math.PI, false)
      context.fill()
      context.beginPath()
      context.moveTo(data.a().x, data.a().y)
      context.lineTo(data.b().x, data.b().y)
      context.stroke()
      context.fillText(data.a().logString(), data.a().x+5, data.a().y - 5)
      context.fillText(data.b().logString(), data.b().x+5, data.b().y - 5)
    } else
    if (data instanceof Point) {
      context.beginPath();
      context.arc(data.x, data.y, 4, 0, 2 * Math.PI, false);
      context.fill();
      context.fillText(data.logString(), data.x + 5, data.y - 5);
    } else
    if (data instanceof Polygon) {
      data.vertices.forEach((vertex, vIndex) => {
        let cirleRadius = vIndex == 1 || vIndex == 0 ? 4 : 2
        context.beginPath();
        context.arc(vertex.x, vertex.y, cirleRadius, 0, 2 * Math.PI, false);
        if (vIndex == 0) context.stroke();
        else context.fill()
      })
      context.fillStyle = "rgba(80, 180, 80, 0.2)";
      context.beginPath();
      context.moveTo(data.vertices[0].x, data.vertices[0].y);
      data.vertices.forEach(vertex => context.lineTo(vertex.x, vertex.y))
      context.lineTo(data.vertices[0].x, data.vertices[0].y);
      if (!data.counterclockwise) context.fill()
      context.stroke();
    }
  })
}

window.onerror = (message, url, linenumber) => {
  let file = url.substring(url.lastIndexOf('/') + 1)
  log(`${file}:${linenumber} - ${message}`, true)
}