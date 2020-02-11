
// Wisps will try to move around Blockers in its path
// A Blocker is formed by an array of vertices that form a concave or convex shape
/**
 * Blocker formed by array of vertices that pathGen will use to create routes avoiding 
 * these objects. 
 * @param vertices - Array of points that make up a blocker. Should be create in a clockwise order.
 * @param holes - For now, this is an array of point arrays. Will be changed in the future. Primarly used
 * for drawing inaccessible areas.
 * @param conjoined - if this blocker is being created as a conjoinment of blockers, set this to true.
 * @param conjoinedVertices - if this blocker is a conjoined blocker, pass in array of vertex arrays that formed it here.
 */
class Blocker {
	constructor(vertices, holes = [], conjoined = false, conjoinedVertices = []) {

		// TODO: Test if any edges overlap here in blocker creation. This means the blocker is invalid.

		// Perserive original vertices for visuals but calculations are run on preprocessed blocker
		if (conjoined) {
			// Blocker.rawVertices.push(vertices);
			this.conjoinedVertices = conjoinedVertices;
		} else {
			this.conjoinedVertices = [vertices];
		}

		// Calculate center position
		let centerX = 0;
		let centerY = 0;
		for (let x = 0; x < vertices.length; x++) {
			centerX += vertices[x].x;
			centerY += vertices[x].y;
		}
		centerX /= vertices.length;
		centerY /= vertices.length;
		this.center = new Point(centerX, centerY);

		// Enlarge blocker by the radius of the pather/wisp
		const EXTRUSION_AMOUNT = 10;
		if (!conjoined)
			this.vertices = extrudeVertices(vertices, EXTRUSION_AMOUNT);
		else
			this.vertices = vertices;

		// Creates edges from vertex information
		this.sides = [];
		for (let v = 0; v < this.vertices.length; v++) {
			this.sides.push(
				new Segment(this.vertices[v], this.vertices[(v+1)%this.vertices.length])
			);
		}

		// Calculate circle collider
		let indexDistanceSqrd = Math.pow(centerX - this.vertices[0].x, 2) + Math.pow(centerY - this.vertices[0].y, 2)
		for (let x = 1; x < vertices.length; x++) {
			let distSqrd = Math.pow(centerX - this.vertices[x].x, 2) + Math.pow(centerY - this.vertices[x].y, 2)
			if (distSqrd > indexDistanceSqrd) {
				indexDistanceSqrd = distSqrd;
			}
		}
		// Radius of a circle encompassing every vertex of shape
		this.colliderRadiusSqrd = indexDistanceSqrd;
		this.colliderRadius = Math.sqrt(indexDistanceSqrd);

		// Perform conjoins for overlapping polygons
		// ==========================================
		// Check this polygon against other polygons for overlap - first colliderRadiusSqrd distance check.
		for (let b = 0; b < Blocker.blockers.length; b++) {
			let peer = Blocker.blockers[b];
			let distToPeerSqrd =
				Math.pow(peer.center.y - this.center.y, 2) +
				Math.pow(peer.center.x - this.center.x, 2);
			if (distToPeerSqrd < peer.colliderRadiusSqrd + this.colliderRadiusSqrd) {
				if (this.conjoin(peer)) return;
			}
		}

		// Hole polygons
		this.holes = [];
		for (let h = 0; h < holes.length; h++) {
			this.holes.push({vertices: []});
			for (let v = 0; v < holes[h].length; v++) {
				this.holes[h].vertices.push(holes[h][v]);
			}
		}

		// This is skipped if a conjoin was possible and executed.
		Blocker.blockers.push(this);
  };

