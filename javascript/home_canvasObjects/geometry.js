/// A segment is composed of 2 vertices.
function Segment(vertex1, vertex2) {

  this.a = vertex1;
  this.b = vertex2;

  // https://www.codeproject.com/Tips/862988/Find-the-Intersection-Point-of-Two-Line-Segments
  // Returns a point or undefined where the two segments intersect. If only need
  // true of false if two segments intersect, use intersects(). Will return undefined
  // if end points match
  this.intersectionPoint = function(segment) {

    // Check for end points matching
    if (this.a.equals(segment.a) || this.a.equals(segment.b) || this.b.equals(segment.a) || this.b.equals(segment.b)) {
      return undefined;
    }
    let r = this.b.minus(this.a);
    let s = segment.b.minus(segment.a);
    let rxs = r.cross(s);
    let qpxr = (segment.a.minus(this.a)).cross(r);

    if (rxs == 0 && qpxr == 0) {
      // collinear segments
      // ignoring.
      return undefined;
    }
    if (rxs == 0 && qpxr != 0) {
      return undefined; // parallel
    }

    let t = (segment.a.minus(this.a)).cross(s) / rxs;
    let u = (segment.a.minus(this.a)).cross(r) / rxs;

    if (rxs != 0 && (0 <= t && t <= 1) && (0 <= u && u <= 1)) {
      // Intersection
      return new Point(
        (this.a.x + r.x * t),
        (this.a.y + r.y * t)
      );
    }
    return undefined; // No intersection
  }

  // Same as intersectionPoint() but returns true or false (more efficient)
  // If the segments share end points then intersection is false.
  this.intersects = function(segment) {
    // Check for end points matching
    if (this.a.equals(segment.a) || this.a.equals(segment.b) || this.b.equals(segment.a) || this.b.equals(segment.b)) {
      return false;
    }

    let o1 = orientation(this.a, this.b, segment.a);
    let o2 = orientation(this.a, this.b, segment.b);
    let o3 = orientation(segment.a, segment.b, this.a);
    let o4 = orientation(segment.a, segment.b, this.b);
    // General Cases:
    if (o1 != o2 && o3 != o4) {
      return true;
    }

    // Special Cases:
    if (o1 == 0 && segment.a.isOnSegmentPoints(this.a, this.b)) return true;
    if (o2 == 0 && segment.b.isOnSegmentPoints(this.a, this.b)) return true;
    if (o3 == 0 && this.a.isOnSegmentPoints(segment.a, segment.b)) return true;
    if (o4 == 0 && this.b.isOnSegmentPoints(segment.a, segment.b)) return true;
    // Doesn't satisfy any cases:
    return false;
  }

  this.vector = function() {
    return new Vector(this.b.x - this.a.x, this.b.y - this.a.y);
  }
  this.line = function() {
    return new Line(this.a, this.b);
  }

  this.angle = function() {
    return Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x);
  }

  this.flip = function() {
    return new Segment(this.b, this.a);
  }

  this.equals = function(segment) {
    return (this.a.equals(segment.a) && this.b.equals(segment.b));
  }

  this.print = function() {
    return this.a.print() + " -> " + this.b.print();
  }

  this.distanceSqrd = function() {
    return this.vector().distanceSqrd();
  }

  this.distance = function() {
    return this.vector().getDistance();
  }
}

