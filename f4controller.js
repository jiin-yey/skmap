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
    for (var i = 0; i < f4blockarray.length; i++) {
      this.setWalkableAt.apply(this, f4blockarray[i]);
    }

    // Here //

    // search room function //
    $("#Search_bt").click(function () {
      var x = document
        .getElementById("name")
        .value.toUpperCase()
        .replace(/[^0-9]/g, "");
      if (x == "4118") {
        Controller.setEndPos(28, 12);
      } else if (x == "4117") {
        Controller.setEndPos(29, 12);
      } else if (x == "4116") {
        Controller.setEndPos(31, 12);
      } else if (x == "4115") {
        Controller.setEndPos(32, 12);
      } else if (x == "4103") {
        Controller.setEndPos(28, 13);
      } else if (x == "4104") {
        Controller.setEndPos(29, 13);
      } else if (x == "4105") {
        Controller.setEndPos(31, 13);
      } else if (x == "4106") {
        Controller.setEndPos(32, 13);
      } else if (x == "4102") {
        Controller.setEndPos(28, 16);
      } else if (x == "4101") {
        Controller.setEndPos(29, 16);
      } else if (x == "4100") {
        Controller.setEndPos(31, 16);
      } else if (x == "4099") {
        Controller.setEndPos(32, 16);
      } else if (x == "4088") {
        Controller.setEndPos(28, 18);
      } else if (x == "4089") {
        Controller.setEndPos(29, 18);
      } else if (x == "4090") {
        Controller.setEndPos(31, 18);
      } else if (x == "4087") {
        Controller.setEndPos(28, 20);
      } else if (x == "4086") {
        Controller.setEndPos(29, 20);
      } else if (x == "4085") {
        Controller.setEndPos(31, 20);
      } else if (x == "4072") {
        Controller.setEndPos(28, 22);
      } else if (x == "4073") {
        Controller.setEndPos(29, 22);
      } else if (x == "4074") {
        Controller.setEndPos(31, 22);
      } else if (x == "4114") {
        Controller.setEndPos(38, 11);
      } else if (x == "4113") {
        Controller.setEndPos(39, 11);
      } else if (x == "4112") {
        Controller.setEndPos(41, 11);
      } else if (x == "4111") {
        Controller.setEndPos(42, 11);
      } else if (x == "4107") {
        Controller.setEndPos(38, 12);
      } else if (x == "4108") {
        Controller.setEndPos(39, 12);
      } else if (x == "4109") {
        Controller.setEndPos(41, 12);
      } else if (x == "4110") {
        Controller.setEndPos(42, 12);
      } else if (x == "4098") {
        Controller.setEndPos(38, 15);
      } else if (x == "4097") {
        Controller.setEndPos(39, 15);
      } else if (x == "4096") {
        Controller.setEndPos(41, 15);
      } else if (x == "4095") {
        Controller.setEndPos(42, 15);
      } else if (x == "4091") {
        Controller.setEndPos(38, 16);
      } else if (x == "4092") {
        Controller.setEndPos(39, 16);
      } else if (x == "4093") {
        Controller.setEndPos(41, 16);
      } else if (x == "4094") {
        Controller.setEndPos(42, 16);
      } else if (x == "4084") {
        Controller.setEndPos(36, 20);
      } else if (x == "4083") {
        Controller.setEndPos(38, 20);
      } else if (x == "4082") {
        Controller.setEndPos(39, 20);
      } else if (x == "4081") {
        Controller.setEndPos(41, 20);
      } else if (x == "4080") {
        Controller.setEndPos(42, 20);
      } else if (x == "4075") {
        Controller.setEndPos(36, 21);
      } else if (x == "4076") {
        Controller.setEndPos(38, 21);
      } else if (x == "4077") {
        Controller.setEndPos(39, 21);
      } else if (x == "4078") {
        Controller.setEndPos(41, 21);
      } else if (x == "4079") {
        Controller.setEndPos(42, 21);
      } else if (x == "4054") {
        Controller.setEndPos(42, 26);
      } else if (x == "4055") {
        Controller.setEndPos(42, 28);
      } else if (x == "4056") {
        Controller.setEndPos(42, 29);
      } else if (x == "4057") {
        Controller.setEndPos(42, 31);
      } else if (x == "4058") {
        Controller.setEndPos(42, 32);
      } else if (x == "4059") {
        Controller.setEndPos(42, 34);
      } else if (x == "4060") {
        Controller.setEndPos(42, 35);
      } else if (x == "4061") {
        Controller.setEndPos(42, 37);
      } else if (x == "4053") {
        Controller.setEndPos(44, 26);
      } else if (x == "4052") {
        Controller.setEndPos(44, 28);
      } else if (x == "4051") {
        Controller.setEndPos(44, 30);
      } else if (x == "4050") {
        Controller.setEndPos(44, 31);
      } else if (x == "4049") {
        Controller.setEndPos(44, 33);
      } else if (x == "4048") {
        Controller.setEndPos(44, 34);
      } else if (x == "4047") {
        Controller.setEndPos(44, 36);
      } else if (x == "4046") {
        Controller.setEndPos(44, 38);
      } else if (x == "4045") {
        Controller.setEndPos(44, 39);
      } else if (x == "4044") {
        Controller.setEndPos(45, 43);
      } else if (x == "4071") {
        Controller.setEndPos(28, 39);
      } else if (x == "4070") {
        Controller.setEndPos(28, 40);
      } else if (x == "4069") {
        Controller.setEndPos(28, 42);
      } else if (x == "4068") {
        Controller.setEndPos(29, 42);
      } else if (x == "4067") {
        Controller.setEndPos(31, 42);
      } else if (x == "4066") {
        Controller.setEndPos(32, 42);
      } else if (x == "4062") {
        Controller.setEndPos(31, 38);
      } else if (x == "4063") {
        Controller.setEndPos(33, 39);
      } else if (x == "4064") {
        Controller.setEndPos(34, 40);
      } else if (x == "4065") {
        Controller.setEndPos(35, 41);
      } else if (x == "4043") {
        Controller.setEndPos(45, 52);
      } else if (x == "4031") {
        Controller.setEndPos(39, 57);
      } else if (x == "4030") {
        Controller.setEndPos(39, 58);
      } else if (x == "4029") {
        Controller.setEndPos(39, 60);
      } else if (x == "4028") {
        Controller.setEndPos(38, 62);
      } else if (x == "4027") {
        Controller.setEndPos(38, 63);
      } else if (x == "4026") {
        Controller.setEndPos(37, 65);
      } else if (x == "4025") {
        Controller.setEndPos(37, 67);
      } else if (x == "4032") {
        Controller.setEndPos(42, 60);
      } else if (x == "4033") {
        Controller.setEndPos(42, 62);
      } else if (x == "4034") {
        Controller.setEndPos(40, 64);
      } else if (x == "4035") {
        Controller.setEndPos(39, 66);
      } else if (x == "4042") {
        Controller.setEndPos(44, 56);
      } else if (x == "4041") {
        Controller.setEndPos(44, 58);
      } else if (x == "4040") {
        Controller.setEndPos(44, 60);
      } else if (x == "4039") {
        Controller.setEndPos(44, 61);
      } else if (x == "4038") {
        Controller.setEndPos(44, 63);
      } else if (x == "4037") {
        Controller.setEndPos(44, 65);
      } else if (x == "4036") {
        Controller.setEndPos(44, 66);
      } else if (x == "4005") {
        Controller.setEndPos(4, 48);
      } else if (x == "4004") {
        Controller.setEndPos(11, 48);
      } else if (x == "4003") {
        Controller.setEndPos(16, 48);
      } else if (x == "4002") {
        Controller.setEndPos(18, 48);
      } else if (x == "4001") {
        Controller.setEndPos(23, 48);
      } else if (x == "4016") {
        Controller.setEndPos(8, 63);
      } else if (x == "4017") {
        Controller.setEndPos(8, 65);
      } else if (x == "4018") {
        Controller.setEndPos(7, 66);
      } else if (x == "4015") {
        Controller.setEndPos(11, 63);
      } else if (x == "4014") {
        Controller.setEndPos(13, 64);
      } else if (x == "4013") {
        Controller.setEndPos(11, 62);
      } else if (x == "4012") {
        Controller.setEndPos(12, 62);
      } else if (x == "4011") {
        Controller.setEndPos(14, 63);
      } else if (x == "4010") {
        Controller.setEndPos(15, 63);
      } else if (x == "4009") {
        Controller.setEndPos(17, 64);
      } else if (x == "4008") {
        Controller.setEndPos(19, 64);
      } else if (x == "4007") {
        Controller.setEndPos(20, 65);
      } else if (x == "4006") {
        Controller.setEndPos(22, 65);
      } else if (x == "4019") {
        Controller.setEndPos(10, 67);
      } else if (x == "4020") {
        Controller.setEndPos(12, 67);
      } else if (x == "4021") {
        Controller.setEndPos(13, 67);
      } else if (x == "4022") {
        Controller.setEndPos(15, 67);
      } else if (x == "4023") {
        Controller.setEndPos(17, 67);
      } else if (x == "4024") {
        Controller.setEndPos(19, 67);
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
