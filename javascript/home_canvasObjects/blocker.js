/**
 * Provides convenience construction and render methods for polygons. Pathfinding will use the global
 * blockers array to create the world graph layout. Each object will track its original constructing
 * vertices but its final polygon may be altered in the case of unions or holes.
 * @param vertices - Array of points that make up a blocker. CW fills internally. CCW fills externally.
 * @param originalVertices - Array of vertices that formed this blocker's polygon before union.
 * @param holes - Array of polygons. Primarly used for drawing inaccessible areas. NYI.
 */
class Blocker {
  constructor(vertices, originalVertices, holes) {

    // TODO: Test if any edges overlap here in blocker creation. This means the blocker is invalid.

    // Perserive original vertices for visuals but calculations are run on postprocessed blocker
    this.originalVertices = (originalVertices !== undefined) ? originalVertices : [vertices]

    // Extrude blocker to keep pathers from getting too close to blocker
    const EXTRUSION_AMOUNT = 0 // 10
    let extrudedVertices = (originalVertices === undefined && EXTRUSION_AMOUNT !== 0) ? extrudeVertices(vertices, EXTRUSION_AMOUNT) : vertices
    this.polygon = new Polygon(extrudedVertices, holes)

    // Union overlapping blockers
    for (let b = 0; b < Blocker.blockers.length; b++) {
      let peer = Blocker.blockers[b]
      if (this.polygon.overlaps(peer.polygon)) {
        let unionPolygon = this.polygon.union(peer.polygon)
        if (unionPolygon === undefined) continue
        Blocker.blockers.splice(b, 1)
        new Blocker(unionPolygon.vertices, this.originalVertices.concat(peer.originalVertices), unionPolygon.holes)
        return // Prevent this blocker from being appended to the global blockers array
      }
    }

    Blocker.blockers.push(this);
  }

  vertices() {
    return this.polygon.vertices
  }

  edges() {
    return this.polygon.edges()
  }

  render(context) {
    // Draw originalVertices
    context.strokeStyle = "Red";
    context.fillStyle = "rgba(200, 50, 50, 0.1)"
    if (this.polygon.counterclockwise) context.strokeStyle = "Blue";
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
      if (!this.polygon.counterclockwise) context.fill();
      context.stroke();
    });
  }
}
Blocker.blockers = [];
// Blocker.rawVertices = []; // Only used for visuals - no calcs on this.
Blocker.constsructingVertices = []; // Used by editMode

Blocker.finishConstruction = (discard = false) => {
  if (Blocker.constsructingVertices.length > 2 && !discard) {
    new Blocker(Blocker.constsructingVertices);
  }
  if (Blocker.constsructingVertices.length == 0 && !discard) {
    // Delete blocker if contains right click
    for (let b = 0; b < Blocker.blockers.length; b++) {
      if (Blocker.blockers[b].polygon.containsPoint(new Point(mouse.x, mouse.y))) {
        Blocker.blockers.splice(b, 1);
        break;
      }
    }
  }
  Blocker.constsructingVertices = [];
}

Blocker.constructionRender = context => {
  // Draw preprocessed blocker
  Blocker.blockers.forEach(blocker => {
    // Draw boundaries
    context.strokeStyle = "Green";
    context.beginPath();
    blocker.vertices().forEach((vertex, i) => {
      if (i == 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.lineTo(blocker.vertices()[0].x, blocker.vertices()[0].y);
    context.stroke();

    // Draw holes
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    blocker.polygon.holes.forEach((hole) => {
      hole.vertices.forEach((vertex, i) => {
        if (i == 0) {
          context.beginPath();
          context.moveTo(vertex.x, vertex.y);
        } else {
          context.lineTo(vertex.x, vertex.y);
        }
      });
      context.lineTo(hole.vertices[0].x, hole.vertices[0].y);
      context.fill();
    });
  });

  // Draw construction vertices
  for (let c = 0; c < Blocker.constsructingVertices.length; c++) {
    let vertex = Blocker.constsructingVertices[c];
    context.strokeStyle = "Red";
    context.beginPath();
    context.arc(vertex.x, vertex.y, 3, 0, 2 * Math.PI, false);
    context.stroke();

    if (c > 0) {
      let vertexPrev = Blocker.constsructingVertices[c-1];
      context.beginPath();
      context.moveTo(vertexPrev.x, vertexPrev.y);
      context.lineTo(vertex.x, vertex.y);
      context.stroke();
    }
  }
}

/**
   * Checks blocker collisions against a segment, ray, or line the starts from a vertex
   * on the perimeter of the blocker.
   * @param Ray ray The ray cast out to collide with any blockers.
   * @returns undefined if no collision or ray is internal to self. Else returns a hash with
   * the index of the blocker it collided with, the index of the side of the blocker that
   * was collided with, and the intersection point.
   * @example
   * {
   *   intersectionPoint: Point,
   *   blocker: Blocker,
   *   side: Segment
   * }
   */
Blocker.raycast = ray => {
  // TODO: Sides that lay along the cast line count shouldn't count as intersect
  // Check if ray goes inside its own blocker. If so, return undefined

  let pierce = {
    side: undefined,
    distanceSqrd: undefined,
    point: undefined
  };

  for (let b = 0; b < Blocker.blockers.length; b++) {
    let pierceData = Blocker.blockers[b].pierce(ray)
    if (pierceData !== undefined &&
      (pierce.distanceSqrd === undefined || pierceData.distanceSqrd < pierce.distanceSqrd)) {
      pierce = pierceData
    }
  }

  return pierce
}
