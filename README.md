# js-2d-pathing
Delauny Triangulation, gridifying, and A* pathfinding.

TODO:

Fill outside of bounding polygon with another fill color without using canvas clip(). Too expensive.

Polygon-context. A bounding polygon's holes should serve as its layout pathing space.
Each hole should then serve as the bounding space for more internal holes - and should
continue recursively in this fashion to form a tree. When considering pathing, the
bounding polygon should be any polygon and its holes should function as the blockers.

Decide how to handle overlapping CW and CCW polygons.

# How to Start Simple Web Server

Python2:
> python -m SimpleHTTPServer 8000

Python3: 
> python3 -m http.server --cgi 8080

Check Mac python version with `python --version`