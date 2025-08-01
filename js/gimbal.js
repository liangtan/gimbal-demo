// customizable
const FPS = 60;
const INERTIA = 0.01; // lower the value, higher the inertia

const isTouchScreen = touchScreenDetection();

const Gimbal = function (config) {
  this.config = {};
  this.gimbal = null;
  this.setup(config);
};

Gimbal.prototype.setup = function (config) {
  let timer;
  let requestAnimFrame;
  let cancelAnimFrame;

  requestAnimFrame = function (callback) {
    timer = setTimeout(callback, Math.round(1000 / FPS));
    window.requestAnimationFrame || timer;
  };

  cancelAnimFrame = function () {
    window.CancelRequestAnimationFrame || clearTimeout(timer);
  };

  const self = this;
  this.config = config;
  let gimbal;
  let radius;         // radius of virtual gimbal
  let stage;          // the DOM-container of our "rotatable" element
  let axis = [];        // The rotation-axis
  let mouseDownVector = []; // Vector on mousedown
  let startMatrix = [];   // Transformation-matrix at the moment of *starting* dragging

  let stageWidth, stageHeight;
  let oldAngle, currentAngle;
  let oldTime, currentTime;
  let initialTransform;
  let inertiaDecrement;
  let delta = 0;

  stage = document.getElementById(config.stage);
  if (stage === null) {
    console.error(stage, "Element of id: \"" + config.stage + "\" does not exist!");
    return;
  }

  this.stage = stage;
  this.stagePosition = getOffsetPosition(stage);
  currentAngle = config.angle || 0;
  config.hasInertia = config.hasInertia || true;
  config.inertia ||= INERTIA;

  stageWidth = stage.offsetWidth >> 1;
  stageHeight = stage.offsetHeight >> 1;
  radius = stageHeight < stageWidth ? stageHeight : stageWidth;

  gimbal = stage.querySelector(".gimbal");
  if (gimbal === null) {
    // parse viewport. The first element node will be gimbal
    let child;
    for (let i = 0; i < stage.childNodes.length; i++) {
      child = stage.childNodes[i];

      if (child.nodeType === 1) {
        gimbal = child;
        break;
      }
    }

    if (gimbal === null) {
      console.error(gimbal, "Stage does not have any children");
      return;
    }
  }
  this.gimbal = gimbal;

  if (config.perspective) {
    stage.style.perspective = config.perspective;
  } else if (!stage.style.perspective) {
    stage.style.perspective = "1000px";
  }

  if (config.perspectiveOrigin) {
    stage.style.perspectiveOrigin = config.perspectiveOrigin;
  } else if (!stage.style.perspectiveOrigin) {
    stage.style.perspectiveOrigin = "50% 50%";
  }

  if (config.transform) {
    initialTransform = config.transform;
    gimbal.style.transform = initialTransform;
  }

  //Let's define the start values. If "conf" contains angle or perspective or vector, use them.
  //If not, look for css3d transforms within the CSS.
  //If this fails, let's use some default values.

  if (config.axis || config.angle) {
    axis = config.axis || [0, 0, 0];
    axis = normalizeVector(axis);
    currentAngle = config.angle || 0;

    startMatrix = calculateMatrix(axis, currentAngle);
  } else if (initialTransform) {
    //already css3d transforms on element?
    startMatrix = initialTransform.split(",");

    //Under certain circumstances some browsers report 2d Transforms.
    //Translate them to 3d:
    if (/matrix3d/gi.test(startMatrix[0])) {
      startMatrix[0] = startMatrix[0].replace(/(matrix3d\()/g, "");
      startMatrix[15] = startMatrix[15].replace(/\)/g, "");
    } else {
      startMatrix[0] = startMatrix[0].replace(/(matrix\()/g, "");
      startMatrix[5] = startMatrix[5].replace(/\)/g, "");
      startMatrix.splice(2, 0, 0, 0);
      startMatrix.splice(6, 0, 0, 0);
      startMatrix.splice(8, 0, 0, 0, 1, 0);
      startMatrix.splice(14, 0, 0, 1);
    }

    for (let i = 0; i < startMatrix.length; i++) {
      startMatrix[i] = parseFloat(startMatrix[i]);
    }
  } else {
    axis = [0, 0, 0];
    currentAngle = 0;
    startMatrix = calculateMatrix(axis, currentAngle);
  }

  gimbal.style.transform = "matrix3d(" + startMatrix + ")";
  bindEvent(gimbal, "touchstart", startRotation);
  self.eventHandlers = [startRotation, rotate, finishRotation];

  // mousedown
  function startRotation(event) {
    event.preventDefault();

    if (delta !== 0) {
      stopInertia();
    };

    mouseDownVector = calculateVectorZ(getCoords(event), self.stagePosition, radius);
    oldTime = currentTime = new Date().getTime();
    oldAngle = currentAngle;

    bindEvent(gimbal, "touchstart", startRotation, "remove");
    bindEvent(document, "touchmove", rotate);
    bindEvent(document, "touchend", finishRotation);
  }

  // mousemove
  function rotate(event) {
    event.preventDefault();
    let mouseMoveVector = [];

    oldTime = currentTime;
    oldAngle = currentAngle;

    // Calculate the currrent z-component of the 3d-vector on the virtual gimbal
    mouseMoveVector = calculateVectorZ(getCoords(event), self.stagePosition, radius);

    // We already calculated the z-vector-component on mousedown and the z-vector-component during mouse-movement.
    // We will use them to retrieve the current rotation-axis
    // (the normal-vector perpendiular to mouseDownVect and mouseMoveVect).
    axis[0] = mouseDownVector[1] * mouseMoveVector[2] - mouseDownVector[2] * mouseMoveVector[1];
    axis[1] = mouseDownVector[2] * mouseMoveVector[0] - mouseDownVector[0] * mouseMoveVector[2];
    axis[2] = mouseDownVector[0] * mouseMoveVector[1] - mouseDownVector[1] * mouseMoveVector[0];
    axis = normalizeVector(axis);

    // Now that we have the normal, we need the angle of the rotation.
    // Easy to find by calculating the angle between mouseDownVect and mouseMoveVect:
    currentAngle = calculateAngle(mouseDownVector, mouseMoveVector);
    currentTime = new Date().getTime();

    //Only one thing left to do: Update the position of the box by applying a new transform:
    // 2 transforms will be applied: the current rotation 3d and the start-matrix
    gimbal.style.transform = "rotate3d(" + axis + "," + currentAngle + "rad) matrix3d(" + startMatrix + ")";
  }

  // mouseup
  function finishRotation(event) {
    bindEvent(gimbal, "touchstart", startRotation);
    bindEvent(document, "touchmove", rotate, "remove");
    bindEvent(document, "touchend", finishRotation, "remove");

    calculateInertia();

    if (config.hasInertia && delta > 0) {
      inertia();
    } else if (!(isNaN(axis[0]) || isNaN(axis[1]) || isNaN(axis[2]))) {
      stopInertia();
    }
  }

  function calculateInertia() {
    const dw = currentAngle - oldAngle;
    const dt = currentTime - oldTime;

    delta = Math.abs(dw * 21 / dt);

    if (isNaN(delta)) {
      delta = 0;
    } else if (delta > 0.2) {
      delta = 0.2;
    }
  }

  function inertia() {
    currentAngle += delta;
    inertiaDecrement = config.inertia * Math.sqrt(delta);
    delta = delta > 0 ? delta - inertiaDecrement : 0;
    delta === 0 ? stopInertia() : requestAnimFrame(inertia);
    // delta === 0 ? stopInertia() : inertia();

    gimbal.style.transform = "rotate3d(" + axis + "," + currentAngle + "rad) matrix3d(" + startMatrix + ")";
  }

  function stopInertia() {
    cancelAnimFrame(inertia);
    cleanupMatrix();
    oldAngle = 0;
    currentAngle = 0;
    delta = 0;
  }

  // Clean up when finishing rotation. Only thing to do: create a new "initial" matrix for the next rotation.
  // If we don't, the object will flip back to the position at launch every time the user starts dragging.
  // Therefore we must:
  // 1. calculate a matrix from axis and the current angle
  // 2. Create a new startmatrix by combining current startmatrix and stopmatrix to a new matrix.
  // Matrices can be combined by multiplication, so what are we waiting for?
  function cleanupMatrix() {
    const stopMatrix = calculateMatrix(axis, currentAngle);
    startMatrix = multiplyMatrix(startMatrix, stopMatrix);
  }
}

