// Use the following:
// import { Segment, Line, Ray, Vector, Polygon, Point } from './Layout2D/Geometry.js'

/// A segment is composed of 2 vertices.
export class Segment {
  constructor(vertex1, vertex2) {
    if (vertex1 == undefined || vertex2 == undefined) {
      throw "Passed in undefined segment vertex?"
    }
    this._a = vertex1;
    this._b = vertex2;
    this._distance = undefined
  }

  a(point) {
    if (point === undefined) return this._a
    this._distance = undefined
    this._a = point
  }

  b(point) {
    if (point === undefined) return this._b
    this._distance = undefined
    this._b = point
  }

  // https://www.codeproject.com/Tips/862988/Find-the-Intersection-Point-of-Two-Line-Segments
  // Returns a point or undefined where the two segments intersect. If only need
  // true of false if two segments intersect, use intersects(). Will return undefined
  // if end points match
  intersectionPoint(segment) {
    if (segment instanceof Ray) {
      segment = new Segment(segment.origin, new Point(999999 * Math.cos(segment.angle) + segment.origin.x, 999999 * Math.sin(segment.angle) + segment.origin.y))
    }

    // Check for end points matching
    if (this._a.equals(segment._a) || this._a.equals(segment._b) || this._b.equals(segment._a) || this._b.equals(segment._b)) {
      return undefined;
    }
    let r = this._b.minus(this._a);
    let s = segment._b.minus(segment._a);
    let rxs = r.cross(s);
    let qpxr = (segment._a.minus(this._a)).cross(r);

    if (rxs == 0 && qpxr == 0) {
      return undefined; // collinear segments. ignoring.
    }
    if (rxs == 0 && qpxr != 0) {
      return undefined; // parallel
    }

    let t = (segment._a.minus(this._a)).cross(s) / rxs;
    let u = (segment._a.minus(this._a)).cross(r) / rxs;

    if (rxs != 0 && (0 <= t && t <= 1) && (0 <= u && u <= 1)) {
      // Intersection
      return new Point(
        (this._a.x + r.x * t),
        (this._a.y + r.y * t)
      );
    }
    return undefined; // No intersection
  }

  // Same as intersectionPoint() but returns true or false (more efficient)
  // If the segments share end points then intersection is false.
  intersects(segment) {
    if (segment instanceof Ray)
      segment = new Segment(segment.origin, new Point(999999 * Math.cos(segment.angle) + segment.origin.x, 999999 * Math.sin(segment.angle) + segment.origin.y))

    let o1 = orientation(this._a, this._b, segment._a);
    let o2 = orientation(this._a, this._b, segment._b);
    let o3 = orientation(segment._a, segment._b, this._a);
    let o4 = orientation(segment._a, segment._b, this._b);
    // General Cases:
    if (o1 != o2 && o3 != o4) return true

    // Special Cases:
    if (o1 == ORIENTATION.COLLINEAR && segment._a.isOnSegment(this)) return true;
    if (o2 == ORIENTATION.COLLINEAR && segment._b.isOnSegment(this)) return true;
    if (o3 == ORIENTATION.COLLINEAR && this._a.isOnSegment(segment)) return true;
    if (o4 == ORIENTATION.COLLINEAR && this._b.isOnSegment(segment)) return true;
    // Doesn't satisfy any cases:
    return false;
  }

  vector() {
    return new Vector(this._b.x - this._a.x, this._b.y - this._a.y);
  }
  line() {
    return new Line(this._a, this._b);
  }

  angle() {
    return Math.atan2(this._b.y - this._a.y, this._b.x - this._a.x);
  }

  flip() {
    return new Segment(this._b, this._a);
  }

  equals(segment) {
    return (this._a.equals(segment._a) && this._b.equals(segment._b));
  }

  logString() {
    return this._a.logString() + " -> " + this._b.logString();
  }

  distanceSqrd() {
    if (this._distance !== undefined) return Math.pow(this._distance, 2)
    return this.vector().magnitudeSqrd();
  }

