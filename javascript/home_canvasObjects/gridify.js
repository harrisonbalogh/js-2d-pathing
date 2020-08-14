
var cache_triangulation = []

let TRIANGULATION_ANGLE_BOUND = (20) / 180 * Math.PI

function generateGrid() {
  cache_triangulation = []
  let holePolygons = []
  Blocker.blockers.forEach(holeBlocker => {
    if (holeBlocker == boundsBlocker) return
    holePolygons.push(holeBlocker.polygon)
  })

  let vertices = boundsBlocker.vertices().map(vertex => new Point(vertex.x, vertex.y))

  // Connect holes to bounds blocker using bridge segments to form one degenerate polygon
  holePolygons.forEach((hole, hIndex) => {
    let bridgeCandidateEdges = []

    vertices.forEach(vertex => {
      hole.vertices.forEach(holeVertex => {
        let bridgeCandidateEdge = new Segment(vertex, holeVertex)

        for (let s = 0; s < hole.vertices.length; s++) {
          if (holeVertex == hole.edges()[s].a() || holeVertex == hole.edges()[s].b()) continue
          if (hole.edges()[s].intersects(bridgeCandidateEdge)) {
            return
          }
        }
        for (let v = 0; v < vertices.length; v++) {
          let edge = new Segment(vertices[v], vertices[(v+1)%vertices.length])
          if (vertex == edge.a() || vertex == edge.b()) continue
          if (edge.intersects(bridgeCandidateEdge)) {
            return
          }
        }
        for (let h = hIndex + 1; h < holePolygons.length; h++) {
          let otherHoleEdges = holePolygons[h].edges()
          for (let e = 0; e < otherHoleEdges.length; e++) {
            let edge = otherHoleEdges[e]
            if (edge.intersects(bridgeCandidateEdge)) {
              return
            }
          }
        }

        bridgeCandidateEdges.push(bridgeCandidateEdge)
      })
    })

    if (bridgeCandidateEdges.length == 0) throw "No bridge candidate edges"

    let bridgeEdge = undefined
    // Get shortest valid bridge segment
    bridgeCandidateEdges.forEach(edge => {
      if (bridgeEdge == undefined || edge.distance() < bridgeEdge.distance()) {
        bridgeEdge = edge
      }
    })
    let bridgePolygonIndex = vertices.indexOf(bridgeEdge.a())
    let bridgeHoleIndex = hole.vertices.indexOf(bridgeEdge.b())
    let shiftedHoleVertices = hole.vertices.slice(bridgeHoleIndex + 1).concat(hole.vertices.slice(0, bridgeHoleIndex + 1))

    vertices.splice(bridgePolygonIndex, 0, ...shiftedHoleVertices)
    vertices.splice(bridgePolygonIndex, 0, new Point(bridgeEdge.b().x, bridgeEdge.b().y))
    vertices.splice(bridgePolygonIndex, 0, new Point(bridgeEdge.a().x, bridgeEdge.a().y))
  })

  // Gather 'Eartips'. Req's: vertex is convex and triangle formed by prev and next vertex does not contain any reflex vertices
  vertices.forEach((_, i) => setConvexAndAngleFor(vertices, i))
  vertices.forEach((_, i) => setEartipStatus(vertices, i))

  // let eartips_print = vertices.filter(vertex => vertex.eartip)

  let triangles = []
  let n = vertices.length
  while (triangles.length < n - 2) {
    let lowest = {i: undefined, angle: undefined}
    for (let i = 1; i < vertices.length; i++) {
      if (!vertices[i].eartip) continue
      if (lowest.i === undefined || vertices[i].angle < lowest.angle) {
        lowest.i = i
        lowest.angle = vertices[i].angle
      }
    }
    if (lowest.i === undefined) {
      console.log("No eartips?")
      break
    }
    let vPrev = vertices[(lowest.i - 1) < 0 ? vertices.length - 1 : (lowest.i - 1)]
    let v = vertices[lowest.i]
    let vNext = vertices[(lowest.i + 1) % vertices.length]
    if (vPrev === undefined || v === undefined || vNext === undefined) {
      console.log(`Vertex count: ${vertices.length} - ${lowest.i}`)
      throw 'Help'
    }
    let triangle = new Polygon([vNext, v, vPrev])

    let edge0 = new Segment(v, vNext)
    edge0.parent = triangle
    let edge1 = new Segment(vNext, vPrev)
    edge1.parent = triangle
    let edge2 = new Segment(vPrev, v)
    edge2.parent = triangle

    triangle.edges = [edge0, edge1, edge2]

    let optimizeVertices = [
      {angle: getVectorAngle(new Vector(vNext.x - vPrev.x, vNext.y - vPrev.y), new Vector(v.x - vPrev.x, v.y - vPrev.y)), oppositeEdge: edge0}, // vPrev
      {angle: getVectorAngle(new Vector(vPrev.x - v.x, vPrev.y - v.y), new Vector(vNext.x - v.x, vNext.y - v.y)), oppositeEdge: edge1}, // v
      {angle: getVectorAngle(new Vector(v.x - vNext.x, v.y - vNext.y), new Vector(vPrev.x - vNext.x, vPrev.y - vNext.y)), oppositeEdge: edge2} // vNext
    ]

    if (optimizeGridify && (optimizeVertices[0].angle < TRIANGULATION_ANGLE_BOUND || optimizeVertices[1].angle < TRIANGULATION_ANGLE_BOUND || optimizeVertices[2].angle < TRIANGULATION_ANGLE_BOUND)) {
      // Optimize triangle
      let optimizeVertex = optimizeVertices[0]
      let smallestAngle = optimizeVertices[0].angle
      for (let i = 1; i < optimizeVertices.length; i++) {
        if (optimizeVertices[i].angle > optimizeVertex.angle) optimizeVertex = optimizeVertices[i]
        if (optimizeVertices[i].angle < smallestAngle) v = optimizeVertices[i].angle
      }
      let peerEdge = getPeerEdge(triangles, optimizeVertex.oppositeEdge)
      if (peerEdge !== undefined) {
        let peerPolygon = peerEdge.parent
        let reformPolygon1 = new Polygon([
          peerPolygon.vertices[peerPolygon.vertices.indexOf(peerEdge.b())],
          peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b()) + 1) % peerPolygon.vertices.length],
          triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b()) + 1) % triangle.vertices.length]
        ])
        let reformPolygon2 = new Polygon([
          triangle.vertices[triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b())],
          triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b()) + 1) % triangle.vertices.length],
          peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b()) + 1) % peerPolygon.vertices.length]
        ])

        let vPrev = vertices[(lowest.i - 1) < 0 ? vertices.length - 1 : (lowest.i - 1)]
        let v = vertices[lowest.i]
        let vNext = vertices[(lowest.i + 1) % vertices.length]
        let triangle = new Polygon([vNext, v, vPrev])

        let edge0 = new Segment(v, vNext)
        edge0.parent = triangle
        let edge1 = new Segment(vNext, vPrev)
        edge1.parent = triangle
        let edge2 = new Segment(vPrev, v)
        edge2.parent = triangle

        triangle.edges = [edge0, edge1, edge2]

        triangle = reformPolygon1
        triangles.splice(triangles.indexOf(peerPolygon), 1, reformPolygon2)
      }
    }

    // Quality check (Optional)
    // get vertex with largest angle and select opposite edge.
    // find another generated triangle that shares the opposite edge
    // combine these triangles to form quadrilateral.
    // split quad into 2 new triangles along the other diagonal (not original diagonal)
    // if the minimum angle of these triangles is less than originals, swap out for these triangles.

    triangles.push(triangle)

    vertices.splice(lowest.i, 1)

    setConvexAndAngleFor(vertices, vertices.indexOf(vPrev))
    setEartipStatus(vertices, vertices.indexOf(vPrev))
    setConvexAndAngleFor(vertices, vertices.indexOf(vNext))
    setEartipStatus(vertices, vertices.indexOf(vNext))
  }

  cache_triangulation = triangles
  setNeighbors()
}

