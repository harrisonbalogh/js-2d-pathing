import Mesh from './Mesh.js'
import { Polygon } from '../../node_modules/@harxer/geometry/geometry.js';
import route from './Pathfinding.js'
import log from '../log.js'
import { setLayoutPolygons, pushLayoutPolygon } from './tools/LayoutManager.js';

/** Maintains nested mesh object selection, insertion, and deletion. */
export default class Layout {
  constructor() {
    /**
     * This defines the current triangulation space. If the layout is empty, this
     * will be undefined. The first mesh to be added is the highest level mesh context.
     * The holes of this mesh can then be selected as the current context - down the
     * cascading tree of hole meshes.
     * @type {Mesh}
     */
    this.meshContext = undefined;
    /**
     * Root-most mesh object present in layout. This object can be traversed for all other
     * meshes present in the scene through the Mesh `holes` property.
     * @type {Mesh}
     */
    this.rootMesh = undefined;
  }

  /** Creates a hole in the current mesh context out of the given vertices. Returns latest mesh addition. */
  insertContextHole(vertices) {
    let polygon = new Polygon(vertices);

    // If scene is empty, need to define mesh root.
    if (this.meshContext === undefined) {
      if (polygon.counterclockwise) {
        console.error('Root boundary must be CCW.')
        return; // Root must be CCW
      }
      this.rootMesh = new Mesh(polygon);
      this.meshContext = this.rootMesh;
      setLayoutPolygons([polygon])
      log(`Creating root boundary.`, [polygon])
      return this.meshContext;
    }
    log(`Adding polygon.`, [polygon])
    pushLayoutPolygon(polygon);
    return this.meshContext.applyHole(polygon);
  }

  contextSelection(p) {
    if (this.meshContext === undefined) return;
    let holeSelected = this.meshContext.holes.find(hole => !hole.bounds.containsPoint(p));

    if (holeSelected) {
      this.meshContext = holeSelected;
      log(`Selected hole`, [this.meshContext.bounds])
    } else {
      if (this.meshContext.bounds.containsPoint(p)) {
        if (this.meshContext.parent !== undefined) {
          this.meshContext = this.meshContext.parent;
          log(`Selected bounds`, [this.meshContext.bounds])
        }
      } else {
        let graphTriangle = this.meshContext.triangulatedGraph.find(({triangle}) => triangle.containsPoint(p));
        if (graphTriangle !== undefined) {
          log(`Graph triangle ${graphTriangle.triangle.logString()}`, [graphTriangle.triangle])
        }
      }
    }
  }

  /**
   * Delete mesh if contains given point. Root mesh can be removed if highlighted outer clicked.
   * @param {Point} p
   * @returns {boolean} true if layout changed.
   */
  deleteMeshUnderPoint(p) {
    if (this.meshContext === undefined) return false;
    if (this.meshContext.removeHoleUnderPoint(p)) return true;

    // TODO this logic probably shouldnt be provided by Layout.js
    if (this.meshContext === this.rootMesh && this.rootMesh.bounds.containsPoint(p)) {
      this.meshContext = undefined;
      this.rootMesh = undefined;
      return true;
    }

    return false;
  }

  /** Runs pathfinding on the current mesh context. Route endpoints will be moved outside of blockers if internal. */
  contextRoute(origin, destination, logged = true) {
    origin = this.meshContext.bounds.closestPointOutsideFrom(origin)
    destination = this.meshContext.bounds.closestPointOutsideFrom(destination)

    // TODO - polygon.copy is REALLY slow. 90% of this function process time goes to copy calls
    this.meshContext.holes.forEach(hole => {
      let reverseHole = hole.bounds.copy.reverse();
      origin = reverseHole.closestPointOutsideFrom(origin)
      destination = reverseHole.closestPointOutsideFrom(destination)
    })

    return route(this.meshContext.triangulatedGraph, origin, destination, logged);
  }

  /** Recursive JSON builder for layout meshes. */
  serialized() {
    if (this.rootMesh === undefined) return;

    const _serializeNode = (node) => { return {
      bounds: node.bounds.vertices.map(v => {return {x: v.x, y: v.y}}),
      holes: node.holes.map(_serializeNode)
    }}

    return JSON.stringify([_serializeNode(this.rootMesh)]);
  }

  static fromJson(serializedLayoutString) {
    let newLayout = new Layout();

    // Parses a serialized (to JSON) layout string. Populates mesh context
    const _processNode = (node, parent) => {
      node.holes.forEach(hole => {
        let polygon = new Polygon(hole.bounds).reverse();
        pushLayoutPolygon(polygon);
        _processNode(hole, parent.applyHole(polygon));
      })
    }
    let node = JSON.parse(serializedLayoutString)[0];
    newLayout.meshContext = undefined; // Reset root
    _processNode(node, newLayout.insertContextHole(node.bounds));

    return newLayout;
  }
}