Gimbal.prototype.activate = function () {
  if (this.gimbal !== null) {
    bindEvent(this.gimbal, "touchstart", this.eventHandlers[0]);
    bindEvent(document, "touchmove", this.eventHandlers[1], "remove");
    bindEvent(document, "touchend", this.eventHandlers[2], "remove");
  }
}

Gimbal.prototype.deactivate = function () {
  if (this.gimbal !== null) {
    bindEvent(this.gimbal, "touchstart", this.eventHandlers[0], "remove");
    bindEvent(document, "touchmove", this.eventHandlers[1], "remove");
    bindEvent(document, "touchend", this.eventHandlers[2], "remove");
  }
}

Gimbal.prototype.updateConfig = function (prop, val) {
  this.config[prop] = val;
}

Gimbal.prototype.updatePosition = function (newPosition) {
  this.stagePosition = getOffsetPosition(this.stage);
}



//================
// util functions
//================

// Normalization recalculates all coordinates in a way that the resulting vector has a length of "1"
// We achieve this by dividing the x, y and z-coordinates by the vector's length
function normalizeVector(vector) {
  const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);

  if (length !== 0) {
    vector[0] /= length;
    vector[1] /= length;
    vector[2] /= length;
  }

  // var length = 0;
  // var i;

  // for(i = 0; i < vector.length; i++){
  //  length += Math.pow(vector[i], 2);
  // }

  // length = Math.sqrt(length);

  // if(length !== 0){
  //  for(i = 0; i < vector.length; i++){
  //    vector[i] /= length;
  //  }
  // }

  return vector;
}

