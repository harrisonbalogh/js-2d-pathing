# js-2d-pathing
## Delaunay triangulation, gridifying, A* pathfinding, funnel algorithm

<iframe width="700" height="394" src="https://www.youtube.com/embed/VC3mHaZeFlc" title="YouTube video player" frameborder="0" allow="clipboard-write; encrypted-media; picture-in-picture" allowfullscreen /> 

##

Implements all necessary algorithms for 2D pathfinding in JavaScript. No libraries used.

Rendering is performed with JS Canvas objects. Triangulation algorithm is a variation of
Delaunay for handling fixed-width pathfinding (in [Triangulation.js](https://github.com/harrisonbalogh/js-2d-pathing/blob/master/site/javascript/Layout2D/Triangulation.js#L14)). Graph is created
using edge-shared polygons and bounding polygon. Graph path is determined by A*
implemention (in [Pathfinding.js](https://github.com/harrisonbalogh/js-2d-pathing/blob/master/site/javascript/Layout2D/Pathfinding.js#L12)). Shortest path is determined by
funnel algorithm implementation (in [Pathfinding.js](https://github.com/harrisonbalogh/js-2d-pathing/blob/master/site/javascript/Layout2D/Pathfinding.js#L113)).

<img width="495" alt="Screen Shot 2021-12-13 at 9 11 42 PM" src="https://user-images.githubusercontent.com/8960690/145920275-63fd9695-74b0-48ec-b2ed-135c798db63c.png">

---
### TODO:
---

Fill outside of bounding polygon with another fill color without using canvas clip(). Too expensive.

Polygon-context. A bounding polygon's holes should serve as its layout pathing space.
Each hole should then serve as the bounding space for more internal holes - and should
continue recursively in this fashion to form a tree. When considering pathing, the
bounding polygon should be any polygon and its holes should function as the blockers.

Decide how to handle overlapping CW with CCW polygons.

---
### Local dev
---

Run following within /site directory:

Python2:
> python -m SimpleHTTPServer 8000

Python3: 
> python3 -m http.server --cgi 8080

Check Mac python version with `python --version`