function setConvexAndAngleFor(vertices, i) {
  let vPrev = vertices[(i - 1) < 0 ? vertices.length - 1 : (i - 1)]
  let v = vertices[i]
  let vNext = vertices[(i + 1) % vertices.length]

  let prevVector = new Vector(vPrev.x - v.x, vPrev.y - v.y)
  let nextVector = new Vector(vNext.x - v.x, vNext.y - v.y)

  let cross = prevVector.crossProduct(nextVector)

  if (cross <= 0 || Number.isNaN(cross)) {
    v.convex = false
    return
  }

  v.convex = true
  v.angle = getVectorAngle(prevVector, nextVector)
}
function setEartipStatus(vertices, i) {
  let vPrev = vertices[(i - 1) < 0 ? vertices.length - 1 : (i - 1)]
  let v = vertices[i]
  let vNext = vertices[(i + 1) % vertices.length]

  if (!v.convex) {
    // print(`    Eartip is not convex skipping.`, [new Segment(v, vPrev), new Segment(v, vNext)])
    vertices[i].eartip = false
    return
  }

  let triangle = new Polygon([vNext, v, vPrev])
  for (let d = 0; d < vertices.length; d++) {
    if (vertices[d].convex) continue
    if (triangle.containsPoint(vertices[d])) {
      // print(`    Eartip contains point ${vertices[d].print()}.`, [vertices[d],  new Segment(v, vPrev), new Segment(v, vNext)])
      vertices[i].eartip = false
      return
    }
  }
  // print(`    Eartip with angle ${v.angle * 180 / Math.PI}.`, [new Segment(v, vPrev), new Segment(v, vNext)])
  v.eartip = true
}

