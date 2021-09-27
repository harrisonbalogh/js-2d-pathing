import log from '../log.js'
import { Segment, Line, Ray, Vector, Polygon, Point } from './Geometry.js'

/**
 * Apply A* pathfinding to graph.
 * @param {[Polygon]} graph Edge joined array of polygons. Polygon edges hold references to neighboring polygons.
 * @param {Point} origin Start position
 * @param {Point} destination Goal position
 * @param {boolean} logged Whether or not to push logging to log feed
 * @returns {[{point: Point, polygon: Polygon}]} shortest line segments through route
 */
export default function getRoute(graph, origin, destination, logged = true) {
  if (logged) log(`Routing ${origin.logString()} to ${destination.logString()}`, [origin, destination], true)
  let iOrigin = undefined
  let iDestination = undefined

  // find origin and destination polygons
  // TODO - optimize. Create sub-quadrants for faster start and destination resolution. Currently O(n)
  for (let i = 0; i < graph.length; i++) {
    let polygon = graph[i]
    if (iOrigin === undefined && polygon.containsPoint(origin)) iOrigin = i
    if (iDestination === undefined && polygon.containsPoint(destination)) iDestination = i
    if (iOrigin !== undefined && iDestination !== undefined) break
  }
  if (iOrigin === undefined || iDestination === undefined) return []

  let nodes = graph.map(polygon => {
    // From is the edge shared by previous polygon
    return {frontier: undefined, from: undefined, cost: undefined, polygon: polygon, priority: undefined}
  })

  nodes[iOrigin].cost = 0
  nodes[iOrigin].frontier = origin
  let pathfinder = [priorityNode(nodes[iOrigin], 0)]

  while (pathfinder.length != 0) {
    let current = popPriorityNode(pathfinder)

    if (current === nodes[iDestination]) break

    current.polygon.edges().forEach(edge => {
      if (edge.peer === undefined) return
      let next = nodes[graph.indexOf(edge.peer.parent)]
      let frontier = edge.closestPointOnSegmentTo(current.frontier)
      let cost = current.cost + Segment.distance(current.frontier, frontier) // TODO: edge cost is always 0
      if (logged) {
        // testLine(current.frontier, frontier)
        // log(`        Frontier ${frontier.logString()} costs ${cost}`, [current.frontier, frontier, edge])
      }

      if (next.cost === undefined || cost < next.cost) {
        next.cost = cost
        next.frontier = frontier
        // log("Set FROM for polygon.", [next.polygon, current.polygon.circumcenter])
        next.from = {node: current, edge: edge.peer}
        let priority = cost + Segment.distance(frontier, destination) // route heuristic
        if (priority === undefined) throw "Pathfinding error. Failed to calculate priority."
        pushPriorityNode(pathfinder, priorityNode(next, priority))
      }
    })
  }

  let current = nodes[iDestination]
  let route = [{polygon: current.polygon, edge: undefined}]
  while (current.from !== undefined) {
    route.push({polygon: current.from.node.polygon, edge: current.from.edge})
    current = current.from.node
  }
  if (logged) log(`Route from ${origin.logString()} to ${destination.logString()}`, route.map(r => r.polygon))
  return {path: createShortestPath(route.reverse(), origin, destination, logged), route: route};
}

/**
 * Creates the shortest line through the connected route passed in
 * @param {[{polygon: Polygon, edge: Segment}]} route ordered array of hash with Polygon and edge connection to traverse 
 * @param {Point} start starting position
 * @param {Point} finish goal position
 * @returns {[{point: Point, polygon: Polygon}]} shortest line segments through route
 */
