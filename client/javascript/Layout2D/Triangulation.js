import { Segment, Vector, Polygon } from '../../node_modules/@harxer/geometry/geometry.js'
import {optimizeTriangulation as optimize} from './Layout.js'
import log from '../log.js';
import Blocker from './Blocker.js'

/** Controls threshold for graph optimization for conjoining triangles. */
let TRIANGULATION_ANGLE_BOUND = (30) / 180 * Math.PI

const DEBUG = true;

/**
 * Apply Delaunay triangulation to obtain an array of edge-sharing triangles.
 * @param {Polygon} boundsPolygon Polygon containing all holes for triangulation.
 * @param {[Polygon]} holePolygons Holes to be avoided when triangulating.
 * @returns {[Polygon]} an array of triangles
 */
export default function getTriangulatedGraph(boundsPolygon, holePolygons) {
  if (DEBUG) log('Generating triangulation.', holePolygons, true)
  if (boundsPolygon === undefined) return []

  /** Wrap vertices in object to prevent modifying Point. @returns {[{vertex: {Point}, convex: {bool}, angle: {int}, eartip: {bool}}]} */
  let graphBuilder = boundsPolygon.vertices.map(vertex => {return { vertex, convex: undefined, angle: undefined, eartip: undefined }})
  const graphEdges = _ => graphBuilder.map(({vertex}, i) => new Segment(vertex, graphBuilder[(i + 1) % graphBuilder.length].vertex))

  /** Update graphBuilder node at provided index i with angle attribute. */
  const setNodeAngle = (i) => {
    let node = graphBuilder[i];

    let vPrev = graphBuilder[(i - 1) < 0 ? graphBuilder.length - 1 : (i - 1)].vertex;
    let v = node.vertex;
    let vNext = graphBuilder[(i + 1) % graphBuilder.length].vertex;

    let prevVector = new Vector(vPrev.x - v.x, vPrev.y - v.y);
    let nextVector = new Vector(vNext.x - v.x, vNext.y - v.y);

    node.angle = Math.acos(prevVector.dotProduct(nextVector) / (prevVector.magnitude * nextVector.magnitude));
  }

  /** Updates convex and eartip state and angle of node in current graph.
   * Eartip vertices are convex and do not contain any peer vertices inside
   * the triangle formed by its neighbors ("reflex" vertices).
   */
  const setNodeData = (_, i) => {
    let node = graphBuilder[i];

    let vPrev = graphBuilder[(i - 1) < 0 ? graphBuilder.length - 1 : (i - 1)].vertex;
    let v = node.vertex;
    let vNext = graphBuilder[(i + 1) % graphBuilder.length].vertex;

    let prevVector = new Vector(vPrev.x - v.x, vPrev.y - v.y);
    let nextVector = new Vector(vNext.x - v.x, vNext.y - v.y);

    let cross = prevVector.crossProduct(nextVector)

    if (cross <= 0 || Number.isNaN(cross)) {
      node.convex = false;
      node.eartip = false;
      if (DEBUG) log(`    Setting node data CROSS:${node.convex}`, [vPrev, v, vNext])
      return
    }

    node.convex = true
    // Get angle between origin-shared vectors
    node.angle = Math.acos(prevVector.dotProduct(nextVector) / (prevVector.magnitude * nextVector.magnitude));

    let triangle = new Polygon([vNext, v, vPrev]);
    node.eartip = graphBuilder.every(({vertex, convex}) => convex || vertex.equals(vPrev) || vertex.equals(v) || vertex.equals(vNext) || !triangle.containsPoint(vertex));
    // TODO verify `convex ||` above
    if (DEBUG) log(`    Setting node data EAR:${node.eartip}`, [new Segment(vPrev, v), new Segment(v, vNext)])
  }

  // Connect holes to bounds using "bridge" segments to form one degenerate polygon
  let holePolygonsRemaining = [...holePolygons];
  const I_HOLE = 0; // Always pull from start, if no bridge to bounds, hole is pushed to end
  while (holePolygonsRemaining.length > 0) {
    let hole = holePolygonsRemaining.splice(I_HOLE, 1)[0];

    // Select shortest "bridge" edge connecting hole to bounding polygon. // TODO might not need to get shortest edge (first may work)
    let { bridgeEdge, iHoleVertex } = hole.vertices.reduce((shortestBridge, holeVertex, iHoleVertex) => {

      // Find all segments that connect a hole to bounds without intersecting itself or neighbors
      let {distSqrd, bridgeCandidate} = graphBuilder
        .map(({vertex: boundsVertex}) => new Segment(boundsVertex, holeVertex))
        // .forEach(({bridgeCandidate, iBoundsVertex}) => log(`v ${iBoundsVertex}  `, [bridgeCandidate]))
        .filter(bridgeCandidate =>
          // if (DEBUG) log(`  - Bridge candidate`, [bridgeCandidate])
          // Check intersections with this hole's edges - ignoring endpoint overlaps
          hole.edges.every(holeEdge => holeEdge.a.equals(holeVertex) || holeEdge.b.equals(holeVertex) || !holeEdge.intersects(bridgeCandidate)) &&
          // Check intersections with bounds edges - ignoring endpoint overlaps
          graphEdges().every(boundsEdge => boundsEdge.a.equals(bridgeCandidate.a) || boundsEdge.b.equals(bridgeCandidate.a) || !boundsEdge.intersects(bridgeCandidate)) &&
          // Check intersections with other hole's edges
          holePolygonsRemaining.every((peerHole, iPeerHole) => iPeerHole <= I_HOLE || peerHole.edges.every(peerHoleEdge => !peerHoleEdge.intersects(bridgeCandidate)))
        )
        .reduce((shortestBridgeCandidate, bridgeCandidate) => {
          let distSqrd = bridgeCandidate.distanceSqrd();
          if (distSqrd < shortestBridgeCandidate.distSqrd) return { distSqrd, bridgeCandidate };
          return shortestBridgeCandidate;
        }, { distSqrd: Infinity })

      if (distSqrd < shortestBridge.distSqrd) return { distSqrd, iHoleVertex, bridgeEdge: bridgeCandidate}
      return shortestBridge;
    }, {distSqrd: Infinity});

    if (bridgeEdge === undefined) {
      if (holePolygonsRemaining.length === 1) {
        throw 'No bridges for single hole polygon.'
      }
      if (DEBUG) log('  No bridge edges. Pushing to end.')
      // Push hole to end
      holePolygonsRemaining.push(hole);
      if (DEBUG) log('  Remaining new triangulation.', holePolygonsRemaining)
      continue;
    };

    if (DEBUG) log(`Bridge edge generated ${bridgeEdge.logString()} at ${iHoleVertex}`, [bridgeEdge])

    // Insert hole and bridge vertices into composite polygon
    let shiftedHoleVertices = hole.vertices.slice(iHoleVertex + 1).concat(hole.vertices.slice(0, iHoleVertex + 1))
    // if (DEBUG) log(`shiftedHoleVertices`, shiftedHoleVertices.concat([new Segment(shiftedHoleVertices[0], shiftedHoleVertices[0].copy.add({x: 0, y: -50}))]))
    // if (DEBUG) log(`iBoundsVertex ${iBoundsVertex}`, [new Segment(shiftedHoleVertices[0], shiftedHoleVertices[0].copy.add({x: 0, y: -50}))])
    // Insert bridge and hole into smallest angle vertex for overlapped bridge insertions
    let boundsVertexEntry = graphBuilder.reduce((smallest, node, iNode) => {
      // Find overlapping bridge intersections
      if (!bridgeEdge.a.equals(node.vertex)) return smallest;
      setNodeAngle(iNode);
      if (DEBUG) log(`  Vertex angle ${node.angle}`, [node.vertex]);
      // Select smallest inner angle
      if (node.angle > smallest.angle) return {angle: node.angle, iNode}
      return smallest;
    }, {angle: 0}).iNode;
    // let boundsVertexEntry = graphBuilder.findLastIndex((({vertex}) => bridgeEdge.a.equals(vertex)))
    if (DEBUG) log(`Insert here ${boundsVertexEntry}`, [bridgeEdge, ...graphBuilder.map(({vertex}) => vertex)])
    graphBuilder.splice(boundsVertexEntry, 0, ...[bridgeEdge.a, bridgeEdge.b, ...shiftedHoleVertices].map(vertex => {return { vertex }}))
    // if (DEBUG) log('graph', graphBuilder.map(({vertex}) => vertex).filter((node, i) => graphBuilder.every(({vertex: other}, iOther) => i <= iOther || !node.equals(other))))
    // if (DEBUG) graphBuilder.forEach(({vertex}, i) => log(`graph ${i}`, [vertex]))
  }

  if (DEBUG) graphBuilder.forEach(({vertex}, i) => log(`Final graph ${i}`, [vertex]))
  graphBuilder.forEach(setNodeData);

  let triangles = [];
  let n = graphBuilder.length;
  while (triangles.length < n - 2) {

    // Get smallest graph node by inner angle
    let {node, iNode} = graphBuilder.reduce((smallestAngleNode, node, iNode) => {
      if (!node.eartip) return smallestAngleNode;
      if (node.angle < smallestAngleNode.angle) return {angle: node.angle, node, iNode};
      return smallestAngleNode;
    }, {angle: Infinity});

    // No eartip nodes available
    if (node === undefined) {
      if (DEBUG) log('No eartips.');
      break;
    };

    let vPrev = graphBuilder[(iNode - 1) < 0 ? graphBuilder.length - 1 : (iNode - 1)].vertex;
    let v = node.vertex;
    let vNext = graphBuilder[(iNode + 1) % graphBuilder.length].vertex;

    // Triangulation degenerate polygon is CCW. Vertices are flipped here to form CW polygon
    let triangle = new Polygon([vNext, v, vPrev])

    if (false && optimize) {
      let optimizeVertices = [
        {angle: triangle.interiorAngleVertex(0), oppositeEdge: triangle.edges[1]},
        {angle: triangle.interiorAngleVertex(1), oppositeEdge: triangle.edges[2]},
        {angle: triangle.interiorAngleVertex(2), oppositeEdge: triangle.edges[0]}
      ].sort((e1, e2) => e1.angle < e2.angle)

      if (optimizeVertices.some(v => v.angle < TRIANGULATION_ANGLE_BOUND)) {
        let optimizeVertex = optimizeVertices[0]
        let peerEdge = getPeerEdge(triangles, optimizeVertex.oppositeEdge)
        if (peerEdge !== undefined) {
          let peerPolygon = peerEdge.parent

          let quadrilateral = new Polygon([
            triangle.vertices[triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b)],
            triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b) + 1) % triangle.vertices.length],
            peerPolygon.vertices[peerPolygon.vertices.indexOf(peerEdge.b)],
            peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b) + 1) % peerPolygon.vertices.length]
          ])

          if (quadrilateral.convex()) {
            let reformPolygon1 = new Polygon([
              peerPolygon.vertices[peerPolygon.vertices.indexOf(peerEdge.b)],
              peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b) + 1) % peerPolygon.vertices.length],
              triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b) + 1) % triangle.vertices.length]
            ])
            let reformPolygon2 = new Polygon([
              triangle.vertices[triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b)],
              triangle.vertices[(triangle.vertices.indexOf(optimizeVertex.oppositeEdge.b) + 1) % triangle.vertices.length],
              peerPolygon.vertices[(peerPolygon.vertices.indexOf(peerEdge.b) + 1) % peerPolygon.vertices.length]
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

    if (DEBUG) log(`Processing triangle at ${iNode}`, [triangle])

    triangles.push(triangle);
    graphBuilder.splice(iNode, 1);

    // update state on prev node
    setNodeData(undefined, (iNode - 1) < 0 ? graphBuilder.length - 1 : (iNode - 1));
    // update state on next node which is now just iNode
    setNodeData(undefined, iNode % graphBuilder.length);
  }

  // Link overlapping edges
  // for (let i = 0; i < triangles.length; i++) {
  //   let polygon = triangles[i]
  //   for (let p = 0; p < triangles.length; p++) {
  //     if (i == p) continue
  //     let peerPolygon = triangles[p]
  //     polygon.edges.forEach(edge => {
  //       if (edge.peer !== undefined) return
  //       peerPolygon.edges.forEach(peerEdge => {
  //         if (peerEdge.peer !== undefined) return
  //         if (edge.equals(peerEdge.flip())) {
  //           edge.peer = peerEdge
  //           peerEdge.peer = edge
  //           // optional: additional preprocessing to store the segment distances
  //           edge.distance()
  //           peerEdge.distance()
  //         }
  //       })
  //     })
  //   }
  // }
  if (DEBUG) log(`Created triangles: ${triangles.length}.`, triangles);
  return triangles
}

// ======== INTERNAL Helpers =========


/** Finds peer edge overlapping this edge (peer would be reversed from target).
 * @returns {Vector}
*/
function getPeerEdge(peers, edge) {
  if (edge.peer !== undefined) return edge.peer
  for (let p = 0; p < peers.length; p++) {
    let peerPolygon = peers[p]
    if (edge.parent == peerPolygon) continue
    for (let pE = 0; pE < peerPolygon.edges.length; pE++) {
      let peerEdge = peerPolygon.edges[pE]
      if (edge.equals(peerEdge.flip())) return peerEdge
    }
  }
  return undefined
}