	// TODO: The following does not work when conjoining polygons with holes.
	// Will verify that the target and parameter blocker overlap, and if so,
	// conjoin them. Probably only called from a blocker's contructor.
	conjoin(peer) {

		// Get outer vertices
		let outerVertices = []
		for (let ts = 0; ts < this.sides.length; ts++) {
			let thisSide = this.sides[ts];
			if (!peer.containsPoint(thisSide.a)) {
				outerVertices.push({vertex: thisSide.a, visited: false});
			} // Check if vertex is contained in peer
		}
		for (let ps = 0; ps < peer.sides.length; ps++) {
			let peerSide = peer.sides[ps];
			if (!this.containsPoint(peerSide.a)) {
				outerVertices.push({vertex: peerSide.a, visited: false});
			} // Check if vertex is contained in this
		}

		// Test each side of this blocker against peer's sides.
		let ips = false; // Intersection Points
		for (let ts = 0; ts < this.vertices.length; ts++) {
			let thisSide = new Segment(this.vertices[ts], this.vertices[(ts+1)%this.vertices.length]);
			for (let ps = 0; ps < peer.vertices.length; ps++) {
				let peerSide = new Segment(peer.vertices[ps], peer.vertices[(ps+1)%peer.vertices.length]);
				let ipThis = thisSide.intersectionPoint(peerSide);
				if (ipThis !== undefined) {
					if ( // Ensure the IP is not one of the endpoints of the edge.
						ipThis.equals(thisSide.a) ||
						ipThis.equals(thisSide.b)
					) continue;

					let ipPeer = Object.assign({}, ipThis);
					// Insert intersection points into polygons.

					if (ts+1 == this.vertices.length) this.vertices.push(ipThis);
					else this.vertices.splice(ts+1, 0, ipThis);
					this.vertices[ts+1].link = ipPeer; // connect to peer object

					if (ps+1 == peer.vertices.length) peer.vertices.push(ipPeer);
					else peer.vertices.splice(ps+1, 0, ipPeer);
					peer.vertices[ps+1].link = ipThis; // connect to this object

					ips = true;
					ts -= 1; // Reload this edge segment with the new endpoint.
					break;
				}
			}
			// Link any overlapping end points together.
			// let overlappingVertex = peer.hasVertex(this.vertices[ts]);
			// if (overlappingVertex != -1) {
			// 	this.vertices[ts].link = Object.assign({}, peer.vertices[overlappingVertex]);
			// 	peer.vertices[overlappingVertex].link = Object.assign({}, this.vertices[ts]);
			// }
		}

		if (!ips) { // No intersection points
			return false; // No conjoin necessary
			// But one shape could contain another. Test that!
			// TODO: Test if shape contains another
		} else {
			// Remove peer and don't finish adding this object to blockers array
			Blocker.blockers.splice(Blocker.blockers.indexOf(peer), 1);
		}

		print("Forming new polygon(s).", [this, peer]);
		// Form new polygon(s) - More than one indicates there are holes.
		let newPolygons = [];
		for (let v = 0; v < outerVertices.length; v++) {
			print("    Visiting vertex " + outerVertices[v].vertex.print(), [outerVertices[v].vertex]);
			if (outerVertices[v].visited)  {
				print("        Already visited.");
				continue;
			}
			let creatingPolygon = [];
			outerVertices[v].visited = true;
			let index = peer.vertices.indexOf(outerVertices[v].vertex);
			const START_BLOCKER = (index == -1)?this:peer;
			const START_VERTEX  = (index == -1)?this.vertices.indexOf(outerVertices[v].vertex):index;
			let currentBlocker  = START_BLOCKER;
			let currentVertex   = START_VERTEX;
			do {
				let vertex = currentBlocker.vertices[currentVertex];
				creatingPolygon.push(vertex);
				print("        Traversing...", [vertex]);

				currentVertex = (currentVertex + 1) % currentBlocker.vertices.length;
				vertex = currentBlocker.vertices[currentVertex];

				// Check if its an intersection point
				if (vertex.link !== undefined) {
					currentBlocker = (currentBlocker == peer) ? this : peer;
					currentVertex = currentBlocker.vertices.indexOf(vertex.link);
				} else {
					// Mark as visited
					for (let ov = 0; ov < outerVertices.length; ov++) {
						if (outerVertices[ov].vertex == currentBlocker.vertices[currentVertex]) {
							outerVertices[ov].visited = true
							break;
						}
					}
				}

			} while (START_VERTEX != currentVertex || START_BLOCKER != currentBlocker);
			newPolygons.push(creatingPolygon);
		}

		let convexHull = 0; // polygon at index zero
		if (newPolygons.length > 1) {
			// There are holes. Check which are holes and which is the convex hull
			// Select first vertex of first new polygon.
			let vertex = newPolygons[0][0];
			for (let p = 1; p < newPolygons.length; p++) {
				if (polygonContainsPoint(newPolygons[p], vertex)) {
					convexHull = p; // polygon @ index p
					break;
				}
			}
		}

		// Instance new conjoined blocker possibly with holes.
		// TODO: Make sure the following returns the convex hull element and then the
		// newPolygons array without the convex hull polygon.
		let convexHullVertices = newPolygons.splice(convexHull, 1)[0];
		let convexHullBlocker = [];
		convexHullVertices.forEach(function(vertex) {
			convexHullBlocker.push(new Point(vertex.x, vertex.y));
		});
		let holes = [];
		newPolygons.forEach(function(holePolygon) {
			holes.push([]);
			holePolygon.forEach(function(vertex) {
				holes[holes.length-1].push(new Point(vertex.x, vertex.y));
			});
		});
		new Blocker(convexHullBlocker, holes, true, this.conjoinedVertices.concat(peer.conjoinedVertices));

		return true; // Conjoin occurred
	};

