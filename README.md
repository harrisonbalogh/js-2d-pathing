# js-2d-pathing
Working on pathing algorithm without grid spaces in javascript 2D space.


TODO:

Optimize pathing needs completed implementation. This should clean up long sliver
triangles. If it doesn't: find a way to combine triangles to remove slivers.

After slivers are removed, check pathing heuristic. This may roll into how the
path is actually taken between neighboring triangles. If not: see next task.

Form actual travel path between neighboring triangles from pathing calculation.

Add caching and getters/setters to polygon class for edge-generation optimzation.

Pull the camera panning funtionality from `wisp` project into this project. Bounds
should not be limited or set by the size of the window.

Fill outside of bounding polygon with another fill color without using canvas clip().
Too expensive.

Polygon-context. A bounding polygon's holes should serve as its layout pathing space.
Each hole should then serve as the bounding space for more internal holes - and should
continue recursively in this fashion to form a tree. When considering pathing, the
bounding polygon should be any polygon and its holes should function as the blockers.

Decide how to handle overlapping CW and CCW polygons.