function getCoords(event) {
  let x;
  let y;

  if (event.type.indexOf("mouse") > -1) {
    x = event.pageX;
    y = event.pageY;
  } else if (event.type.indexOf("touch") > -1) {
    // register only the first finger
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      x = touch.pageX;
      y = touch.pageY;
    }
  }

  return [x, y];
}


// This function will calculate a z-component for our 3D-vector from the mouse x and y-coordinates
// (the corresponding point on our virtual gimbal)
function calculateVectorZ(coords, pos, radius) {
  const x = coords[0] - pos[0];
  const y = coords[1] - pos[1];
  const vector = [x / radius - 1, y / radius - 1];
  const z = 1 - vector[0] * vector[0] - vector[1] * vector[1];

  // Make sure that dragging stops when z gets a negative value:
  vector[2] = z > 0 ? Math.sqrt(z) : 0;

  return vector;
}

// Calculate the angle between 2 vectors
function calculateAngle(vector1, vector2) {
  const numerator = vector1[0] * vector2[0] + vector1[1] * vector2[1] + vector1[2] * vector2[2];
  const denominator = Math.sqrt(vector1[0] * vector1[0] + vector1[1] * vector1[1] + vector1[2] * vector1[2]) * Math.sqrt(vector2[0] * vector2[0] + vector2[1] * vector2[1] + vector2[2] * vector2[2]);
  let angle = Math.acos(numerator / denominator);

  if (isNaN(angle)) {
    angle = 0;
  }

  return angle;
}

// calculate transformation-matrix from a vector[x, y, z] and an angle
function calculateMatrix(vector, angle) {
  const x = vector[0];
  const y = vector[1];
  const z = vector[2];
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const cosmin = 1 - cos;
  const matrix = [
    (cos + x * x * cosmin), (y * x * cosmin + z * sin), (z * x * cosmin - y * sin), 0,
    (x * y * cosmin - z * sin), (cos + y * y * cosmin), (z * y * cosmin + x * sin), 0,
    (x * z * cosmin + y * sin), (y * z * cosmin - x * sin), (cos + z * z * cosmin), 0,
    0, 0, 0, 1
  ];

  return matrix;
}

// Matrix-multiplication.
function multiplyMatrix(m1, m2) {
  const matrix = [];

  matrix[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8] + m1[3] * m2[12];
  matrix[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9] + m1[3] * m2[13];
  matrix[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10] + m1[3] * m2[14];
  matrix[3] = m1[0] * m2[3] + m1[1] * m2[7] + m1[2] * m2[11] + m1[3] * m2[15];
  matrix[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8] + m1[7] * m2[12];
  matrix[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9] + m1[7] * m2[13];
  matrix[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10] + m1[7] * m2[14];
  matrix[7] = m1[4] * m2[3] + m1[5] * m2[7] + m1[6] * m2[11] + m1[7] * m2[15];
  matrix[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8] + m1[11] * m2[12];
  matrix[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9] + m1[11] * m2[13];
  matrix[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10] + m1[11] * m2[14];
  matrix[11] = m1[8] * m2[3] + m1[9] * m2[7] + m1[10] * m2[11] + m1[11] * m2[15];
  matrix[12] = m1[12] * m2[0] + m1[13] * m2[4] + m1[14] * m2[8] + m1[15] * m2[12];
  matrix[13] = m1[12] * m2[1] + m1[13] * m2[5] + m1[14] * m2[9] + m1[15] * m2[13];
  matrix[14] = m1[12] * m2[2] + m1[13] * m2[6] + m1[14] * m2[10] + m1[15] * m2[14];
  matrix[15] = m1[12] * m2[3] + m1[13] * m2[7] + m1[14] * m2[11] + m1[15] * m2[15];

  return matrix;
}

function bindEvent(target, type, callback, action = "add") {
  const canTouch = "ontouchstart" in window;
  const mouseEvs = ["mousedown", "mouseup", "mousemove"];
  const touchEvs = ["touchstart", "touchend", "touchmove"];
  let eventType = type || "touchend";

  eventType = canTouch ? eventType : mouseEvs[touchEvs.indexOf(type)];
  target[action + "EventListener"](eventType, callback, { passive: false });
}


function getOffsetPosition(element) {
  let left = 0;
  let top = 0;

  if (element.offsetParent) {
    do {
      left += element.offsetLeft;
      top += element.offsetTop;
    } while (element = element.offsetParent);
  }

  return [left, top];
}

function touchScreenDetection() {
  return "ontouchstart" in window;
}