	// Tests if the target blocker has been pierced from a line starting from 'start'
	// and ending at 'end'. It will return undefined if it does not pierce the blocker.
	// If the segment does pierce the blocker, it will return an object with the closest
	// pierced side to the start point, that distance squared, and the exact pierce point.
	pierce(start, end) {
		let a = new Point(start.x, start.y);
		let b = new Point(end.x, end.y);
		const ray = new Segment(a, b);
		let nearestIntersectingSide = {
			side: undefined,
			distanceSqrd: undefined,
			point: undefined
		};

		this.sides.forEach(function(side) {
			let intersection = ray.intersectionPoint(side);
			if (intersection) {
				let distSqrd = Math.pow(intersection.y - ray.a.y, 2) + Math.pow(intersection.x - ray.a.x, 2);
				// segmentsIntersect returning undefined indicates they don't intersect.
				if (!nearestIntersectingSide.side || distSqrd < nearestIntersectingSide.distanceSqrd) {
					nearestIntersectingSide.side = side;
					nearestIntersectingSide.distanceSqrd = distSqrd;
					nearestIntersectingSide.point = intersection;
				}
			}
		});

		// Can return undefined or a segment object
		return nearestIntersectingSide;
	};

	// https://www.geeksforgeeks.org/how-to-check-if-a-given-point-lies-inside-a-polygon/
	containsPoint(p) {
		if (this.vertices.length < 3) return undefined;

		let pInfinity = new Segment(p, new Point(p.x + 99999, p.y));
		let count = 0, s = 0;

		do {
			// Check if point lies on perimeter of blocker.
			if (this.sides[s].a.equals(p) || this.sides[s].b.equals(p)) {
				return false;
			}

			if (this.sides[s].intersects(pInfinity)) {
				if (orientation(this.sides[s].a, p, this.sides[s].b) == 0) {
					return p.isOnSegment(this.sides[s]);
				}
				count += 1;
			}
			s += 1;
		} while (s != this.sides.length);

		return (count%2==1);
	};
	hasVertex(vertex) {
		for (let v = 0; v < this.vertices.length; v++)
			if (this.vertices[v].equals(vertex))
				return v;
		return -1;
	};

	containsBlocker(blocker) {
		for (let v = 0; v < blocker.vertices; v++) {

		}
	}

