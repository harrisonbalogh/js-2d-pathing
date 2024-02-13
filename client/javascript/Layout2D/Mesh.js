import log from '../log.js'
import { Polygon } from '../../node_modules/@harxer/geometry/geometry.js';
import triangulateGraph from './Triangulation.js'

/**
 * Provides convenience construction and render methods for polygons. Pathfinding will use the global
 * blockers array to create the world graph layout.
 * @param polygon - Polygon that make up a blocker.
 */
export default class Mesh {
  constructor(polygon, holes = [], parent) {
    /** Boundary polygon. @type {Polygon} */
    this.bounds = polygon;
    /** @type {[Mesh]} */
    this.holes = holes;
    /** @type {Mesh} */
    this.parent = parent;

    /** Set to undefined if needs new triangulation compute, else array. */
    this._triangulatedGraph = undefined;
  }

  /** Flag mesh for new triangulation compute on next graph array retrieval. */
  needsTriangulation() {
    this._triangulatedGraph = undefined;
  }

  /** @returns {[GraphTriangle]} */
  get triangulatedGraph() {
    if (this._triangulatedGraph !== undefined) return this._triangulatedGraph;
    try {
      this._triangulatedGraph = triangulateGraph(
        this.bounds,
        this.holes.map(hole => hole.bounds.copy.reverse())
      )
    } catch(e) {
      console.log(`No bridges. Error: ${e}`, e)
      this._triangulatedGraph = [];
    }
  }

  render(context) {
    // Draw originalVertices
    if (this.polygon !== undefined) context.strokeStyle = "Red";
    context.fillStyle = "rgba(200, 50, 50, 0.1)"
    if (this.polygon !== undefined && this.polygon.counterclockwise) context.strokeStyle = "Blue";
    this.polygon.vertices.forEach(vertices => {
      vertices.forEach((vertex, i) => {
        if (i == 0) {
          context.beginPath();
          context.moveTo(vertex.x, vertex.y);
        } else {
          context.lineTo(vertex.x, vertex.y);
        }
      });
      context.lineTo(vertices[0].x, vertices[0].y);
      if (this.polygon === undefined || this.polygon.clockwise) context.fill();
      context.stroke();
    });
  }

  /** Returns latest mesh. This will be itself or the new hole. */
  applyHole(polygon) {
    let self = this;
    // Check overlap
    if (this.bounds.overlaps(polygon)) {
      this.needsTriangulation();
      // CCW polygon subtract from bounds, CW union
      this.bounds = this.bounds.union(polygon);
      log(`Union bounds`, [polygon, this.bounds])
    } else if (polygon.counterclockwise && polygon.vertices.some(vertex => !self.bounds.containsPoint(vertex))) {
      this.needsTriangulation();
      // Internal contained polygons become holes
      let newMesh;
      let iOverlappedHole = this.holes.findIndex(hole => hole.bounds.overlaps(polygon));
      if (iOverlappedHole !== -1) {
        while (iOverlappedHole !== -1) {
          let overlappedHole = this.holes.splice(iOverlappedHole, 1)[0].bounds.copy.reverse();
          let overlayHole = newMesh ? newMesh.bounds.reverse() : polygon;
          log(`Union hole ${overlappedHole.logString()}`, [overlappedHole])
          log(`  ... onto ${overlayHole.logString()}`, [overlayHole])
          let unionPolygon = overlappedHole.union(overlayHole).reverse();
          newMesh = new Mesh(unionPolygon, overlappedHole.holes.concat(newMesh ? newMesh.holes : []), this)
          log(`  ... new hole`, [newMesh.bounds])

          iOverlappedHole = this.holes.findIndex(hole => hole.bounds.overlaps(unionPolygon));
          if (iOverlappedHole === -1) {

            // Remove holes swallowed by new hole
            let iInternalHole = this.holes.findIndex(hole => !newMesh.bounds.contains(hole.bounds));
            while (iInternalHole !== -1) {
              log(`Removing smaller internal hole`, [this.holes.splice(iInternalHole, 1)])
              iInternalHole = this.holes.findIndex(hole => !newMesh.bounds.contains(hole.bounds));
            }

            this.holes.push(newMesh)
            log(`Adding union hole`, [newMesh.bounds])
            return newMesh;
          }
        }
      } else {
        if (this.holes.some(hole => !hole.bounds.contains(polygon))) {
          log(`Ignoring internal polygon.`, [polygon])
          return this;
        }
        polygon = polygon.copy.reverse();
        let newMesh = new Mesh(polygon, [], this);

        // Remove holes swallowed by new hole
        let iInternalHole = this.holes.findIndex(hole => !polygon.contains(hole.bounds));
        while (iInternalHole !== -1) {
          log(`Removing smaller internal hole`, [this.holes.splice(iInternalHole, 1)])
          iInternalHole = this.holes.findIndex(hole => !polygon.contains(hole.bounds));
        }

        this.holes.push(newMesh);
        log(`Adding non-overlapped hole`, [polygon])
        return newMesh;
      }
    } else {
      log(`Ignoring external polygon. CCW: ${polygon.counterclockwise}`, [polygon])
    }
    log(`Adding hole`, [polygon])
    return this;
    // Ignore non-overlapping counterclockwise polygons
  }

  /** Removes hole from mesh if hit by given point. @param {Point} p @returns true if removed a hole  */
  removeHoleUnderPoint(p) {
    let iHoleCollision = this.holes.findIndex(hole => !hole.bounds.containsPoint(p))
    if (iHoleCollision > -1) {
      this.holes.splice(iHoleCollision, 1);
      this.needsTriangulation();
      return true;
    }
    return false;
  }
}
