// on mouse move
  // // Parallel bar dragging
  // if (parallelBarsVisible) disableLogging(parallelBarDragging.top || parallelBarDragging.left)
  // if (parallelBarDragging.top || parallelBarDragging.left) {
  //   if (parallelBarDragging.top) {
  //     mouse.lastLeftClick = new Point(Math.min(Math.max(mouse.contextLoc.x, PARALLEL_SETTER_TOP_X), Layout.bounds.width - PARALLEL_SETTER_TOP_X), 0)
  //     mouse.lastRightClick = new Point(Math.min(Math.max(mouse.contextLoc.x, PARALLEL_SETTER_TOP_X), Layout.bounds.width - PARALLEL_SETTER_TOP_X), Layout.bounds.width)
  //   } else
  //   if (parallelBarDragging.left) {
  //     mouse.lastLeftClick = new Point(0, Math.min(Math.max(mouse.contextLoc.y, PARALLEL_SETTER_TOP_X), Layout.bounds.width - PARALLEL_SETTER_TOP_X))
  //     mouse.lastRightClick = new Point(Layout.bounds.width, Math.min(Math.max(mouse.contextLoc.y, PARALLEL_SETTER_TOP_X), Layout.bounds.width - PARALLEL_SETTER_TOP_X))
  //   }
  //   disableLogging(true)
  //   Layout.route(mouse.lastLeftClick, mouse.lastRightClick)
  //   disableLogging(false)
  // } else if (!meshConstructorToolActive) {
  //   // Drag pathing
  //   if (e.buttons === 1 || e.buttons == 2) {
  //     if (e.buttons === 1) {
  //       mouse.lastLeftClick = new Point(mouse.contextLoc.x, mouse.contextLoc.y)
  //     } else if (e.buttons == 2) {
  //       mouse.lastRightClick = new Point(mouse.contextLoc.x, mouse.contextLoc.y)
  //     }

  //     if (!meshConstructorToolActive && gridify) {
  //       test_lines = []
  //       test_circles = []
  //       test_points = []

  //       disableLogging(true)
  //       Layout.route(mouse.lastLeftClick, mouse.lastRightClick)
  //       disableLogging(false)

  //       // testLine(mouse.lastLeftClick, mouse.lastRightClick)
  //       testCircle(mouse.lastLeftClick.x, mouse.lastLeftClick.y, 6)
  //       testCircle(mouse.lastRightClick.x, mouse.lastRightClick.y, 6)
  //     }
  //   }
  // }

// on mouse down
    // if (parallelBarsVisible) {
    //   let x = Layout.bounds.xInset + PARALLEL_SETTER_TOP_X;
    //   let y = Layout.bounds.yInset + PARALLEL_SETTER_TOP_Y;
    //   if (
    //     mouse.contextLoc.x > x && mouse.contextLoc.x < (Layout.bounds.width - x) &&
    //     y < mouse.contextLoc.y && mouse.contextLoc.y < (y + PARALLEL_SETTER_TOP_H)
    //   ) {
    //     parallelBarDragging.top = true;
    //     parallelBarDragging.left = false;
    //     return;
    //   } else
    //   if (
    //     y < mouse.contextLoc.x && mouse.contextLoc.x < (y + PARALLEL_SETTER_TOP_H) &&
    //     mouse.contextLoc.y > x && mouse.contextLoc.y < (Layout.bounds.width - x)
    //   ) {
    //     parallelBarDragging.left = true;
    //     parallelBarDragging.top = false;
    //     return;
    //   } else {
    //     parallelBarDragging.top = false;
    //     parallelBarDragging.left = false;
    //   }
    // }


    // let parallelBarsVisible = false;
    // let parallelBarDragging = {top: false, left: false}
    // const PARALLEL_SETTER_TOP_X = 80
    // const PARALLEL_SETTER_TOP_Y = 14
    // const PARALLEL_SETTER_TOP_H = 20


    // if (parallelBarsVisible) {
    //   let h = PARALLEL_SETTER_TOP_H;
    //   let x = Layout.bounds.xInset + PARALLEL_SETTER_TOP_X;
    //   let y = Layout.bounds.yInset + PARALLEL_SETTER_TOP_Y;
    //   canvasMasterContext.strokeStyle = "rgb(44,54,64)";
    //   // Top Setter
    //   canvasMasterContext.beginPath();
    //   canvasMasterContext.moveTo(x, y);
    //   canvasMasterContext.lineTo(Layout.bounds.width-x, y);
    //   canvasMasterContext.arc(Layout.bounds.width-x, y+h/2, h/2, -Math.PI/2, Math.PI/2, false);
    //   canvasMasterContext.lineTo(x, y+h);
    //   canvasMasterContext.arc(x, y+h/2, h/2, Math.PI/2, -Math.PI/2, false);
    //   canvasMasterContext.stroke();
    //   if (parallelBarDragging.top) {
    //     canvasMasterContext.fillStyle = "rgb(44,54,64)";
    //     canvasMasterContext.beginPath();
    //     canvasMasterContext.arc(mouse.lastRightClick.x, y+h/2, h/2, 0, Math.PI*2, false);
    //     canvasMasterContext.fill();
    //   }
    //   // Left Setter
    //   canvasMasterContext.beginPath();
    //   canvasMasterContext.moveTo(y, x);
    //   canvasMasterContext.lineTo(y, Layout.bounds.width-x);
    //   canvasMasterContext.arc(y+h/2, Layout.bounds.width-x, h/2, Math.PI, 0, true);
    //   canvasMasterContext.lineTo(y+h, x);
    //   canvasMasterContext.arc(y+h/2, x, h/2, 0, -Math.PI, true);
    //   canvasMasterContext.stroke();
    //   if (parallelBarDragging.left) {
    //     canvasMasterContext.fillStyle = "rgb(44,54,64)";
    //     canvasMasterContext.beginPath();
    //     canvasMasterContext.arc(y+h/2, mouse.lastRightClick.y, h/2, 0, Math.PI*2, false);
    //     canvasMasterContext.fill();
    //   }
    // }