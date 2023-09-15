import { Segment, Polygon, Point } from '../../node_modules/@harxer/geometry/geometry.js'

/**
 * Apply A* pathfinding to graph.
 * @param {[Polygon]} graph Edge joined array of polygons. Polygon edges hold references to neighboring polygons.
 * @param {Point} origin Start position
 * @param {Point} destination Goal position
 * @returns {[{point: Point, polygon: Polygon}]} shortest line segments through route
 */
export default function getRoute(graph, origin, destination) {
  // log(`Routing ${origin.logString()} to ${destination.logString()}`, [origin, destination], true)
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
      // testLine(current.frontier, frontier)
      // log(`        Frontier ${frontier.logString()} costs ${cost}`, [current.frontier, frontier, edge])

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
  // log(`Route from ${origin.logString()} to ${destination.logString()}`, route.map(r => r.polygon))
  return {path: createShortestPath(route.reverse(), origin, destination), route: route};
}

// ======== INTERNAL Helpers =========

/**
 * Creates the shortest line through the connected route passed in
 * @param {[{polygon: Polygon, edge: Segment}]} route ordered array of hash with Polygon and edge connection to traverse
 * @param {Point} start starting position
 * @param {Point} finish goal position
 * @returns {[{point: Point, polygon: Polygon}]} shortest line segments through route
 */
