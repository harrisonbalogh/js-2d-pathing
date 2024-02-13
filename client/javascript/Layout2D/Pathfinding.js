import { Segment, Polygon, Point } from '../../node_modules/@harxer/geometry/geometry.js'
import GraphEdge from './GraphEdge.js';
import GraphTriangle from './GraphTriangle.js';
import log from '../log.js'

/** Graph traversal node wrapping a GraphTriangle node. */
class PathNode {
  constructor(graphTriangle) {
    /** @type {Point} frontier - point towards destination */
    this.frontier = undefined;
    /** @type {GraphEdge} from - entry edge from previous polygon */
    this.from = undefined;
    /** @type {Number} cost - pathfinding heuristic value to reach this triangle */
    this.cost = undefined;
    /** @type {Number} priority - pathfinding queue pop modifier */
    this.priority = undefined;
    /** @type {GraphTriangle} graphTriangle - triangle and edge details */
    this.graphTriangle = graphTriangle;
  }
}

/**
 * Apply A* pathfinding to graph.
 * @param {[GraphTriangle]} graph Edge joined array of polygons. Polygon edges hold references to neighboring polygons.
 * @param {Point} origin Start position
 * @param {Point} destination Goal position
 * @returns {[{point: Point, polygon: Polygon}]} shortest line segments through route
 */
