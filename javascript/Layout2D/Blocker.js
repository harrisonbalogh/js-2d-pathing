import {Segment, Line, Ray, Vector, Polygon, Point, extrudeVertices} from './Geometry.js'

/**
 * Provides convenience construction and render methods for polygons. Pathfinding will use the global
 * blockers array to create the world graph layout. Each object will track its original constructing
 * vertices but its final polygon may be altered in the case of unions or holes.
 * @param polygon - Polygon that make up a blocker.
 * @param originalVertices - Array of vertices that formed this blocker's polygon before union.
 */
export default class Blocker {
  constructor(polygon, originalVertices) {
    this.originalVertices = originalVertices // Retain original for visuals. calculations run on postprocessed polygon
    this.polygon = polygon
  }

  vertices() {
    return this.polygon.vertices
  }

  edges() {
    return this.polygon.edges()
  }

  render(context) {
    // Draw originalVertices
    if (this.polygon !== undefined) context.strokeStyle = "Red";
    context.fillStyle = "rgba(200, 50, 50, 0.1)"
    if (this.polygon !== undefined && this.polygon.counterclockwise) context.strokeStyle = "Blue";
    this.originalVertices.forEach(vertices => {
      vertices.forEach((vertex, i) => {
        if (i == 0) {
          context.beginPath();
          context.moveTo(vertex.x, vertex.y);
        } else {
          context.lineTo(vertex.x, vertex.y);
        }
      });
      context.lineTo(vertices[0].x, vertices[0].y);
      if (this.polygon === undefined || !this.polygon.counterclockwise) context.fill();
      context.stroke();
    });
  }
}