/// Unlike a segment, a line does not end at its a and b points but rather
/// passes through them to establish a direction and position. This is primarily
/// used to do line intersection checks rather than checking if two segments
/// intersect. The line version of a segment can be obtained by calling the
/// line() function on a target segment.
function Line(point1, point2) {

  this.a = point1;
  this.b = point2;

  /// Checks if the target line intersects the argument line.
  this.intersects = function(line) {
    let y1 = this.b.y - this.a.y;
    let x1 = this.b.x - this.a.x;
    let y2 = line.b.y - line.a.y;
    let x2 = line.b.x - line.a.x;

    let det = y1 * x2 - y2 * x1;
    if (det == 0) {
      return false;
    } else {
      return true;
    }
  }

  /// Checks if the target line intersects the argument line and returns
  /// the intersection point or undefined if there is no intersection.
  this.intersectionPoint = function(line) {
    let y1 = this.b.y - this.a.y; // A1
    let x1 = this.b.x - this.a.x; // B1
    let y2 = line.b.y - line.a.y; // A2
    let x2 = line.b.x - line.a.x; // B2

    let det = y1 * x2 - y2 * x1;
    if (det == 0) {
      return undefined;
    } else {
      let c1 = y1*this.a.x + x1*this.a.y;
      let c2 = y2*line.a.x + x2*line.a.y;
      let x = (x2 * c1 - x1 * c2) / det;
      let y = (y1 * c2 - y2 * c1) / det;
      return new Point(x, y);
    }
  }
}

/// A vector is a point with direction. This vector is a segment where vertex1
/// is (0,0) and vertex2 is (x,y) - which is to say it is normalized.
function Vector(x, y) {

  this.x = x;
  this.y = y;
  this.distance = undefined;
  this.angle = undefined;

  // Return quadrant 1, 2, 3, or 4
  this.quadrant = function() {
    let xC = this.x;
    if (Math.abs(xC) < 0.000001) {
      xC = 0;
    }
    let yC = this.y;
    if (Math.abs(yC) < 0.000001) {
      yC = 0;
    }
    if (xC > 0 && yC >= 0) {
      return 1;
    } else
    if (xC <= 0 && yC > 0) {
      return 2;
    } else
    if (xC < 0 && yC <= 0) {
      return 3;
    } else
    if (xC >= 0 && yC < 0) {
      return 4;
    } else
    if (xC == 0 && yC == 0) {
      return 1;
    }
    return 0;
  }

  // Returns the vector extended by the requested value
  this.extendedBy = function(extend) {
    if (!this.distance) {
      this.distance = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
    let extendedVector = new Vector(
      (this.distance + extend) * Math.cos(this.getAngle()),
      (this.distance + extend) * Math.sin(this.angle)
    );
    extendedVector.distance = this.distance + extend;
    extendedVector.angle = this.angle;
    return extendedVector;
  }

  this.isOnSegmentPoints = function(a, b) {
    if (
      this.x <= Math.max(a.x, b.x) &&
      this.x >= Math.min(a.x, b.x) &&
      this.y <= Math.max(a.y, b.y) &&
      this.y >= Math.min(a.y, b.y))
        return true;
    return false;
  }
  this.isOnSegment = function(segment) {
    return this.isOnSegmentPoints(segment.a, segment.b);
  }

  this.normalized = function() {
    if (this.distance === undefined)
      this.distance = Math.sqrt(this.x*this.x+this.y*this.y);
    if (this.distance > 0) {
      let normVec = new Vector(
        this.x/this.distance,
        this.y/this.distance
      );
      normVec.angle = this.angle;
      normVec.distance = 1;
      return normVec;
    }
  }
  this.getAngle = function() {
    if (this.angle === undefined)
      this.angle = Math.atan2(this.y, this.x);
    return this.angle;
  }
  this.getDistance = function() {
    if (this.distance === undefined)
      this.distance = Math.sqrt(this.x*this.x+this.y*this.y);
    return this.distance;
  }
  this.distanceSqrd = function() {
    return this.x*this.x+this.y*this.y;
  }

  this.print = function() {
    return "("+this.x+","+this.y+")";
  }
  this.equals = function(point) {
    return (this.x == point.x && this.y == point.y);
  }
  this.segmentFromOrigin = function(origin) {
    return new Segment(origin, new Point(origin.x + this.x, origin.y + this.y));
  }
  this.add = function(origin) {
    return new Point(origin.x + this.x, origin.y + this.y);
  }
}

function Point(x, y) {
  this.x = x;
  this.y = y;

  this.equals = function(point) {
    return (this.x == point.x && this.y == point.y);
  }
  this.isOnSegmentPoints = function(a, b) {
    if (
      this.x <= Math.max(a.x, b.x) &&
      this.x >= Math.min(a.x, b.x) &&
      this.y <= Math.max(a.y, b.y) &&
      this.y >= Math.min(a.y, b.y)) {
        return true;
    }
    return false;
  }
  this.isOnSegment = function(segment) {
    return this.isOnSegmentPoints(segment.a, segment.b);
  }
  this.minus = function(point) {
    return new Point(
      (this.x - point.x),
      (this.y - point.y)
    );
  }
  this.add = function(origin) {
    return new Point(origin.x + this.x, origin.y + this.y);
  }
  this.cross = function(point) {
    return this.x * point.y - this.y * point.x;
  }
  this.print = function() {
    return "("+parseInt(this.x)+","+parseInt(this.y)+")";
  }
}

// Convenience functions = = = = = = = = = = = = = = = = = = = = = = = = = = = =

// 0 - colinear, 1 - cw, 2 - ccw
function orientation(p, q, r) {
  let val = (q.y - p.y) * (r.x - q.x) -
            (q.x - p.x) * (r.y - q.y);
  if (val == 0) return 0;
  return (val > 0) ? 1 : 2;
}

function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y;
}

