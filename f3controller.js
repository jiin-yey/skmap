/**
 * The visualization controller will works as a state machine.
 * See files under the `doc` folder for transition descriptions.
 * See https://github.com/jakesgordon/javascript-state-machine
 * for the document of the StateMachine module.
 */
var Controller = StateMachine.create({
  initial: "none",
  events: [
    {
      name: "init",
      from: "none",
      to: "ready",
    },
    {
      name: "search",
      from: "starting",
      to: "searching",
    },
    {
      name: "pause",
      from: "searching",
      to: "paused",
    },
    {
      name: "finish",
      from: "searching",
      to: "finished",
    },
    {
      name: "resume",
      from: "paused",
      to: "searching",
    },
    {
      name: "cancel",
      from: "paused",
      to: "ready",
    },
    {
      name: "modify",
      from: "finished",
      to: "modified",
    },
    {
      name: "reset",
      from: "*",
      to: "ready",
    },
    {
      name: "clear",
      from: ["finished", "modified"],
      to: "ready",
    },
    {
      name: "start",
      from: ["ready", "modified", "restarting"],
      to: "starting",
    },
    {
      name: "restart",
      from: ["searching", "finished"],
      to: "restarting",
    },
    {
      name: "dragStart",
      from: ["ready", "finished"],
      to: "draggingStart",
    },
    {
      name: "dragEnd",
      from: ["ready", "finished"],
      to: "draggingEnd",
    },
    {
      name: "drawWall",
      from: ["ready", "finished"],
      to: "drawingWall",
    },
    {
      name: "eraseWall",
      from: ["ready", "finished"],
      to: "erasingWall",
    },
    {
      name: "rest",
      from: ["draggingStart", "draggingEnd", "drawingWall", "erasingWall"],
      to: "ready",
    },
  ],
});

