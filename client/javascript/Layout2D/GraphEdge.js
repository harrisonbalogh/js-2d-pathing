/**
 * Wrapper for a HXGeometry Segment which can link to a peer edge lying on
 * itself in reverse direction. Retains reference to parent triangle in graph.
 */
export default class GraphEdge {
  /**
   * @param {GraphTriangle} parent
   * @param {Segment} edge
   * @param {GraphEdge} peer
   */
  constructor(parent, edge, peer = undefined) {
    this._parent = parent;
    this._edge = edge;
    this._peer = peer;
    // Object.freeze(this); // TODO - verify
  }

  // ------------------------ Properties

  /** Graph triangle border edge. @returns {Segment} */
  get edge() {
    return this._edge;
  }
  set edge(_) { throw Error('Graph edge is immutable.') }

  /**
   * Graph triangle border edge's overlapping peer edge.
   * @returns {GraphEdge?} Peer graph edge or undefined if no bordering triangle in graph.
   */
  get peer() {
    return this._peer;
  }
  /** Sets peer GraphEdge to this structure. Also syncs peerEdge's `peer` to `this`. */
  set peer(_) { throw Error('Graph edge peer is linked with `linkEdge(peer)`.') }

  /** Graph edge's owning triangle. @returns {GraphTriangle} */
  get parent() {
    return this._parent;
  }
  set parent(_) { throw Error('Graph edge parent is immutable.') }

  // ------------------------ Functions

  linkEdge(peerEdge) {
    this._peer = peerEdge;
    peerEdge._peer = this;
  }

  /** Structure stringified for readability. @returns {string} "(x,y) -> (x,y)" or "(x,y) plus <vector>" */
  logString() {
    return "// TODO"
  }

  // --------------------- Static methods

  // --------------------- Internal methods

}