function crossProduct(a, b) {
  return a.x * b.y - a.y * b.x;
}
function subtractPoints(point1, point2) {
  let result = {};
  result.x = point1.x - point2.x;
  result.y = point1.y - point2.y;

  return result;
}
function allEqual(args) {
  let firstValue = arguments[0],
    i;
  for (i = 1; i < arguments.length; i += 1) {
    if (arguments[i] != firstValue) {
      return false;
    }
  }
  return true;
}

// Project vector a onto b
function projection(a, b) {
  let calc = dotProduct(a, b) / (b.x * b.x + b.y * b.y);
  return new Vector(b.x * calc, b.y * calc);
}

// Relative to start point (So start is 0,0)
function lineIntersectsCircle(target, center, radiusSqrd) {
  let proj = projection(center, target);
  let perp = {
    x: center.x - proj.x,
    y: center.y - proj.y
  }

  let dotProd = dotProduct(proj, target);
  if (dotProd < 0) return false;

  let distToTargetSqrd = Math.pow(target.x, 2) + Math.pow(target.y, 2);
  if (dotProd > distToTargetSqrd) return false;

  let perpDistSqrd = Math.pow(perp.x, 2) + Math.pow(perp.y, 2);
  return (perpDistSqrd < radiusSqrd);
}

function polygonContainsPoint(vertices, p) {
  if (vertices.length < 3) return undefined;

  let pInfinity = new Segment(p, new Point(99999, p.y));
  let count = 0, s = 0;

  do {
    if (segmentIntersects(
      vertices[s], vertices[(s+1)%vertices.length],
      pInfinity)
    ) {
      if (orientation(vertices[s], p, vertices[(s+1)%vertices.length]) == 0) {
        return p.isOnSegmentPoints(vertices[s], vertices[(s+1)%vertices.length]);
      }
      count += 1;
    }
    s += 1;
  } while (s != vertices.length);

  return (count%2==1);
}

function segmentIntersects(a, b, segment) {
  let o1 = orientation(a, b, segment.a);
  let o2 = orientation(a, b, segment.b);
  let o3 = orientation(segment.a, segment.b, a);
  let o4 = orientation(segment.a, segment.b, b);
  // General Cases:
  if (o1 != o2 && o3 != o4) {
    return true;
  }
  // Special Cases:
  if (o1 == 0 && segment.a.isOnSegmentPoints(a, b)) return true;
  if (o2 == 0 && segment.b.isOnSegmentPoints(a, b)) return true;
  if (o3 == 0 && a.isOnSegmentPoints(segment.a, segment.b)) return true;
  if (o4 == 0 && b.isOnSegmentPoints(segment.a, segment.b)) return true;
  // Doesn't satisfy any cases:
  return false;
}