export default function route(graph, origin, destination) {
  log(`Routing ${origin.logString()} to ${destination.logString()}`, [origin, destination], true)
  let iOrigin = undefined
  let iDestination = undefined

  // Find origin and destination polygons // TODO Can optimize. Sub-quadrants for faster start/destination resolution. Currently O(n)
  for (let i = 0; i < graph.length; i++) {
    let polygon = graph[i].triangle;
    if (iOrigin === undefined && polygon.containsPoint(origin)) iOrigin = i
    if (iDestination === undefined && polygon.containsPoint(destination)) iDestination = i
    if (iOrigin !== undefined && iDestination !== undefined) break
  }
  if (iOrigin === undefined || iDestination === undefined) return {};

  let nodes = graph.map(graphTriangle => new PathNode(graphTriangle));

  const pathfinder = {

    /** @type {[PathNode]} */
    priorityStack: [],

    get length() { return this.priorityStack.length },

    /** Push a PathNode to priority stack. Optionally set priority on node. */
    push(node, priority = undefined) {
      if (this.priorityStack.indexOf(node) != -1) return // Skip if already in stack
      if (priority !== undefined) node.priority = priority; // Update priority if needed
      this.priorityStack.push(node)
    },

    /** TODO Optimize. Make queue - insert in priority rank. @returns {PathNode} */
    pop() {
      // Retrieve highest priority (lowest value) node
      let { iNode } = this.priorityStack.reduce((lowest, { priority }, iNode) => {
        if (priority === undefined) throw Error("Bad pathfinding logic. Node missing priority.");
        if (priority < lowest.priority) return { priority, iNode };
        return lowest;
      }, {priority: Infinity})
      // Pop from stack
      let node = this.priorityStack.splice(iNode, 1)[0];
      node.priority = undefined;
      return node;
    }
  }

  // Initialize origin node
  nodes[iOrigin].cost = 0
  nodes[iOrigin].frontier = origin
  pathfinder.push(nodes[iOrigin], 0)

  let reachedDestination = false;

  // Populate `from` on each node with cheapest route to destination graph triangle node
  while (pathfinder.length != 0) {
    let current = pathfinder.pop();

    if (current === nodes[iDestination]) {
      reachedDestination = true;
      break;
    }

    log(`    Processing node.`, [current.graphTriangle.triangle])

    // Compute cost of crossing each shared graph edge into neighboring triangle
    current.graphTriangle.edges.forEach(graphEdge => {
      if (graphEdge.peer === undefined) return

      let neighbor = nodes[graph.indexOf(graphEdge.peer.parent)]
      let frontier = graphEdge.edge.closestPointOnSegmentTo(current.frontier)
      let cost = current.cost + Segment.distance(current.frontier, frontier) // TODO: edge cost is always 0, can change this to distanceSqrd?
      // testLine(current.frontier, frontier)
      log(`        Edge cost ${cost}`, [current.frontier, frontier, graphEdge.edge]);

      // Found cheaper route to node, update cost and frontier
      if (neighbor.cost === undefined || cost < neighbor.cost) {
        neighbor.cost = cost
        neighbor.frontier = frontier
        neighbor.from = graphEdge.peer;
        let priority = cost + Segment.distance(frontier, destination) // Route heuristic
        if (priority === undefined) throw Error("Pathfinding error. Failed to calculate priority.");
        pathfinder.push(neighbor, priority);
      }
    })
  }

  if (!reachedDestination) {
    console.error('Could not find path to destination.')
    log('Could not find path to destination.')
  }

  // Join path node `from` linked graph edges to form route
  log(`Traversing route links.`);
  let current = nodes[iDestination]
  /** Graph triangle graph edges crossed to reach destination. @type {[GraphEdge]} */
  let graphEdgeCrossings = [];
  while (current.from !== undefined) {
    graphEdgeCrossings.push(current.from.peer)
    log(`    Processing node.`, [nodes[graph.indexOf(current.from.peer.parent)].graphTriangle.triangle]);
    current = nodes[graph.indexOf(current.from.peer.parent)]; // TODO - indexOf can be replaced with `from` tracking the node index
  }
  return {path: createShortestPath(graphEdgeCrossings.reverse(), origin, destination), graphEdgeCrossings};
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

    let aEndpointDistSqrd = Segment.distanceSqrd(nextPoint, frontierRoute.edge.a)
    let bEndpointDistSqrd = Segment.distanceSqrd(nextPoint, frontierRoute.edge.b)

    frontierPath = aEndpointDistSqrd < bEndpointDistSqrd ? frontierRoute.edge.a : frontierRoute.edge.b
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
function createShortestPath(graphEdgeCrossings, start, finish) {
  log(`Creating shortest path.`);

  let tail = [start] // {[Point]}
  let apex = () => tail[tail.length - 1] // latest tail point
  let left = [] // {[Point]}
  let right = [] // {[Point]}
  let boundaryIncludes = (boundary, point) => boundary.some(p => p.equals(point));
  if (graphEdgeCrossings.length === 0) return tail.concat(finish)

  let COUNTERR = 0
  routeEdges: for (let i = 0; i < graphEdgeCrossings.length; i++) {
    if (COUNTERR > 10) {
      // log("Break 2")
      return
    }
    let edge = graphEdgeCrossings[i].edge
    let polygonCenter = graphEdgeCrossings[i].parent.triangle.circumcenter
    let exitSegment = new Segment(polygonCenter, edge.midpoint())
    log(`    Crossing ${edge.logString()}`, [exitSegment, edge])

    let lPoint, rPoint;
    // Check crossing-edge endpoint boundary-side
    let logStringL = '', logStringR = '';
    if (exitSegment.directionTo(edge.a) > 0) {
      lPoint = edge.a
      rPoint = edge.b
      logStringL = `    A is left. ${edge.a.logString()}`
      logStringR = `    B is right. ${edge.b.logString()}`
    } else {
      lPoint = edge.b
      rPoint = edge.a
      logStringL = `    B is left. ${edge.b.logString()}`
      logStringR = `    A is right. ${edge.a.logString()}`
    }

    // Left boundary checks
    // log(logStringL, [exitSegment, edge.b])
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
              // log(`      Tighter bound L. ${lEdge.b.logString()} to ${lPoint.logString()} (left: ${left.length})`, [apex(), ...left])
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
    // log(logStringR, [exitSegment, edge.a])
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
              // log(`      Tighter bound R. ${rEdge.b.logString()} to ${rPoint.logString()} (right: ${right.length})`, [apex(), ...right])
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
