import log from '../log.js'
import { Segment, Line, Ray, Vector, Polygon, Point } from './Geometry.js'

/**
 * A* pathfinding
 * */
export default function getRoute(graph, origin, destination, logged = true) {
  if (logged) log(`Routing ${origin.logString()} to ${destination.logString()}`, [origin, destination], true)
  let iOrigin = undefined
  let iDestination = undefined

  // find origin and destination polygons
  for (let i = 0; i < graph.length; i++) {
    let polygon = graph[i]
    if (iOrigin === undefined && polygon.containsPoint(origin)) iOrigin = i
    if (iDestination === undefined && polygon.containsPoint(destination)) iDestination = i
    if (iOrigin !== undefined && iDestination !== undefined) break
  }
  if (iOrigin === undefined || iDestination === undefined) return []

  let nodes = graph.map(polygon => {
    return {frontier: undefined, from: undefined, cost: undefined, polygon: polygon, priority: undefined}
  })

  nodes[iOrigin].cost = 0
  nodes[iOrigin].frontier = origin
  let pathfinder = [priorityNode(nodes[iOrigin], 0)]

  while (pathfinder.length != 0) {
    let current = popPriorityNode(pathfinder)

    if (current === nodes[iDestination]) break

    current.polygon.edges.forEach(edge => {
      if (edge.peer === undefined) return
      let next = nodes[graph.indexOf(edge.peer.parent)]
      let frontier = edge.closestPointOnSegmentTo(current.frontier)
      let cost = current.cost + Segment.distance(current.frontier, frontier) // TODO: edge cost is always 0
      if (logged) {
        // testLine(current.frontier, frontier)
        log(`        Frontier ${frontier.logString()} costs ${cost}`, [current.frontier, frontier, edge])
      }

      if (next.cost === undefined || cost < next.cost) {
        next.cost = cost
        next.frontier = frontier
        next.from = current
        let priority = cost + Segment.distance(frontier, destination) // route heuristic
        if (priority === undefined) throw "Pathfinding error. Failed to calculate priority."
        pushPriorityNode(pathfinder, priorityNode(next, priority))
      }
    })
  }

  let current = nodes[iDestination]
  let route = [current.polygon]
  while (current.from !== undefined) {
    current = current.from
    route.push(current.polygon)
  }
  if (logged) log(`Route from ${origin.logString()} to ${destination.logString()}`, route)
  return route
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