function createPath(route, start, finish) {
  if (route.length == 1) return [start, finish]
  let path = [{point: start, polygon: route[0]}]
  // log(`Starting path from ${start.logString()}`, [start])

  let frontierPath = start
  for (let i = 1; i < route.length; i++) {
    let frontierRoute = route[i];
    let nextPoint = frontierRoute.polygon.containsPoint(finish) ? finish : frontierRoute.polygon.circumcenter
    let trace = new Segment(frontierPath, nextPoint)

    // log(`  Tracing ${trace.logString()}`, [trace])

    if (frontierRoute.edge.intersects(trace)) continue

    // log(`    Failed ${trace.logString()}`, [frontierRoute.edge, trace])

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
function createShortestPath(route, start, finish) {
  let tail = [start] // {[Point]}
  let apex = () => tail[tail.length - 1] // latest tail point
  let left = [] // {[Point]}
  let right = [] // {[Point]}
  let boundaryIncludes = (boundary, point) => boundary.some(p => p.equals(point));
  if (route.length == 1) return tail.concat(finish)

  let COUNTERR = 0
  routeEdges: for (let i = 0; i < route.length - 1; i++) {
    if (COUNTERR > 10) {
      // log("Break 2")
      return
    }
    let edge = route[i].edge
    let polygonCenter = route[i].polygon.circumcenter
    let exitSegment = new Segment(polygonCenter, edge.midpoint())
    // log(`  Crossing ${edge.logString()}`, [exitSegment, edge])

    let lPoint, rPoint;
    // Check crossing-edge endpoint boundary-side
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

    // Left boundary checks
    // log(logStringL, [exitSegment, edge.b()])
    if (left.length == 0) {
      if (apex().equals(lPoint)) {
        // log(`     Apex is left point. Skip ${lPoint.logString()}`, [...tail])
      } else {
        // log(`     First point L. Push: ${lPoint.logString()}`, [...tail, lPoint])
        left.push(lPoint)
      }
    } else {
      let COUNTERR2 = 0
      if (!boundaryIncludes(left, lPoint)) {
        if (COUNTERR2 > 20) {
          // log("Break 3")
          return
        }
        // Check leftBound for funnel expansion, tighter bounds, or common vertex
        let lPrev = apex()
        let leftBoundaries = left.length
        for (let l = 0; l < leftBoundaries; l++) {
          let lEdge = new Segment(lPrev, left[l])
          // log(`     Check L ${lEdge.logString()}`, [lEdge, lPoint])

          if (lEdge.directionTo(lPoint) < 0) { // Right side of left boundary segment

            // Check right boundary
            let onLeftofRightBoundary = true
            if (l == 0) { // If checking first right boundary segment
              for (let r = 0; r < right.length; r++) {
                let rEdge = new Segment(apex(), right[r])
                // log(`      Check R ${rEdge.logString()}`, [rEdge, lPoint])

                if (rEdge.directionTo(lPoint) < 0) { // Right side of right boundary segment
                  // Common vertices (3)
                  tail.push(...right.splice(0, 1))
                  // log(`      Common vertex. ${apex().logString()} (left: ${left.length}) (right: ${right.length})`, [...tail])
                  r--;
                  onLeftofRightBoundary = false;
                } else { // Left side of right boundary segment
                  break; // Stop common vertex check on right
                }
              }
            }

            if (onLeftofRightBoundary) { // Left side of right boundary segment
              // Tighter boundary (1)
              left = left.slice(0, l) // Remove wider bounds
              left.push(lPoint)
              // log(`      Tighter bound L. ${lEdge.b().logString()} to ${lPoint.logString()} (left: ${left.length})`, [apex(), ...left])
            } else {
              left = [lPoint] // Move up left
              continue routeEdges; // Skip the right boundary check
            }
            break // If right of left segment boundary, ignore rest of left boundary

          } else if (l == leftBoundaries - 1) { // Left side of left boundary segment
            // Expand funnel (2) if last bound checked
            left.push(lPoint)
            // log(`      Expand funnel L. ${lPoint.logString()} (left ${left.length})`, [...tail, ...left])
          }

          lPrev = left[l];
        }
      }
      // else {
        // log(`     Left includes ${lPoint.logString()}`, [...left])
      // }
    }


    // Right boundary checks
    // log(logStringR, [exitSegment, edge.a()])
    if (right.length == 0) {
      if (apex().equals(rPoint)) {
        // log(`     Apex is right point. Skip ${rPoint.logString()}`, [...tail])
      } else {
        // log(`     First point R. Push: ${rPoint.logString()}`, [...tail, rPoint])
        right.push(rPoint)
      }
    } else {
      let COUNTERR3 = 0
      if (!boundaryIncludes(right, rPoint)) {
        if (COUNTERR3 > 20) {
          // log("Break 4")
          return
        }
        // Check rightBound for funnel expansion, tighter bounds, or common vertex
        let rPrev = apex()
        let rightBoundaries = right.length
        for (let r = 0; r < rightBoundaries; r++) {
          let rEdge = new Segment(rPrev, right[r])
          // log(`     Check R ${rEdge.logString()}`, [rEdge, rPoint])

          if (rEdge.directionTo(rPoint) > 0) { // Left side of right boundary segment

            // Check left boundary
            let onRightOfLeftBoundary = true
            if (r == 0) { // If checking first right boundary segment
              for (let l = 0; l < left.length; l++) {
                let lEdge = new Segment(apex(), left[l])
                // log(`      Check L ${lEdge.logString()}`, [lEdge, rPoint])

                if (lEdge.directionTo(rPoint) > 0) { // Left side of left boundary segment
                  // Common vertices (3)
                  tail.push(...left.splice(0, 1))
                  // log(`      Common vertex. ${apex().logString()} (left: ${left.length}) (right: ${right.length})`, [...tail])
                  l--;
                  onRightOfLeftBoundary = false;
                } else { // Right side of left boundary segment
                  break; // Stop common vertex check on left
                }
              }
            }

            if (onRightOfLeftBoundary) { // Right side of left boundary segment
              // Tighter boundary (1)
              right = right.slice(0, r) // Remove wider bounds
              right.push(rPoint)
              // log(`      Tighter bound R. ${rEdge.b().logString()} to ${rPoint.logString()} (right: ${right.length})`, [apex(), ...right])
            } else {
              right = [rPoint] // Move up right
            }
            break // If left of right segment boundary, ignore rest of right boundary

          } else if (r == rightBoundaries - 1) { // Right side of right boundary segment
            // Expand funnel (2) if last right bound checked
            right.push(rPoint)
            // log(`      Expand funnel R. ${rPoint.logString()} (right: ${right.length})`, [...tail, ...right])
          }

          rPrev = right[r]
        }
      }
      // else {
        // log(`     Right includes ${rPoint.logString()}`, [...right])
      // }
    }
  }

  // log(`  Final funnel computed from tail.`, tail)
  let goalEdge = new Segment(apex(), finish)
  let intersectedL = false
  // log(`   L.`, left)
  for (let l = 0; l < left.length; l++) {
    let lEdge = new Segment(apex(), left[0])
    // log(`   Goal: ${goalEdge.logString()}`, [goalEdge, lEdge])
    if (lEdge.directionTo(finish) > 0) {
      tail.push(...left.splice(0, 1))
      l--;
      intersectedL = true
      // log(`   Shortening path (left: ${left.length}).`, tail)
    } else {
      break
    }
    goalEdge = new Segment(apex(), finish)
  }
  if (intersectedL) {
    tail.push(finish)
    // log("Shortest path.", tail)
    return tail;
  }

  // log(`   R.`, right)
  for (let r = 0; r < right.length; r++) {
    let rEdge = new Segment(apex(), right[0])
    // log(`   Goal: ${goalEdge.logString()}`, [goalEdge, rEdge])
    if (rEdge.directionTo(finish) < 0) {
      tail.push(...right.splice(0, 1))
      r--;
      // log(`   Shortening path (right: ${right.length}).`, tail)
    } else {
      break
    }
    goalEdge = new Segment(apex(), finish)
  }

  tail.push(finish)
  // log("Shortest path.", tail)
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