function setNeighbors() {
  for (let i = 0; i < cache_triangulation.length; i++) {
    let polygon = cache_triangulation[i]
    for (let p = 0; p < cache_triangulation.length; p++) {
      if (i == p) continue
      let peerPolygon = cache_triangulation[p]
      polygon.edges.forEach(edge => {
        if (edge.peer !== undefined) return
        peerPolygon.edges.forEach(peerEdge => {
          if (peerEdge.peer !== undefined) return
          if (edge.equals(peerEdge.flip())) {
            edge.peer = peerEdge
            peerEdge.peer = edge
            // optional: additional preprocessing to store the segment distances
            edge.distance()
            peerEdge.distance()
          }
        })
      })
    }
  }
}

function getPeerEdge(peers, edge) {
  if (edge.peer !== undefined) return edge.peer
  for (let p = 0; p < peers.length; p++) {
    let peerPolygon = peers[p]
    for (let pE = 0; pE < peerPolygon.edges.length; pE++) {
      let peerEdge = peerPolygon.edges[pE]
      if (edge.equals(peerEdge.flip())) return peerEdge
    }
  }
  return undefined
}

function getVectorAngle(prevVector, nextVector) {
  return Math.acos(prevVector.dotProduct(nextVector) / (prevVector.magnitude() * nextVector.magnitude()))
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

/** A* pathfinding */
function getRoute(origin, destination, logged = true) {
  if (logged) print(`Routing ${origin.print()} to ${destination.print()}`, [origin, destination], true)
  let iOrigin = undefined
  let iDestination = undefined

  // move origin and destination outside of any blockers
  Blocker.blockers.forEach(blocker => {
    origin = blocker.polygon.closestPointOutsideFrom(origin)
    destination = blocker.polygon.closestPointOutsideFrom(destination)
  })
  // testCircle(destination.x, destination.y, 7)

  // find origin and destination polygons
  for (let i = 0; i < cache_triangulation.length; i++) {
    let polygon = cache_triangulation[i]
    if (iOrigin === undefined && polygon.containsPoint(origin)) iOrigin = i
    if (iDestination === undefined && polygon.containsPoint(destination)) iDestination = i
    if (iOrigin !== undefined && iDestination !== undefined) break
  }
  if (iOrigin === undefined || iDestination === undefined) return []

  let nodes = cache_triangulation.map(polygon => {
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
      let next = nodes[cache_triangulation.indexOf(edge.peer.parent)]
      let frontier = edge.closestPointOnSegmentTo(current.frontier)
      let cost = current.cost + Segment.distance(current.frontier, frontier) // TODO: edge cost is always 0
      if (logged) {
        testLine(current.frontier, frontier)
        print(`        Frontier ${frontier.print()} costs ${cost}`, [current.frontier, frontier, edge])
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
  if (logged) print(`Route from ${origin.print()} to ${destination.print()}`, route)
  return route
}

function drawGrid(context) {
  cache_triangulation.forEach(polygon => {
    context.strokeStyle = "rgba(50, 50, 200, 0.3)"
    context.fillStyle = "rgba(50, 50, 200, 0.05)"
    if (polygon.highlighted !== undefined && polygon.highlighted) {
      context.fillStyle = "rgba(50, 50, 200, 0.3)"
    }
    polygon.vertices.forEach(vertex => {
      context.beginPath();
      context.arc(vertex.x, vertex.y, 2, 0, 2 * Math.PI, false);
      context.fill()
    })
    context.beginPath();
    context.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
    polygon.vertices.forEach(vertex => context.lineTo(vertex.x, vertex.y))
    context.lineTo(polygon.vertices[0].x, polygon.vertices[0].y);
    if (!polygon.counterclockwise) context.fill()
    context.stroke();
  });
}