function createPath(route, start, finish, logged) {
  if (route.length == 1) return [start, finish]
  let path = [{point: start, polygon: route[0]}]
  if (logged) log(`Starting path from ${start.logString()}`, [start])

  let frontierPath = start
  for (let i = 1; i < route.length; i++) {
    let frontierRoute = route[i];
    let nextPoint = frontierRoute.polygon.containsPoint(finish) ? finish : frontierRoute.polygon.circumcenter
    let trace = new Segment(frontierPath, nextPoint)

    if (logged) log(`  Tracing ${trace.logString()}`, [trace])

    if (frontierRoute.edge.intersects(trace)) continue

    if (logged) log(`    Failed ${trace.logString()}`, [frontierRoute.edge, trace])

    let aEndpointDistSqrd = Segment.distanceSqrd(nextPoint, frontierRoute.edge.a())
    let bEndpointDistSqrd = Segment.distanceSqrd(nextPoint, frontierRoute.edge.b())
    
    frontierPath = aEndpointDistSqrd < bEndpointDistSqrd ? frontierRoute.edge.a() : frontierRoute.edge.b()
    path.push({point: frontierPath, polygon: frontierRoute.polygon})
  }

  path.push({point: finish, polygon: route[route.length - 1].polygon})
  return path
}

/**
 * Funnel algorithm.
 * Implementation described here: The Funnel Algorithm Explained
 * https://medium.com/@reza.teshnizi/the-funnel-algorithm-explained-visually-41e374172d2d
 */