/// Extrude polygon vertices. An approximation of padding or "stroking" a
/// polygon.
function extrudeVertices(vertices, extrude) {
  // return vertices;
  let extrudedVertices = [];
  for (let v = 0; v < vertices.length; v++) {
    // Current vertex
    let cV = vertices[v];
    // Next Vertex
    let nV = vertices[(v+1)%vertices.length];
    // Previous Vertex
    let pV = vertices[(v-1) < 0 ? (vertices.length+(v-1)) : (v-1)];
    // Vectors from current vertex out to previous and next vertex.
    let nVec = (new Vector(nV.x - cV.x, cV.y - nV.y)).normalized();
    let pVec = (new Vector(pV.x - cV.x, cV.y - pV.y)).normalized();
    // Calculate angle between vectors u and v.
    let angle = 2*Math.PI - Math.acos(dotProduct(nVec, pVec));
    let angleBetween = angle/2 + nVec.getAngle();
    // Extend a point out from current vertex.
    extrudedVertices.push(
      new Point(
        cV.x + extrude * Math.cos(angleBetween),
        cV.y - extrude * Math.sin(angleBetween)
      )
    );
  }
  return extrudedVertices;
}

function closestPointAroundVertices(vertices, start, vGoal, destination) {
  // ===== Shortest route around visible vertices
  let farthestVertexAbove = {
    vertex: undefined,
    distanceSqrd: undefined,
    quadrant: undefined
  };
  let farthestVertexBelow = {
    vertex: undefined,
    distanceSqrd: undefined
  };
  vertices.forEach(function(vertex) {
    print("            Visible: " + vertex.print(), [new Segment(start, vertex)]);
    // This vertex is visible from start point. Establish if its above or below target line.
    // Project the segment from start to vertex onto the target line.
    let a = new Vector(vertex.x - start.x, vertex.y - start.y);
    let proj = projection(a, vGoal);
    // Get perpendicular line out from target line at projection point.
    let perp = new Vector(
      vertex.x - (start.x + proj.x),
      vertex.y - (start.y + proj.y)
    );
    // Squared distance of this line.
    let perpDistSqrd = Math.pow(perp.x, 2) + Math.pow(perp.y, 2);
    // Find furthest above and below
    if (!farthestVertexAbove.quadrant || farthestVertexAbove.quadrant == perp.quadrant()) {
      farthestVertexAbove.quadrant = perp.quadrant();
      if (!farthestVertexAbove.distanceSqrd || perpDistSqrd > farthestVertexAbove.distanceSqrd) {
        farthestVertexAbove.vertex = vertex;
        farthestVertexAbove.distanceSqrd = perpDistSqrd;
      }
    } else if (!farthestVertexBelow.distanceSqrd || perpDistSqrd > farthestVertexBelow.distanceSqrd) {
      farthestVertexBelow.vertex = vertex;
      farthestVertexBelow.distanceSqrd = perpDistSqrd;
    }
  });
  // Determine if should go above or below object. Compares the distance (sqrd)
  // from the start to the vertex and then to the target. Uses 4 square root calculations :(
    let towards = undefined;
  if (farthestVertexBelow.vertex) {
    print("        Decide to go A"+farthestVertexAbove.vertex.print()+" or B"+farthestVertexBelow.vertex.print(), [new Segment(start, farthestVertexAbove.vertex), new Segment(start, farthestVertexBelow.vertex)]);
    let distAbove = new Segment(start, farthestVertexAbove.vertex).distance() + new Segment(farthestVertexAbove.vertex, start.add(vGoal)).distance();
    let distBelow = new Segment(start, farthestVertexBelow.vertex).distance() + new Segment(farthestVertexBelow.vertex, start.add(vGoal)).distance();
    towards = distAbove < distBelow ? farthestVertexAbove : farthestVertexBelow;
  } else {
    towards = farthestVertexAbove;
  }
  return towards.vertex;
}