$.extend(Controller, {
  gridSize: [70, 100], // number of nodes horizontally and vertically
  operationsPerSecond: 300,

  /**
   * Asynchronous transition from `none` state to `ready` state.
   */
  onleavenone: function () {
    var numCols = this.gridSize[0],
      numRows = this.gridSize[1];

    this.grid = new PF.Grid(numCols, numRows);

    View.init({
      numCols: numCols,
      numRows: numRows,
    });
    View.generateGrid(function () {
      Controller.setDefaultStartEndPos();
      Controller.bindEvents();
      Controller.transition(); // transit to the next state (ready)
    });

    this.$buttons = $(".control_button");

    this.hookPathFinding();

    return StateMachine.ASYNC;
    // => ready
  },
  ondrawWall: function (event, from, to, gridX, gridY) {
    this.setWalkableAt(gridX, gridY, false);
    // => drawingWall
  },
  oneraseWall: function (event, from, to, gridX, gridY) {
    this.setWalkableAt(gridX, gridY, true);
    // => erasingWall
  },
  onsearch: function (event, from, to) {
    var grid,
      timeStart,
      timeEnd,
      finder = Panel.getFinder();

    timeStart = window.performance ? performance.now() : Date.now();
    grid = this.grid.clone();
    this.path = finder.findPath(
      this.startX,
      this.startY,
      this.endX,
      this.endY,
      grid
    );
    this.operationCount = this.operations.length;
    timeEnd = window.performance ? performance.now() : Date.now();
    this.timeSpent = (timeEnd - timeStart).toFixed(4);

    this.loop();
    // => searching
  },
  onrestart: function () {
    // When clearing the colorized nodes, there may be
    // nodes still animating, which is an asynchronous procedure.
    // Therefore, we have to defer the `abort` routine to make sure
    // that all the animations are done by the time we clear the colors.
    // The same reason applies for the `onreset` event handler.
    setTimeout(function () {
      Controller.clearOperations();
      Controller.clearFootprints();
      Controller.start();
    }, View.nodeColorizeEffect.duration * 1.2);
    // => restarting
  },
  onpause: function (event, from, to) {
    // => paused
  },
  onresume: function (event, from, to) {
    this.loop();
    // => searching
  },
  oncancel: function (event, from, to) {
    this.clearOperations();
    this.clearFootprints();
    // => ready
  },
  onfinish: function (event, from, to) {
    View.showStats({
      pathLength: PF.Util.pathLength(this.path),
      timeSpent: this.timeSpent,
      operationCount: this.operationCount,
    });
    View.drawPath(this.path);
    // => finished
  },
  onclear: function (event, from, to) {
    this.clearOperations();
    this.clearFootprints();
    // => ready
  },
  onmodify: function (event, from, to) {
    // => modified
  },
  onreset: function (event, from, to) {
    setTimeout(function () {
      Controller.clearOperations();
      Controller.clearAll();
      Controller.buildNewGrid();
    }, View.nodeColorizeEffect.duration * 1.2);
    // => ready
  },

  /**
   * The following functions are called on entering states.
   */

  onready: function () {
    console.log("=> ready");
    this.setButtonStates(
      {
        id: 1,
        text: "Start Search",
        enabled: true,
        callback: $.proxy(this.start, this),
      },
      {
        id: 2,
        text: "Pause Search",
        enabled: false,
      },
      {
        id: 3,
        text: "Clear Walls",
        enabled: true,
        callback: $.proxy(this.reset, this),
      }
    );
    // => [starting, draggingStart, draggingEnd, drawingStart, drawingEnd]
  },
  onstarting: function (event, from, to) {
    console.log("=> starting");
    // Clears any existing search progress
    this.clearFootprints();
    this.setButtonStates({
      id: 2,
      enabled: true,
    });
    this.search();
    // => searching
  },
  onsearching: function () {
    console.log("=> searching");
    this.setButtonStates(
      {
        id: 1,
        text: "Restart Search",
        enabled: true,
        callback: $.proxy(this.restart, this),
      },
      {
        id: 2,
        text: "Pause Search",
        enabled: true,
        callback: $.proxy(this.pause, this),
      }
    );
    // => [paused, finished]
  },
  onpaused: function () {
    console.log("=> paused");
    this.setButtonStates(
      {
        id: 1,
        text: "Resume Search",
        enabled: true,
        callback: $.proxy(this.resume, this),
      },
      {
        id: 2,
        text: "Cancel Search",
        enabled: true,
        callback: $.proxy(this.cancel, this),
      }
    );
    // => [searching, ready]
  },
  onfinished: function () {
    console.log("=> finished");
    this.setButtonStates(
      {
        id: 1,
        text: "Restart Search",
        enabled: true,
        callback: $.proxy(this.restart, this),
      },
      {
        id: 2,
        text: "Clear Path",
        enabled: true,
        callback: $.proxy(this.clear, this),
      }
    );
  },
  onmodified: function () {
    console.log("=> modified");
    this.setButtonStates(
      {
        id: 1,
        text: "Start Search",
        enabled: true,
        callback: $.proxy(this.start, this),
      },
      {
        id: 2,
        text: "Clear Path",
        enabled: true,
        callback: $.proxy(this.clear, this),
      }
    );
  },

  /**
   * Define setters and getters of PF.Node, then we can get the operations
   * of the pathfinding.
   */
  hookPathFinding: function () {
    PF.Node.prototype = {
      get opened() {
        return this._opened;
      },
      set opened(v) {
        this._opened = v;
        Controller.operations.push({
          x: this.x,
          y: this.y,
          attr: "opened",
          value: v,
        });
      },
      get closed() {
        return this._closed;
      },
      set closed(v) {
        this._closed = v;
        Controller.operations.push({
          x: this.x,
          y: this.y,
          attr: "closed",
          value: v,
        });
      },
      get tested() {
        return this._tested;
      },
      set tested(v) {
        this._tested = v;
        Controller.operations.push({
          x: this.x,
          y: this.y,
          attr: "tested",
          value: v,
        });
      },
    };

    this.operations = [];
  },
  bindEvents: function () {
    $("#draw_area").mousedown($.proxy(this.mousedown, this));
    $(window)
      .mousemove($.proxy(this.mousemove, this))
      .mouseup($.proxy(this.mouseup, this));
  },
  loop: function () {
    var interval = 1000 / this.operationsPerSecond;
    (function loop() {
      if (!Controller.is("searching")) {
        return;
      }
      Controller.step();
      setTimeout(loop, interval);
    })();
  },
  step: function () {
    var operations = this.operations,
      op,
      isSupported;

    do {
      if (!operations.length) {
        this.finish(); // transit to `finished` state
        return;
      }
      op = operations.shift();
      isSupported = View.supportedOperations.indexOf(op.attr) !== -1;
    } while (!isSupported);

    View.setAttributeAt(op.x, op.y, op.attr, op.value);
  },
  clearOperations: function () {
    this.operations = [];
  },
  clearFootprints: function () {
    View.clearFootprints();
    View.clearPath();
  },
  clearAll: function () {
    this.clearFootprints();
    View.clearBlockedNodes();
  },
  buildNewGrid: function () {
    this.grid = new PF.Grid(this.gridSize[0], this.gridSize[1]);
  },
  mousedown: function (event) {
    var coord = View.toGridCoordinate(event.pageX, event.pageY),
      gridX = coord[0],
      gridY = coord[1],
      grid = this.grid;

    if (this.can("dragStart") && this.isStartPos(gridX, gridY)) {
      this.dragStart();
      return;
    }
    if (this.can("dragEnd") && this.isEndPos(gridX, gridY)) {
      this.dragEnd();
      return;
    }
    if (
      !this.isStartOrEndPos(gridX, gridY) &&
      grid.isWalkableAt(gridX, gridY)
    ) {
      var target = document.querySelector(".set_point");
      var target2 = document.querySelector("#shadow");
      target.style.display = "flex";
      target2.style.display = "flex";
      View.setWalkableAt(gridX, gridY, false);
      $("#x").click(function () {
        target.style.display = "none";
        target2.style.display = "none";
        View.setWalkableAt(gridX, gridY, true);
      });
      $("#shadow").click(function () {
        target.style.display = "none";
        target2.style.display = "none";
        View.setWalkableAt(gridX, gridY, true);
      });
      $("#startp").click(function () {
        Controller.setStartPos(gridX, gridY);
        target.style.display = "none";
        target2.style.display = "none";
        View.setWalkableAt(gridX, gridY, true);
      });
      $("#endp").click(function () {
        Controller.setEndPos(gridX, gridY);
        target.style.display = "none";
        target2.style.display = "none";
        View.setWalkableAt(gridX, gridY, true);
      });
    }
    /*if (this.can("drawWall") && grid.isWalkableAt(gridX, gridY)) {
        this.drawWall(gridX, gridY);
        return;
      }
      if (this.can("eraseWall") && !grid.isWalkableAt(gridX, gridY)) {
        this.eraseWall(gridX, gridY);
      }*/ //this is the part of the drawing Walkableline
  },
  mousemove: function (event) {
    var coord = View.toGridCoordinate(event.pageX, event.pageY),
      grid = this.grid,
      gridX = coord[0],
      gridY = coord[1];

    if (this.isStartOrEndPos(gridX, gridY)) {
      return;
    }

    switch (this.current) {
      case "draggingStart":
        if (grid.isWalkableAt(gridX, gridY)) {
          this.setStartPos(gridX, gridY);
        }
        break;
      case "draggingEnd":
        if (grid.isWalkableAt(gridX, gridY)) {
          this.setEndPos(gridX, gridY);
        }
        break;
      case "drawingWall":
        this.setWalkableAt(gridX, gridY, false);
        break;
      case "erasingWall":
        this.setWalkableAt(gridX, gridY, true);
        break;
    }
  },
  mouseup: function (event) {
    if (Controller.can("rest")) {
      Controller.rest();
    }
  },
  setButtonStates: function () {
    $.each(arguments, function (i, opt) {
      var $button = Controller.$buttons.eq(opt.id - 1);
      if (opt.text) {
        $button.text(opt.text);
      }
      if (opt.callback) {
        $button.unbind("click").click(opt.callback);
      }
      if (opt.enabled === undefined) {
        return;
      } else if (opt.enabled) {
        $button.removeAttr("disabled");
      } else {
        $button.attr({ disabled: "disabled" });
      }
    });
  },
  /**
   * When initializing, this method will be called to set the positions
   * of start node and end node.
   * It will detect user's display size, and compute the best positions.
   */
  setDefaultStartEndPos: function () {
    var width,
      height,
      marginRight,
      availWidth,
      centerX,
      centerY,
      endX,
      endY,
      nodeSize = View.nodeSize;

    width = $(window).width();
    height = $(window).height();

    marginRight = $("#algorithm_panel").width();
    availWidth = width - marginRight;

    centerX = Math.ceil(availWidth / 2 / nodeSize);
    centerY = Math.floor(height / 2 / nodeSize);

    this.setStartPos(4, 35);
    this.setEndPos(10, 35);
    for (var i = 0; i < f3blockarray.length; i++) {
      this.setWalkableAt.apply(this, f3blockarray[i]);
    }

    // Here //
    // search room function //

    $("#Search_bt").click(function () {
      var x = document.getElementById("name").value.toUpperCase();
      if (x == "331") {
        Controller.setEndPos(40, 15);
      } else if (x == "301") {
        Controller.setEndPos(33, 16);
      } else if (x == "302") {
        Controller.setEndPos(32, 20);
      } else if (x == "303") {
        Controller.setEndPos(32, 23);
      } else if (x == "304") {
        Controller.setEndPos(32, 26);
      } else if (x == "305") {
        Controller.setEndPos(32, 30);
      } else if (x == "330") {
        Controller.setEndPos(41, 23);
      } else if (x == "329") {
        Controller.setEndPos(43, 32);
      } else if (x == "328") {
        Controller.setEndPos(43, 35);
      } else if (x == "327") {
        Controller.setEndPos(43, 38);
      } else if (x == "326") {
        Controller.setEndPos(43, 41);
      } else if (x == "325") {
        Controller.setEndPos(43, 45);
      } else if (x == "306") {
        Controller.setEndPos(31, 41);
      } else if (x == "307") {
        Controller.setEndPos(34, 41);
      } else if (x == "308") {
        Controller.setEndPos(38, 43);
      } else if (x == "309") {
        Controller.setEndPos(39, 46);
      } else if (x == "310") {
        Controller.setEndPos(38, 52);
      } else if (x == "324") {
        Controller.setEndPos(43, 52);
      } else if (x == "323") {
        Controller.setEndPos(41, 61);
      } else if (x == "318") {
        Controller.setEndPos(32, 62);
      } else if (x == "320") {
        Controller.setEndPos(34, 63);
      } else if (x == "322") {
        Controller.setEndPos(41, 63);
      } else if (x == "321") {
        Controller.setEndPos(40, 65);
      } else if (x == "319") {
        Controller.setEndPos(31, 65);
      } else if (x == "317") {
        Controller.setEndPos(28, 64);
      } else if (x == "316") {
        Controller.setEndPos(26, 64);
      } else if (x == "315") {
        Controller.setEndPos(15, 62);
      } else if (x == "314") {
        Controller.setEndPos(13, 61);
      } else if (x == "313") {
        Controller.setEndPos(5, 65);
      } else if (x == "312") {
        Controller.setEndPos(4, 63);
      } else {
        alert(
          "잘못 입력하였거나, 입력하신 호실이 해당 층에 위치하지 않습니다."
        );
      }
    });
    $("#name").keydown(function () {
      if (window.event.keyCode == "13") {
        $("#Search_bt").trigger("click");
      }
    });
  },
  setStartPos: function (gridX, gridY) {
    this.startX = gridX;
    this.startY = gridY;
    View.setStartPos(gridX, gridY);
  },
  setEndPos: function (gridX, gridY) {
    this.endX = gridX;
    this.endY = gridY;
    View.setEndPos(gridX, gridY);
  },
  setWalkableAt: function (gridX, gridY, walkable) {
    this.grid.setWalkableAt(gridX, gridY, walkable);
    View.setAttributeAt(gridX, gridY, "walkable", walkable);
  },
  isStartPos: function (gridX, gridY) {
    return gridX === this.startX && gridY === this.startY;
  },
  isEndPos: function (gridX, gridY) {
    return gridX === this.endX && gridY === this.endY;
  },
  isStartOrEndPos: function (gridX, gridY) {
    return this.isStartPos(gridX, gridY) || this.isEndPos(gridX, gridY);
  },
});