	nearestPointOutOfBlockerFrom(p) {
		// Find closest point outside of blocker
		let closest = {
			distSqrd: undefined,
			point: undefined
		};
		this.sides.forEach(function(side) {
			let a = new Vector(p.x - side.a.x, p.y - side.a.y);
			let proj = projection(a, side.vector());
			// Check if close to an edge or vertex
			let projDistSqrd = proj.distanceSqrd();
			if (proj.quadrant() == side.vector().quadrant()) {
				if (side.distanceSqrd() < proj.distanceSqrd()) {
					return; // continue;
				} else {
				}
				// Get perpendicular line out from target line at projection point.
				let perp = new Vector(
					(side.a.x + proj.x) - p.x,
					(side.a.y + proj.y) - p.y
				);
				if (!closest.distSqrd || perp.distanceSqrd() < closest.distSqrd ) {
					closest.distSqrd = perp.distanceSqrd();
					closest.point = new Point(side.a.x + proj.x, side.a.y + proj.y);
				}
			} else {
				// Closer to edge endpoint than to the edge
				if (!closest.distSqrd || a.distanceSqrd() < closest.distSqrd ) {
					closest.distSqrd = a.distanceSqrd();
					closest.point = side.a;
				}
			}
		});
		// Extend out result by 1 unit to avoid rounding errors
		return new Segment(p, closest.point).vector().extendedBy(1).add(p);
	}

	visibleVerticesFrom(p) {
		let visibleVertices = [];
		// Find visible vertices
		let onVertexIndex = this.hasVertex(p);
		let vertices = this.vertices;
		let sides = this.sides;
		if (onVertexIndex != -1) {
			// If start point is on top of one of the vertices have to take precautions
			let vertexIndex = -1;
			let self = this;
			vertices.forEach(function(vertex) { vertexIndex++;
			  // Don't include point which start is on top of
			  if (onVertexIndex == vertexIndex) {
				return;
			  }
			  let prevVertexIndex =  self.prevVertexTo(vertexIndex);
			  let nextVertexIndex = self.nextVertexTo(vertexIndex);
			  // Add neighboring vertices
			  if (onVertexIndex == prevVertexIndex || onVertexIndex == nextVertexIndex) {
				visibleVertices.push(vertex);
				return;
			  }
			  let toVertex = new Segment(p, vertex);
			  // Check if line is cutting through middle of shape.
			  while(prevVertexIndex != onVertexIndex || nextVertexIndex != onVertexIndex) {
				let internalSegment = new Segment(vertices[prevVertexIndex], vertices[nextVertexIndex]);
				if (internalSegment.intersects(toVertex)) {
				  return; // Cut through middle
				}
				let verticesNeighborRoot = (self.prevVertexTo(prevVertexIndex) == onVertexIndex && self.nextVertexTo(nextVertexIndex) == onVertexIndex);
				// Stop once iterator is a vertex away from start point, let run once more
				if (self.prevVertexTo(prevVertexIndex) != onVertexIndex || verticesNeighborRoot)
				  prevVertexIndex = self.prevVertexTo(prevVertexIndex);
				if (self.nextVertexTo(nextVertexIndex) != onVertexIndex || verticesNeighborRoot)
				  nextVertexIndex = self.nextVertexTo(nextVertexIndex);
			  }
			  visibleVertices.push(vertex);
			});
		  } else {
			// Go through blockers' vertices, test against blocker's edges (sides).
			vertices.forEach(function(vertex) {
			  let toVertex = new Segment(p, vertex);
			  for (let s = 0; s < sides.length; s++) {
				if (toVertex.intersects(sides[s])) {
				  return; // continue in forEach
				}
			  }
			  visibleVertices.push(vertex);
			});
		  }
		return visibleVertices;
	}

	nextVertexTo(v) {
		return (v + 1) % this.vertices.length;
	}

	prevVertexTo(v) {
		return (v - 1) < 0 ? this.vertices.length - 1 : v - 1;
	}

	render(context) {
		// Draw conjoinedVertices
		context.strokeStyle = "Red";
		this.conjoinedVertices.forEach(vertices => {
			vertices.forEach((vertex, i) => {
				if (i == 0) {
					context.beginPath();
					context.moveTo(vertex.x, vertex.y);
				} else {
					context.lineTo(vertex.x, vertex.y);
				}
			});
			context.lineTo(vertices[0].x, vertices[0].y);
			context.stroke();
		});
	}
}
Blocker.blockers = [];
// Blocker.rawVertices = []; // Only used for visuals - no calcs on this.
Blocker.constsructingVertices = []; // Used by editMode

