import GraphEdge from "./GraphEdge.js";

/**
 * Wrapper for graph polygon.
 * @property edges
 */
export default class GraphTriangle {
  /**
   * @param {Polygon} triangle
   */
  constructor(triangle) {
    if (triangle === undefined || triangle.edges.length !== 3) {
      throw Error(`Graph triangle poorly formed. Must be defined and 3-edged: ${triangle?.logString()}`)
    }
    this._triangle = triangle;
    this._edges = triangle.edges.map(edge => new GraphEdge(this, edge));
  }

  /** Graph triangle node. @returns {Polygon} */
  get triangle() {
    return this._triangle;
  }
  set triangle(_) { throw Error('Graph triangle is immutable.') }

  /** Graph triangle graph edges. @returns {[GraphEdge]} */
  get edges() {
    return this._edges;
  }
  set edges(_) { throw Error('Graph edges cannot be set.') }

  // ------------------------ Functions

  /** Serializes structure to a string. @returns {string} */
  logString() {
    return '// TODO';
  }
}