function createShortestPath(route, start, finish, logged) {
  let tail = [start] // {[Point]}
  let left = [] // {[Point]}
  let right = [] // {[Point]}
  let COUNTERR = 0
  for (let i = 0; i < route.length - 1; i++) {
    if (COUNTERR > 10) {
      log("Break 2")
      return
    }
    let edge = route[i].edge
    let polygonCenter = route[i].polygon.circumcenter
    let exitSegment = new Segment(polygonCenter, edge.midpoint())
    log(`  Crossing ${edge.logString()}`, [exitSegment, edge])

    let lPoint, rPoint;
    // Check edge endpoint directionality
    let logStringL = '', logStringR = '';
    if (exitSegment.directionTo(edge.a()) > 0) {
      lPoint = edge.a()
      rPoint = edge.b()
      logStringL = `    A is left. ${edge.a().logString()}`
      logStringR = `    B is right. ${edge.b().logString()}`
    } else {
      lPoint = edge.b()
      rPoint = edge.a()
      logStringL = `    B is left. ${edge.b().logString()}`
      logStringR = `    A is right. ${edge.a().logString()}`
    }
    // Left boundary
    log(logStringL, [exitSegment, edge.b()])
    let COUNTERR2 = 0
    if (!left.includes(lPoint)) {
      if (COUNTERR2 > 20) {
        log("Break 3")
        return
      }
      // Verify left array
      let lPrev = tail[tail.length - 1]
      let leftBoundaries = left.length
      for (let l = 0; l < leftBoundaries; l++) {
        let lEdge = new Segment(lPrev, left[l])
        log(`     Check L ${lEdge.logString()}`, [lEdge, lPoint])
        if (lEdge.directionTo(lPoint) < 0) {
          // On right side of left boundary segment. Check right boundary
          let onLeftofRightBoundary = true
          let rPrev = tail[tail.length - 1]
          for (let r = 0; r < right.length; r++) {
            let rEdge = new Segment(rPrev, right[r])
            if (rEdge.directionTo(lPoint) < 0) {
              // On right side of right boundary segment - Common vertices (3)
              log(`      Common vertex. ${rPoint.logString()}`, tail)
              left = [rPoint]
              l = leftBoundaries
              tail.push(right.splice(0, 1))
              r--;
              onLeftofRightBoundary = false;
            }
            rPrev = right[r];
          }
          if (onLeftofRightBoundary) {
            // On left side of right boundary segment - Tighter boundary (1)
            log(`      Tighter bound L. ${left[l].logString()} to ${lPoint.logString()} (tail: ${tail.length})`, [...tail, ...left, lEdge, lPoint])
            left[l] = lPoint
          }
        } else {
          // Left side of left boundary segment - Expand funnel (2)
          log(`      Expand funnel L. ${lPoint.logString()}`, [...tail, ...left])
          left.push(lPoint)
        }
        lPrev = left[l];
      }
      if (left.length == 0) {
        log(`     First point L. Push: ${lPoint.logString()}`, [...tail, lPoint])
        left.push(lPoint)
      }
    } else {
      log(`     Left includes ${lPoint.logString()}`, [...left])
    }
    log(logStringR, [exitSegment, edge.a()])
    let COUNTERR3 = 0
    // Right boundary
    if (!right.includes(rPoint)) {
      if (COUNTERR3 > 20) {
        log("Break 4")
        return
      }
      // Verify right array
      let rPrev = tail[tail.length - 1]
      let rightBoundaries = right.length
      for (let r = 0; r < rightBoundaries; r++) {
        let rEdge = new Segment(rPrev, right[r])
        log(`     Check R ${rEdge.logString()}`, [rEdge, rPoint])
        if (rEdge.directionTo(rPoint) > 0) {
          // On left side of right boundary segment. Check left boundary
          let onRightOfLeftBoundary = true
          let lPrev = tail[tail.length - 1]
          for (let l = 0; l < left.length; l++) {
            let lEdge = new Segment(lPrev, left[l])
            if (lEdge.directionTo(rPoint) > 0) {
              // On left side of left boundary segment - Common vertices (3)
              log(`      Common vertex. ${lPoint.logString()}`, tail)
              r = rightBoundaries
              right = [lPoint]
              tail.push(left.splice(0, 1))
              l--;
              onRightOfLeftBoundary = false;
            }
            lPrev = left[l];
          }
          if (onRightOfLeftBoundary) {
            // On right side of left boundary segment - Tighter boundary (1)
            log(`      Tighter bound R. ${right[r].logString()} to ${rPoint.logString()} (tail: ${tail.length})`, [...tail, ...right, rEdge, rPoint])
            right[r] = rPoint
          }
        } else {
          // On right side of right boundary segment - Expand funnel (2)
          right.push(rPoint)
          log(`      Expand funnel R. ${rPoint.logString()}`, [...tail, ...right])
        }
        rPrev = right[r]
      }
      if (right.length == 0) {
        log(`     First point R. Push: ${rPoint.logString()}`, [...tail, rPoint])
        right.push(rPoint)
      }
    } else {
      log(`     Right includes ${rPoint.logString()}`, [...right])
    }
  }

  let lIntersection, rIntersection;
  do {
    let goalEdge = new Segment(tail[tail.length - 1], finish)
    lIntersection = false
    rIntersection = false
    let lPrev = tail[tail.length - 1]
    for (let l = 0; l < left.length; l++) {
      let lEdge = new Segment(lPrev, left[l])
      if (lEdge.intersects(goalEdge)) {
        tail = tail.concat(left.splice(0, l + 1))
        lIntersection = true
      }
      lPrev = left[l]
    }
    let rPrev = tail[tail.length - 1]
    for (let r = 0; r < right.length; r++) {
      let rEdge = new Segment(rPrev, right[r])
      if (rEdge.intersects(goalEdge)) {
        tail = tail.concat(right.splice(0, r + 1))
        rIntersection = true
      }
      rPrev = right[r]
    }
  } while(lIntersection || rIntersection)
  tail.push(finish)
  log("Shortest path.", tail)
  return tail;
}

/// DEPRECATED: routeHeuristic(nodes[iDestination], next)
function routeHeuristic(a, b) {
  let x1 = a.polygon.circumcenter.x
  let y1 = a.polygon.circumcenter.y
  let x2 = b.polygon.circumcenter.x
  let y2 = b.polygon.circumcenter.y
  return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

function priorityNode(node, priority) {
  if (priority === undefined)
    throw "Pathfinding error. Failed to calculate priority."
  node.priority = priority
  return node
}

/// TODO - Optimize. Make queue
function popPriorityNode(nodes) {
  let lowest = {priority: undefined, node: undefined}
  nodes.forEach(node => { // retrieve highest priority (lowest value) node
    if (node.priority === undefined) throw "Bad pathfinding logic. Node should have priority set."
    if (lowest.priority === undefined || node.priority < lowest.priority) lowest = {priority: node.priority, node: node}
  })
  let node = nodes.splice(nodes.indexOf(lowest.node), 1)[0] // pop from queue
  node.priority = undefined
  return node
}

function pushPriorityNode(pathfinder, node) {
  if (pathfinder.indexOf(node) != -1) return
  pathfinder.push(node)
}
