import { Segment, Vector, Polygon, Point } from './Geometry.js'
import log from '../log.js'
import {optimizeTriangulation as optimize} from './Layout.js'
import Blocker from './Blocker.js'

let TRIANGULATION_ANGLE_BOUND = (30) / 180 * Math.PI

/**
 * Apply delauny triangulation to obtain an array of edge-sharing triangles.
 * @param {Blocker} boundsBlocker Blocker containing all holes for triangulation.
 * @param {[Polygon]} holePolygons Holes to be avoided when triangulating.
 * @returns {[Polygon]} an array of triangles
 */
export default function generateTriangulation(boundsBlocker, holePolygons) {
  log('Generating triangulation.', [], true)
  if (boundsBlocker === undefined) return []
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
      break
    }
    let vPrev = vertices[(lowest.i - 1) < 0 ? vertices.length - 1 : (lowest.i - 1)]
    let v = vertices[lowest.i]
    let vNext = vertices[(lowest.i + 1) % vertices.length]
    if (vPrev === undefined || v === undefined || vNext === undefined) {
      throw 'Vertex issue in pathing.'
    }
    // Triangulation degenerate polygon is CCW. Vertices are flipped here to form CW polygon
    let triangle = new Polygon([vNext, v, vPrev])

    if (optimize) {
      let optimizeVertices = [
        {angle: triangle.interiorAngleVertex(0), oppositeEdge: triangle.edges()[1]},
        {angle: triangle.interiorAngleVertex(1), oppositeEdge: triangle.edges()[2]},
        {angle: triangle.interiorAngleVertex(2), oppositeEdge: triangle.edges()[0]}
      ].sort((e1, e2) => e1.angle < e2.angle)

      if (optimizeVertices.some(v => v.angle < TRIANGULATION_ANGLE_BOUND)) {
        let optimizeVertex = optimizeVertices[0]
        let peerEdge = getPeerEdge(triangles, optimizeVertex.oppositeEdge)
        if (peerEdge !== undefined) {
          let peerPolygon = peerEdge.parent

          let quadrilateral = new Polygon([
            triangle.vertices[triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b())],
            triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b()) + 1) % triangle.vertices.length],
            peerPolygon.vertices[peerPolygon.vertices.indexOf(peerEdge.b())],
            peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b()) + 1) % peerPolygon.vertices.length]
          ])

          if (quadrilateral.convex()) {
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

            let smallestOriginalAngle = optimizeVertices[2].angle
            peerPolygon.vertices.forEach((_, i) => {
              let angle = peerPolygon.interiorAngleVertex(i)
              if (angle < smallestOriginalAngle) smallestOriginalAngle = angle
            })

            let smallestNewAngle = Math.PI
            reformPolygon1.vertices.forEach((_, i) => {
              let angle = reformPolygon1.interiorAngleVertex(i)
              if (angle < smallestNewAngle) smallestNewAngle = angle
            })
            reformPolygon2.vertices.forEach((_, i) => {
              let angle = reformPolygon2.interiorAngleVertex(i)
              if (angle < smallestNewAngle) smallestNewAngle = angle
            })

            if (smallestOriginalAngle < smallestNewAngle) {
              triangle = reformPolygon1
              triangles.splice(triangles.indexOf(peerPolygon), 1, reformPolygon2)
            }
          }
        }
      }
    }

    triangles.push(triangle)

    vertices.splice(lowest.i, 1)

    setConvexAndAngleFor(vertices, vertices.indexOf(vPrev))
    setEartipStatus(vertices, vertices.indexOf(vPrev))
    setConvexAndAngleFor(vertices, vertices.indexOf(vNext))
    setEartipStatus(vertices, vertices.indexOf(vNext))
  }

  setNeighbors(triangles)
  return triangles
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
    // log(`    Eartip is not convex skipping.`, [new Segment(v, vPrev), new Segment(v, vNext)])
    vertices[i].eartip = false
    return
  }

  let triangle = new Polygon([vNext, v, vPrev])
  for (let d = 0; d < vertices.length; d++) {
    if (vertices[d].convex) continue
    if (triangle.containsPoint(vertices[d])) {
      // log(`    Eartip contains point ${vertices[d].logString()}.`, [vertices[d],  new Segment(v, vPrev), new Segment(v, vNext)])
      vertices[i].eartip = false
      return
    }
  }
  // log(`    Eartip with angle ${v.angle * 180 / Math.PI}.`, [new Segment(v, vPrev), new Segment(v, vNext)])
  v.eartip = true
}
function setNeighbors(triangles) {
  for (let i = 0; i < triangles.length; i++) {
    let polygon = triangles[i]
    for (let p = 0; p < triangles.length; p++) {
      if (i == p) continue
      let peerPolygon = triangles[p]
      polygon.edges().forEach(edge => {
        if (edge.peer !== undefined) return
        peerPolygon.edges().forEach(peerEdge => {
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
    if (edge.parent == peerPolygon) continue
    for (let pE = 0; pE < peerPolygon.edges().length; pE++) {
      let peerEdge = peerPolygon.edges()[pE]
      if (edge.equals(peerEdge.flip())) return peerEdge
    }
  }
  return undefined
}
function getVectorAngle(prevVector, nextVector) {
  return Math.acos(prevVector.dotProduct(nextVector) / (prevVector.magnitude() * nextVector.magnitude()))
}
