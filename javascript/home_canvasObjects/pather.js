/**
* Populate this.waypoint.pathX/Y by using wisp's destination target.
* Will produce a path that avoids any existing blockers on the canvas.
* This version only creates 1 waypoint. Meaning it does not create an entire route
* every call - only pathX[0] and pathY[0] will ever have values.
* @param {Point} start - array of Point objects as defined in Geometry.js
* @param {Point} destination - target goal point
* @param {[Blocker]} layout - array of Blocker objects
*
* @return {[Point]} Array of points to follow to reach destination.
*/
function pathGen(start, destination, layout, intercalaryRoute) {

  // TODO: Blocker.blockers should be retrieving only applicable blockers within the start points world space.
  // World should be aware of "holes". So a point exists within a confined space, if you were inside a hole, you
  // have a new set of blockers or bounds.

  if (intercalaryRoute == undefined) {
    // Clear previous test visuals if not an intercalary route
    test_points = [];
    test_lines = [];
    test_circles = [];
    testCircle(destination.x, destination.y, 6);
  }
  if (intercalaryRoute == undefined)
    print("== PATHING ==========", true);
  else
    print("    == INTERCALARY PATHING ==========", intercalaryRoute, false);

  /** Max number of waypoints before path is halted */
  const MAX_WAYPOINTS = 20;
  /** Max number of pathfinding iterations allowed */
  const MAX_ROUTE_ITERATIONS = 30;

  /**
   * Array of points to store final path to navigate to destination. Returned
   * at end of `pathGen()`.
   * @type {[Point]}
   */
  let path = [start];

  // If necessary, set start point out of contained blocker
  Blocker.blockers.forEach(blocker => {
    if (blocker.containsPoint(start)) {
      testPoint(start.x, start.y);
      testCircle(start.x, start.y, 8);
      let leavePoint = blocker.nearestPointOutOfBlockerFrom(start);
      path.push(leavePoint);
      start = leavePoint;
      print("    Internal start point. ", [start]);
    }
  });
  testPoint(start.x, start.y);

  // If necessary, set destination point of contained blocker
  Blocker.blockers.forEach(blocker => {
    if (blocker.containsPoint(destination)) {
      destination = blocker.nearestPointOutOfBlockerFrom(destination);
      print("    Correcting internal destination. ", [destination]);
    }
  });
  testPoint(destination.x, destination.y);

  /**
   * Current position of waypoint.
   * @type {Point}
   */
  let currentPosition = start;

  /**
   * LIFO stack of destination points that need to be reached. Initialized with
   * destination parameter when `pathGen()` is called. Pop a point from `goalStack` 
   * once it has been reached by current position.
   * @type {[Point]}
   */
  let goalStack = [destination];

  /**
   * Get current destination. Peeks top of goal stack.
   * @type {Point}
   */
  let currentGoal = () => goalStack[goalStack.length - 1];

  /**
   * Check if there is a destination. Checks length of goal stack.
   * @type {boolean}
   */
  let hasGoal = () => goalStack.length != 0;

  /**
   * 
   */
  let shortcutPathStack = [start];

  let iterations = 0;
  while (hasGoal() && iterations < MAX_ROUTE_ITERATIONS && path.length < MAX_WAYPOINTS) {
    iterations++;

    let vGoal = new Vector(currentGoal().x - currentPosition.x,  currentGoal().y - currentPosition.y);
    print("    Route iteration " + iterations + " Vector: " + currentPosition.print() + " -> " + vGoal.print(), [new Segment(currentPosition, currentGoal())]);

    let raycast = Blocker.closestBlocker(currentPosition, currentGoal());

    // Determine if something is in the way
    if (raycast.blocker) {
      print("      Adding blocker", [raycast.blocker]);
      let visibleVertices = raycast.blocker.visibleVerticesFrom(currentPosition);
      goalStack.push(closestPointAroundVertices(visibleVertices, currentPosition, vGoal, destination))
      continue; // Run again to test for a clear path to new subroute
    }

    // Else advance to goal
    let reachedGoal = goalStack.pop();
    shortcutPathStack.push(reachedGoal);
    currentPosition = reachedGoal;
    path.push(reachedGoal);

    //  Optional: Shortcutting.
    // if (shortcutPathStack.length > 2) {
    //   let isNewRoute = (intercalaryRoute == undefined);
    //   if (intercalaryRoute != undefined && intercalaryRoute.length == path.length) {
    //     for (let v = 0; v < path.length; v++) {
    //       if (intercalaryRoute[v] != path[v]) {
    //         isNewRoute = true;
    //         break;
    //       }
    //     }
    //   }
    //   if (isNewRoute) {
    //     let shortcutRoute = pathGen(shortcutPathStack[0], shortcutPathStack[2], layout, shortcutPathStack);
    //     print("Got back shortcut route: ", shortcutRoute);
    //     print("Comparing to path: ", shortcutPathStack);
    //     if (shortcutRoute[1] == shortcutPathStack[1]) {
    //       // Shortcut not found
    //     } else {
    //       // Shortcut was found
    //       print("  Shortcut! Want to replace path " + path.slice(path.length - 1, -1) + " with " + shortcutRoute.slice(1, -1));
    //       path.splice(-3, 3)
    //       path.concat(shortcutRoute);
    //     }
    //     shortcutPathStack.splice(0, 2);
    //   }
    // }
    
  }

  print("   Formed " + path.length + "-point path.", path);
  return path;
} // End pathGen()