  distance() {
    if (this._distance !== undefined) return this._distance
    this._distance = this.vector().magnitude();
    return this._distance
  }

  midpoint() {
    let dX = this._b.x - this._a.x
    let dY = this._b.y - this._a.y
    return new Point(this._a.x + dX/2, this._a.y + dY/2)
  }

  closestPointOnSegmentTo(point) {
    let aToPoint = new Segment(this._a, point)
    let proj = aToPoint.vector().projection(this.vector())
    // Check if closer to segments endpoints
    if (proj.quadrant() != this.vector().quadrant()) return this._a
    if (this.distanceSqrd() < proj.magnitudeSqrd()) return this._b
    return this._a.add(proj.asPoint())
  }

  static distanceSqrd(a, b) {
    return new Segment(a, b).distanceSqrd()
  }
  static distance(a, b) {
    return new Segment(a, b).distance()
  }
}

/// Unlike a segment, a line does not end at its a and b points - it passes through them.
/// This is primarily used for line intersection checks (versus bounded segment checks).
/// Create a line from a segment using the line() function on a segment object.
export class Line {
  constructor(point1, point2) {
    this.a = point1;
    this.b = point2;
  }

  /// Checks if the target line intersects the argument line.
  intersects(line) {
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
  intersectionPoint(line) {
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

/**
 * A segment that extends infinitely in one direction - or a vector with infinite magnitude.
 *
 * @param Point origin The starting point of the ray. Origin will default to (0, 0) if omitted.
 * @param Number direction The angle, in degrees, in which the ray extends. This value can
 * also be passed in as a Vector which will use the vector's angle as the direction.
 */
export class Ray {
  constructor(origin, direction) {
    if (origin.constructor.name == "Point") {
      this.origin = origin
      if (Number.isInteger(direction)) this.angle = Math.PI / 180 * direction
      else
      if (direction.constructor.name == "Vector") this.angle = direction.angle()
    }
    else if (direction === undefined) {
      this.origin = new Point(0, 0)
      if (Number.isInteger(origin)) this.angle = Math.PI / 180 * origin
      else
      if (origin.constructor.name == "Vector") this.angle = origin.angle()
      else
      throw "Invalid ray construction parameters."
    }
  }

  logString() {
    return `From ${this.origin.logString()} towards ${this.angle}`
  }
}

/// A vector is a point with a direction. This vector is a segment where vertex1
/// is (0,0) and vertex2 is (x,y). Components/magnitude/angle properties are cached.
export class Vector {
  constructor(x, y) {
    this._x = x
    this._y = y
    this._magnitude = undefined
    this._angle = undefined
  }

  /// Getter if 'val' is not provided, setter if 'val' is provided
  x(val) {
    if (val !== undefined && val != this._x) {
      if (this._y === undefined) throw `Cannot set a vector's x component when its y component is undefined (in magnitude/angle mode). Create new vector.`
      this._magnitude = undefined
      this._angle = undefined
      this._x = val
    }
    if (this._x === undefined) this._x = this.magnitude() * Math.cos(this.angle())
    if (Number.isNaN(this._x)) throw `x component is NaN for V:${this.logString()}`
    return this._x
  }
  /// Getter if 'val' is not provided, setter if 'val' is provided
  y(val) {
    if (val !== undefined && val != this._y) {
      if (this._x === undefined) throw `Cannot set a vector's y component when its x component is undefined (in magnitude/angle mode). Create new vector.`
      this._magnitude = undefined
      this._angle = undefined
      this._y = val
    }
    if (this._y === undefined) this._y = this.magnitude() * Math.sin(this.angle())
    if (Number.isNaN(this._y)) throw `x component is NaN for V:${this.logString()}`
    return this._y
  }
  /// Getter if 'val' is not provided, setter if 'val' is provided
  magnitude(val) {
    if (val !== undefined && val !== this._magnitude) {
      if (this._magnitude > 0 && this._x !== undefined && this._y !== undefined) {
        if (this._angle === undefined && val == 0) this.angle()
        this._x *= val / this._magnitude
        this._y *= val / this._magnitude
      } else {
        this.angle()
        this._x = undefined
        this._y = undefined
      }
      this._magnitude = val
    }
    if (this._magnitude === undefined) {
      if (this._x === undefined) throw `x component and magnitude are undefined for V:${this.logString()}`
      if (this._y === undefined) throw `y component and magnitude are undefined for V:${this.logString()}`
      this._magnitude = Math.sqrt(Math.pow(this.x(), 2) + Math.pow(this.y(), 2))
    }
    if (Number.isNaN(this._magnitude)) throw `magnitude is NaN for V:${this.logString()}`
    return this._magnitude
  }
  /// Getter if 'val' is not provided, setter if 'val' is provided
  angle(val) {
    if (val !== undefined && val != this._angle) {
      this.magnitude()
      this._x = undefined
      this._y = undefined
      this._angle = val
    }
    if (this._angle === undefined) {
      if (this.x() == 0 && this.y() == 0) {
        this._angle = 0
      } else {
        this._angle = Math.atan2(this.y(), this.x())
      }
    }
    if (Number.isNaN(this._angle)) throw `angle is NaN for V:${this.logString()}`
    return this._angle
  }

  multipliedBy(mult) {
    if (this._magnitude !== undefined && this._angle !== undefined) {
      let vec = new Vector(this._x, this._y)
      vec.magnitude(this.magnitude() * mult)
      vec.angle(this.angle())
      return vec
    } else {
      let vec = new Vector(this.x() * mult, this.y() * mult);
      if (this._magnitude !== undefined) vec._magnitude = this.magnitude() * mult
      if (this._angle !== undefined) vec.angle(this.angle())
      return vec
    }
  }
  /// Modifies target vector
  plus(vec) {
    return new Vector(vec.x() + this.x(), vec.y() + this.y())
  }
  /// Does not modify target vector
  flipped() {
    let newVec = new Vector()
    if (this._magnitude !== undefined) newVec._magnitude = this._magnitude
    if (this._x !== undefined) newVec._x = -this._x
    if (this._y !== undefined) newVec._y = -this._y
    if (this._angle !== undefined) newVec._angle = boundAngle(this._angle + Math.PI)
    return newVec
  }
  /// Modifies target vector
  flip() {
    if (this._angle !== undefined) this._angle = boundAngle(this._angle + Math.PI)
    if (this._x !== undefined) this._x = -this._x
    if (this._y !== undefined) this._y = -this._y
    return this
  }
  /// Modifies target vector
  minus(vec) {
    return this.plus(vec.flipped())
  }
  magnitudeSqrd() {
    if (this._magnitude !== undefined) return this._magnitude * this._magnitude
    return this.x() * this.x() + this.y() * this.y()
  }
  logString() {
    return `(${this._x}, ${this._y}) D:${this._magnitude} A:${(this._angle === undefined) ? undefined : this._angle / Math.PI * 180}`
  }
  // Return quadrant 1, 2, 3, or 4
  quadrant() {
    if (this.x() >= 0 && this.y() >= 0) return 1
    if (this.x() >= 0 && this.y() < 0) return 2
    if (this.x() < 0 && this.y() < 0) return 3
    if (this.x() < 0 && this.y() >= 0) return 4
    return 0;
  }
  asPoint() {
    return new Point(this.x(), this.y())
  }
  normalized() {
    this.magnitude(1)
    return this
  }
  // this.equals = function (point) {
  //   return (this.x == point.x && this.y == point.y);
  // };
  // this.segmentFromOrigin = function (origin) {
  //   return new Segment(origin, new Point(origin.x + this.x, origin.y + this.y));
  // };
  // this.add = function(origin) {
  //   return new Point(origin.x + this.x, origin.y + this.y);
  // }
  extendBy(magnitude) {
    this.magnitude(this.magnitude() + magnitude)
    return this
  }

  extendedBy(magnitude) {
    return new Vector(this.x(), this.y()).extendBy(magnitude)
  }

  dotProduct(peer) {
    return this.x() * peer.x() + this.y() * peer.y();
  }

  crossProduct(peer) {
    return this.x() * peer.y() - this.y() * peer.x();
  }

  projection(peer) {
    let calc = this.dotProduct(peer) / (peer.x() * peer.x() + peer.y() * peer.y());
    return new Vector(peer.x() * calc, peer.y() * calc);
  }

  intersectsCircle(center, radiusSqrd) {
    center = new Vector(center.x(), center.y())
    let proj = center.projection(this)
    let perp = center.minus(proj)
    let dotProd = proj.dotProduct(target);

    if (dotProd < 0) return false;
    if (dotProd > this.magnitudeSqrd()) return false;

    return (perp.magnitudeSqrd() < radiusSqrd);
  }
}

export class Polygon {
  constructor(vertices, holes) {
    this.vertices = [...vertices]

    // Calculate center
    let center = {x: 0, y: 0}
    vertices.forEach(vertex => center = {x: center.x + vertex.x, y: center.y + vertex.y})
    this.circumcenter = new Point(center.x / vertices.length, center.y / vertices.length);

    // Calculate circumcircle (smallest bound circle)
    let vertexDistanceSqrd = Math.pow(this.circumcenter.x - vertices[0].x, 2) + Math.pow(this.circumcenter.y - vertices[0].y, 2)
    for (let x = 1; x < vertices.length; x++) {
      let distSqrd = Math.pow(this.circumcenter.x - vertices[x].x, 2) + Math.pow(this.circumcenter.y - vertices[x].y, 2)
      if (distSqrd > vertexDistanceSqrd) vertexDistanceSqrd = distSqrd
    }
    this.circumradius = Math.sqrt(vertexDistanceSqrd)

    // Counterclockwise check
    let averageSlope = 0
    for (let i = 0; i < vertices.length; i++) {
      let v = vertices[i]
      let vNext = vertices[(i + 1) % vertices.length]
      averageSlope += (vNext.x - v.x) * (vNext.y + v.y)
    }
    this.counterclockwise = (averageSlope > 0)

    // Reference to hole polygons relative to this polygon
    this.holes = (holes === undefined) ? [] : holes
  }

  generateEdges() {
    for (let i = 0; i < this.vertices.length; i++) {
      let vPrev = this.vertices[(i - 1) < 0 ? this.vertices.length - 1 : (i - 1)]
      let v = this.vertices[i]
      let vNext = this.vertices[(i + 1) % this.vertices.length]

      let edge0 = new Segment(v, vNext)
      edge0.parent = triangle
      let edge1 = new Segment(vNext, vPrev)
      edge1.parent = triangle
      let edge2 = new Segment(vPrev, v)
      edge2.parent = triangle

      triangle.edges = [edge0, edge1, edge2]
    }
  }

  edges() {
    let edges = []
    this.vertices.forEach((vertex, v) => edges.push(new Segment(vertex, this.vertices[(v + 1) % this.vertices.length])))
    return edges
  }

  containsPoint(p) {
    if (this.vertices.length < 3) return false;

    let pInfinity = new Segment(p, new Point(p.x + 999999, p.y));
    let count = 0;
    // let firstEdgeOrientation = undefined

    for (let i = 0; i < this.vertices.length; i++) {
      let vPrev = this.vertices[(i - 1) < 0 ? this.vertices.length - 1 : i - 1]
      let v = this.vertices[i]
      let vNext = this.vertices[(i + 1) % this.vertices.length]

      let edge = new Segment(v, vNext)
      if (p.equals(edge.a()) || p.equals(edge.b())) return false

      if (orientation(edge.a(), p, edge.b()) == ORIENTATION.COLLINEAR) {
        if (p.isOnSegment(edge)) return false
      }

      if (edge.intersects(pInfinity)) {

        if (orientation(p, edge.a(), pInfinity.b()) == ORIENTATION.COLLINEAR) {
          if (edge.a().isOnSegment(pInfinity)) {
            if (orientation(v, p, vNext) !== orientation(vPrev, p, v)) continue
          }
        }
        if (orientation(p, edge.b(), pInfinity.b()) == ORIENTATION.COLLINEAR) {
          if (edge.b().isOnSegment(pInfinity)) continue
        }

        count += 1;
      }
    }

    if (count % 2 == 0 && this.counterclockwise) return true
    if (count % 2 == 1 && !this.counterclockwise) return true
    return false
  }

  contains(peer) {
    for (let v = 0; v < peer.vertices.length; v++) {
      if (!this.containsPoint(peer.vertices[v])) return false
    }
    return true
  }

  /**
   * Test if polygon is pierced by the given segment or ray. Will return a hash with various
   * data about the pierce location.
   */
  pierce(segment) {
    if (segment instanceof Ray) {
      segment = new Segment(segment.origin, new Point(999999 * Math.cos(segment.angle) + segment.origin.x, 999999 * Math.sin(segment.angle) + segment.origin.y))
    }
    let nearestIntersectingSide = {
      side: undefined,
      distanceSqrd: undefined,
      point: undefined
    };

    this.edges().forEach(edge => {
      let intersection = segment.intersectionPoint(edge);
      if (intersection) {
        let distSqrd = Math.pow(intersection.y - segment.a.y, 2) + Math.pow(intersection.x - segment.a.x, 2);
        // segmentsIntersect returning undefined indicates they don't intersect.
        if (!nearestIntersectingSide.side || distSqrd < nearestIntersectingSide.distanceSqrd) {
          nearestIntersectingSide.side = edge;
          nearestIntersectingSide.distanceSqrd = distSqrd;
          nearestIntersectingSide.point = intersection;
        }
      }
    });

    // Can return undefined or a segment object
    return nearestIntersectingSide;
  };

  overlaps(peer) {
    let distToPeer = Math.sqrt(Math.pow(peer.circumcenter.y - this.circumcenter.y, 2) + Math.pow(peer.circumcenter.x - this.circumcenter.x, 2))
    if (distToPeer >= this.circumradius + peer.circumradius) return false

    // Check edge overlaps
    for (let tV = 0; tV < this.vertices.length; tV++) {
      let thisSide = new Segment(this.vertices[tV], this.vertices[(tV+1)%this.vertices.length]);
      for (let pV = 0; pV < peer.vertices.length; pV++) {
        let peerSide = new Segment(peer.vertices[pV], peer.vertices[(pV+1)%peer.vertices.length]);

        let intersectionPoint = thisSide.intersectionPoint(peerSide);
        if (intersectionPoint === undefined) continue

        return true
      }
    }

    return false
  }

  /**
   * Joins two overlapping polygons together. Does not affect either polygons,
   * the new polygon union will be returned or undefined if they don't overlap.
   */
  union(peer) {
    let thisVertices = [...this.vertices]
    let peerVertices = [...peer.vertices]

    let outerNodes = []
    // Find outer vertices
    thisVertices.forEach(thisVertex => {
      if (!peer.containsPoint(thisVertex)) {
        for (let iOuterNode = 0; iOuterNode < outerNodes.length; iOuterNode++) {
          if (outerNodes[iOuterNode].vertex.equals(thisVertex)) {
            thisVertex.link = outerNodes[iOuterNode].vertex
            outerNodes[iOuterNode].vertex.link = thisVertex
            outerNodes.splice(iOuterNode, 1)
            return
          }
        }
        outerNodes.push({vertex: thisVertex, visited: false})
      }
    }) // Check if vertex is contained in peer
    peerVertices.forEach(peerVertex => {
      if (!this.containsPoint(peerVertex)) {
        for (let iOuterNode = 0; iOuterNode < outerNodes.length; iOuterNode++) {
          if (outerNodes[iOuterNode].vertex.equals(peerVertex)) {
            peerVertex.link = outerNodes[iOuterNode].vertex
            outerNodes[iOuterNode].vertex.link = peerVertex
            outerNodes.splice(iOuterNode, 1)
            return
          }
        }
        outerNodes.push({vertex: peerVertex, visited: false})
      }
    }) // Check if vertex is contained in this

    // Link intersection points
    let intersectionPointFound = false
    for (let tV = 0; tV < thisVertices.length; tV++) {
      let thisSide = new Segment(thisVertices[tV], thisVertices[(tV+1)%thisVertices.length]);
      for (let pV = 0; pV < peerVertices.length; pV++) {
        let peerSide = new Segment(peerVertices[pV], peerVertices[(pV+1)%peerVertices.length]);

        let intersectionPointThis = thisSide.intersectionPoint(peerSide);
        if (intersectionPointThis === undefined) continue
        let intersectionPointPeer = new Point(intersectionPointThis.x, intersectionPointThis.y)

        if (intersectionPointThis.equals(thisSide.a())) {
          intersectionPointThis = thisSide.a()
        } else if (intersectionPointThis.equals(thisSide.b())) {
          intersectionPointThis = thisSide.b()
        } else {
          thisVertices.splice(tV + 1, 0, intersectionPointThis)
        }

        if (intersectionPointPeer.equals(peerSide.a())) {
          intersectionPointPeer = peerSide.a()
        } else if (intersectionPointPeer.equals(peerSide.b())) {
          intersectionPointPeer = peerSide.b()
        } else {
          peerVertices.splice(pV + 1, 0, intersectionPointPeer)
        }

        intersectionPointThis.link = intersectionPointPeer
        intersectionPointPeer.link = intersectionPointThis

        intersectionPointFound = true
        tV -= 1
        break
      }
    }

    if (!intersectionPointFound) return undefined

    let newPolygons = []
    // Walk through outer vertices to form polygons
    for (let n = 0; n < outerNodes.length; n++) {
      let outerNode = outerNodes[n]
      if (outerNode.visited) continue

      let index = peerVertices.indexOf(outerNode.vertex)
      const START_VERTICES = (index == -1) ? thisVertices : peerVertices
      const START_VERTEX = (index == -1) ? thisVertices.indexOf(outerNode.vertex) : index

      let currentVertices = START_VERTICES
      let currentVertex = START_VERTEX
      let verticesBuilder = []
      let vertex = currentVertices[currentVertex]
      do {
        if (vertex.link !== undefined) {
          outerNodes.forEach(node => {if (node.vertex === vertex) node.visited = true})
          currentVertices = (currentVertices == peerVertices) ? thisVertices : peerVertices
          currentVertex = currentVertices.indexOf(vertex.link)
          vertex.link = undefined
          vertex = currentVertices[currentVertex]
          vertex.link = undefined
        }
        outerNodes.forEach(node => {if (node.vertex === vertex) node.visited = true})
        verticesBuilder.push(vertex)

        currentVertex = (currentVertex + 1) % currentVertices.length
        vertex = currentVertices[currentVertex]
      } while (START_VERTICES[START_VERTEX] !== currentVertices[currentVertex])

      newPolygons.push(new Polygon(verticesBuilder))
    }

    if (newPolygons.length == 0) return undefined
    let convexHullIndex = 0

    // Multiple polygons indicate a polygon with holes
    for (let t = 0; t < newPolygons.length; t++) {
      let thisPolygon = newPolygons[t]

      // Remove collinear vertices
      for (let i = 0; i < thisPolygon.vertices.length; i++) {
        let vPrev = thisPolygon.vertices[((i - 1) < 0) ? (thisPolygon.vertices.length - 1) : (i - 1)]
        let v = thisPolygon.vertices[i]
        let vNext = thisPolygon.vertices[(i + 1) % thisPolygon.vertices.length]

        if (orientation(vPrev, v, vNext) == ORIENTATION.COLLINEAR) {
          thisPolygon.vertices.splice(i, 1)
          i -= 1
        }
      }

      // Find convex hull polygon
      if (!thisPolygon.counterclockwise) convexHullIndex = t
    }

    let convexHullPolygon = newPolygons.splice(convexHullIndex, 1)[0]
    convexHullPolygon.holes = newPolygons.concat(this.holes).concat(peer.holes)

    return convexHullPolygon
  }

  // TODO: Fails edge cases.
  closestPointOutsideFrom(point) {
    if (!this.containsPoint(point)) return point
    // Find closest point outside of polygon
    let closest = { distSqrd: undefined, point: undefined }
    this.edges().forEach(edge => {
      let closestPoint = edge.closestPointOnSegmentTo(point)
      let closestPointDistSqrd = new Segment(point, closestPoint).distanceSqrd()
      if (closest.distSqrd === undefined || closestPointDistSqrd < closest.distSqrd ) {
        closest.distSqrd = closestPointDistSqrd
        closest.point = closestPoint
      }
    });
    // Extend out result by 1 unit to avoid rounding errors
    return closest.point // new Segment(point, closest.point).vector().extendBy(1).asPoint().add(point)
  }
}

export class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    this.equals = function(point) {
      return (this.x == point.x && this.y == point.y);
    }
    this.isOnSegmentPoints = function(a, b) {
      if (!(a instanceof Point) || !(b instanceof Point)) throw "Non-Point objects passed"
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
      return this.isOnSegmentPoints(segment.a(), segment.b());
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
    this.logString = () => {
      return "("+parseInt(this.x)+","+parseInt(this.y)+")";
    }
  }
}

var ORIENTATION = {
  COLLINEAR: 0,
  CW: 1,
  CCW: 2
}

/**
 * Returns orientation of ordered triplet.
 *
 * @returns  0 - collinear, 1 - cw, 2 - ccw
 */
export function orientation(p1, p2, p3) {
  let val = (p2.y - p1.y) * (p3.x - p2.x) -
            (p2.x - p1.x) * (p3.y - p2.y);
  if (val == 0) return ORIENTATION.COLLINEAR;
  return (val > 0) ? ORIENTATION.CW : ORIENTATION.CCW
}

/**
 * Extrude polygon vertices. An approximation of padding or "stroking" a polygon.
 */
export function extrudeVertices(vertices, extrude) {
  // return vertices;
  let extrudedVertices = [];
  for (let v = 0; v < vertices.length; v++) {
    let cV = vertices[v];
    let nV = vertices[(v+1)%vertices.length];
    let pV = vertices[(v-1) < 0 ? (vertices.length+(v-1)) : (v-1)];
    // Vectors from current vertex out to previous and next vertex.
    let pVec = (new Vector(pV.x - cV.x, cV.y - pV.y)).normalized();
    let nVec = (new Vector(nV.x - cV.x, cV.y - nV.y)).normalized();
    let angle = Math.acos(pVec.dotProduct(nVec))
    let cross = pVec.crossProduct(nVec)
    if (cross > 0) angle = 2*Math.PI - angle
    let angleBetween = angle/2 + nVec.angle();

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

export function closestPointAroundVertices(vertices, start, vGoal, destination) {
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
  vertices.forEach(vertex => {
    // This vertex is visible from start point. Establish if its above or below target line.
    // Project the segment from start to vertex onto the target line.
    let a = new Vector(vertex.x - start.x, vertex.y - start.y);
    let proj = a.projection(vGoal);
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
    let distAbove = new Segment(start, farthestVertexAbove.vertex).magnitude() + new Segment(farthestVertexAbove.vertex, start.add(vGoal)).magnitude();
    let distBelow = new Segment(start, farthestVertexBelow.vertex).magnitude() + new Segment(farthestVertexBelow.vertex, start.add(vGoal)).magnitude();
    towards = distAbove < distBelow ? farthestVertexAbove : farthestVertexBelow;
  } else {
    towards = farthestVertexAbove;
  }
  return towards.vertex;
}

export function boundAngle(angle) {
  let newAngle = angle;
  while (newAngle < 0) {
    newAngle += 2 * Math.PI;
  }
  while (newAngle > 2 * Math.PI) {
     newAngle -= 2 * Math.PI;
   }
  return newAngle;
}