Blocker.finishConstruction = function(discard = false) {
	if (Blocker.constsructingVertices.length > 2 && !discard) {
		new Blocker(Blocker.constsructingVertices);
	}
	if (Blocker.constsructingVertices.length == 0 && !discard) {
		// Delete blocker if contains right click
		for (let b = 0; b < Blocker.blockers.length; b++) {
			if (Blocker.blockers[b].containsPoint(new Point(mouse.x, mouse.y))) {
				Blocker.blockers.splice(b, 1);
				break;
			}
		}
	}
	Blocker.constsructingVertices = [];
}

Blocker.constructionRender = function(context) {
	// Draw preprocessed blocker
	Blocker.blockers.forEach(blocker => {
		// Draw boundaries
		context.strokeStyle = "Green";
		context.beginPath();
		blocker.vertices.forEach((vertex, i) => {
			if (i == 0) {
				context.moveTo(vertex.x, vertex.y);
			} else {
				context.lineTo(vertex.x, vertex.y);
			}
		});
		context.lineTo(blocker.vertices[0].x, blocker.vertices[0].y);
		context.stroke();

		// Draw holes
		context.fillStyle = "rgba(0, 0, 0, 0.6)";
		blocker.holes.forEach((hole) => {
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
 * Try and get closest blocker along ray from start to target points.
 * @param {Point} start - Start position of ray.
 * @param {Point} target - End position of ray.
 * 
 * @return {{}} A hash containing `blocker`, `distanceSqrd` to the blocker, and
 * `pierce` which is a hash containing the side that was first hit by the raytrace.
 * `blocker` will be undefined if nothing was interescted.
 */
Blocker.closestBlocker = function(start, target) {

	// Vector: start -> target
	let vTarget = new Point(target.x - start.x, target.y - start.y);
	vTarget.distanceSqrd = Math.pow((vTarget.x), 2) + Math.pow((vTarget.y), 2);

	// Layout Review: Find blockers in the way of target.
	// ===================================================================
	let blockersInPath = [];
	Blocker.blockers.forEach(function(blocker) {

		// Vector: start -> blocker_center (calculated average center)
		let toSphere = new Point(blocker.center.x - start.x, blocker.center.y - start.y);
		toSphere.distanceSqrd = Math.pow((toSphere.x), 2) + Math.pow((toSphere.y), 2);

		// Special case where we check a blocker's vertices if 'start' is inside
		// blocker's circle collider.
		if (toSphere.distanceSqrd < blocker.colliderRadiusSqrd) {
			if (blocker.containsPoint(start)) {
				return; // Ignore this blocker so we can get out.
			}
			blockersInPath.push(blocker); // Perform a precision check.
			return; // "continue"
		}

		// Segment: blocker_center -> target
		let targetToBlockerDistanceSqrd =
			Math.pow(blocker.center.x - target.x, 2) +
			Math.pow(blocker.center.y - target.y, 2);

		// Include this blocker if 'target' is inside blocker's circle collider
		if (targetToBlockerDistanceSqrd < blocker.colliderRadiusSqrd) {
			blockersInPath.push(blocker); // Perform a precision check
			return; // "continue"
		}

		// Check for circle intersection
		if (lineIntersectsCircle(vTarget, toSphere, blocker.colliderRadiusSqrd)) {
			blockersInPath.push(blocker); // Perform a precision check
			return; // "continue"
		}
	}); // finished: Layout Review ========================================

	// Precision Check: Find closest blocker in direct path.
	// ==================================================================
	let closestBlocker = {
		blocker: undefined,
		distanceSqrd: undefined,
		pierce: undefined
	}
	blockersInPath.forEach(function(blocker) {
		let pierce = blocker.pierce(start, target);
		if (pierce.side) {
			// If pierce side is undefined, then this blocker has no pierced sides.
			if (!closestBlocker.blocker || pierce.distanceSqrd < closestBlocker.distanceSqrd) {
				closestBlocker.distanceSqrd = pierce.distanceSqrd;
				closestBlocker.blocker = blocker;
				closestBlocker.pierce = pierce;
			}
		}
	});
	// finished: Precision Check ========================================
	return closestBlocker;
}
