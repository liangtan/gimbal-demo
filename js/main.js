const promises = [];
let initCompleteResolver;

const initComplete = new Promise((resolve) => {
  initCompleteResolver = resolve;
});

document.addEventListener("DOMContentLoaded", () => {
  init();
});

function init() {
  const cubeGimbal = createCube();
  const sphereGimbal = createSphere();

  Promise.all(promises).then(() => {
    setup(cubeGimbal, sphereGimbal);
  });

  document.getElementById("cube-inertia-slider").addEventListener("input", (event) => {
    cubeGimbal.updateConfig("inertia", 1 / parseInt(event.target.value) / 10);
  });

  document.getElementById("sphere-inertia-slider").addEventListener("input", (event) => {
    sphereGimbal.updateConfig("inertia", 1 / parseInt(event.target.value) / 10);
  });

  initComplete.then(removeLoadingScreen);
}

function createCube() {
  let resolver;
  const promise = new Promise((resolve) => (resolver = resolve));
  promises.push(promise);

  updateCubeDimension(
    parseInt(document.getElementById("width-input").value),
    parseInt(document.getElementById("height-input").value),
    parseInt(document.getElementById("length-input").value)
  );

  const cubeGimbal = new Gimbal({
    name: "cube",
    stage: "cube-stage"
  });

  makeGimbalCursorInteractive(document.getElementById("cube"));
  resolver();
  return cubeGimbal;
}

function createSphere() {
  let resolver;
  const promise = new Promise((resolve) => (resolver = resolve));
  promises.push(promise);

  const sphere = document.getElementById("sphere");
  const NUM_LONGITUDE = 16;
  const NUM_LATITUDE = 4;
  const ANGLE = 360 / NUM_LONGITUDE;

  for (let i = 0; i < NUM_LONGITUDE / 2; i++) {
    const slice = document.createElement("div");
    slice.style.transform = `rotateY(${ANGLE * i}deg)`;
    if (ANGLE * i !== 0 && ANGLE * i !== 90) {
      slice.classList.add("sphere-barebone-frame-toggleable", "invisible");
    }
    sphere.appendChild(slice);
  }

  const equator = document.createElement("div");
  equator.classList.add("equator");
  sphere.appendChild(equator);

  for (let i = 1; i <= NUM_LATITUDE; i++) {
    const lat = document.createElement("div");
    lat.classList.add("sphere-barebone-frame-toggleable", "invisible", `latitude-${i}`);
    sphere.appendChild(lat);
  }

  const sphereGimbal = new Gimbal({
    name: "sphere",
    stage: "sphere-stage",
    axis: [0, 0, 0]
  });

  makeGimbalCursorInteractive(sphere);
  resolver();
  return sphereGimbal;
}

function setup(cubeGimbal, sphereGimbal) {
  window.addEventListener("resize", () => {
    cubeGimbal.updatePosition();
    sphereGimbal.updatePosition();
  });

  bindClick("update-button", () => {
    updateCubeDimension(
      parseInt(getVal("width-input")),
      parseInt(getVal("height-input")),
      parseInt(getVal("length-input"))
    );
  });

  bindClick("restore-button", () => {
    setVal("width-input", 300);
    setVal("height-input", 300);
    setVal("length-input", 300);
    updateCubeDimension(300, 300, 300);
  });

  bindClick("cube-explosion", () => {
    const width = parseInt(getVal("width-input"));
    const height = parseInt(getVal("height-input"));
    const length = parseInt(getVal("length-input"));
    const cubeFaces = document.getElementById("cube").children;
    const offset = 60;
    const transitionDuration = 150;

    let numAnimations = 2;

    const animate = () => {
      for (const face of cubeFaces) {
        const id = face.id;

        // The original transform string saved in data attribute
        const originalTransform = face.dataset.originalTransform || "";

        // Calculate explosion transform based on the original rotation + offset
        let explosionTransform = "";

        switch (id) {
          case "top":
            explosionTransform = `rotateX(90deg) translate3d(0px, 0px, ${(length >> 1) + offset}px)`;
            break;
          case "bottom":
            explosionTransform = `rotateX(-90deg) translate3d(0px, 0px, ${(height - (length >> 1)) + offset}px)`;
            break;
          case "front":
            explosionTransform = `translate3d(0px, 0px, ${(length >> 1) + offset}px)`;
            break;
          case "back":
            explosionTransform = `rotateY(180deg) translate3d(0px, 0px, ${(length >> 1) + offset}px)`;
            break;
          case "left":
            explosionTransform = `rotateY(-90deg) translate3d(0px, 0px, ${(length >> 1) + offset}px)`;
            break;
          case "right":
            explosionTransform = `rotateY(90deg) translate3d(0px, 0px, ${(width - (length >> 1)) + offset}px)`;
            break;
        }

        // Animate explosion
        face.style.transition = `transform ${transitionDuration}ms ease-in`;
        face.style.transform = explosionTransform;
      }
      // After animation, restore original transforms
      setTimeout(() => {
        for (const face of cubeFaces) {
          face.style.transform = face.dataset.originalTransform || "";
          face.style.transition = "";
        }

        if (--numAnimations > 0) {
          setTimeout(animate, transitionDuration * 2);
        }
      }, transitionDuration);
    }
    animate();
  });

  bindToggle("cube-allow-interaction", (checked) => {
    checked ? cubeGimbal.activate() : cubeGimbal.deactivate();
  });

  bindToggle("cube-inertia", (checked) => {
    cubeGimbal.updateConfig("hasInertia", checked);
  });

  bindToggle("cube-wireframe", (checked) => {
    const faces = document.getElementById("cube").children;
    for (let face of faces) {
      face.classList.toggle("cube-face-background-color");
      face.style.border = checked
        ? "solid 5px rgba(255, 0, 78, 0.7)"
        : "solid 0px rgba(0, 0, 0, 0)";
    }
  });

  bindToggle("cube-backface-visibility", () => {
    document.querySelectorAll("#cube div").forEach((el) =>
      el.classList.toggle("backface-visibility")
    );
  });

  bindToggle("cube-show-reflection", () => {
    document.getElementById("cube-stage").classList.toggle("cube-reflection");
  });

  bindToggle("sphere-allow-interaction", (checked) => {
    checked ? sphereGimbal.activate() : sphereGimbal.deactivate();
  });

  bindToggle("sphere-inertia", (checked) => {
    sphereGimbal.updateConfig("hasInertia", checked);
  });

  bindToggle("sphere-barebone-frame", () => {
    document
      .querySelectorAll(".sphere-barebone-frame-toggleable")
      .forEach((el) => el.classList.toggle("invisible"));
  });

  bindToggle("sphere-show-reflection", () => {
    document.getElementById("sphere-stage").classList.toggle("sphere-reflection");
  });

  initCompleteResolver();
}

function removeLoadingScreen() {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.transition = "opacity 1s";
    loading.style.opacity = "0";
    setTimeout(() => {
      loading.remove();
    }, 1000);
  }
}

function updateCubeDimension(width, height, length) {
  const top = document.getElementById("top");
  const bottom = document.getElementById("bottom");
  const front = document.getElementById("front");
  const back = document.getElementById("back");
  const left = document.getElementById("left");
  const right = document.getElementById("right");

  const topTransform = `rotateX(90deg) translate3d(0px, 0px, ${length >> 1}px)`;
  const bottomTransform = `rotateX(-90deg) translate3d(0px, 0px, ${height - (length >> 1)}px)`;
  const frontTransform = `translate3d(0px, 0px, ${length >> 1}px)`;
  const backTransform = `rotateY(180deg) translate3d(0px, 0px, ${length >> 1}px)`;
  const leftTransform = `rotateY(-90deg) translate3d(0px, 0px, ${length >> 1}px)`;
  const rightTransform = `rotateY(90deg) translate3d(0px, 0px, ${width - (length >> 1)}px)`;

  // Set styles AND save original transforms as data attributes
  top.style.width = width + "px";
  top.style.height = length + "px";
  top.style.marginLeft = -(width >> 1) + "px";
  top.style.marginTop = -(height >> 1) + "px";
  top.style.transform = topTransform;
  top.dataset.originalTransform = topTransform;

  bottom.style.width = width + "px";
  bottom.style.height = length + "px";
  bottom.style.marginLeft = -(width >> 1) + "px";
  bottom.style.marginTop = -(height >> 1) + "px";
  bottom.style.transform = bottomTransform;
  bottom.dataset.originalTransform = bottomTransform;

  front.style.width = width + "px";
  front.style.height = height + "px";
  front.style.marginLeft = -(width >> 1) + "px";
  front.style.marginTop = -(height >> 1) + "px";
  front.style.transform = frontTransform;
  front.dataset.originalTransform = frontTransform;

  back.style.width = width + "px";
  back.style.height = height + "px";
  back.style.marginLeft = -(width >> 1) + "px";
  back.style.marginTop = -(height >> 1) + "px";
  back.style.transform = backTransform;
  back.dataset.originalTransform = backTransform;

  left.style.width = length + "px";
  left.style.height = height + "px";
  left.style.marginLeft = -(width >> 1) + "px";
  left.style.marginTop = -(height >> 1) + "px";
  left.style.transform = leftTransform;
  left.dataset.originalTransform = leftTransform;

  right.style.width = length + "px";
  right.style.height = height + "px";
  right.style.marginLeft = -(width >> 1) + "px";
  right.style.marginTop = -(height >> 1) + "px";
  right.style.transform = rightTransform;
  right.dataset.originalTransform = rightTransform;
}

function makeGimbalCursorInteractive(element) {
  let isMouseDown = false;
  element.addEventListener("mousedown", () => {
    isMouseDown = true;
    element.style.cursor = "grabbing";
  });
  document.addEventListener("mouseup", () => {
    isMouseDown = false;
    element.style.cursor = "grab";
  });
  element.addEventListener("mouseover", () => {
    if (isMouseDown) {
      element.style.cursor = "grabbing";
    }
  });
  element.addEventListener("mouseleave", () => {
    if (!isMouseDown) {
      element.style.cursor = "grab";
    }
  });
}

// === Utility Helpers ===
function bindClick(id, fn) {
  document.getElementById(id)?.addEventListener("click", fn);
}

function bindToggle(id, fn) {
  document.getElementById(id)?.addEventListener("change", function () {
    fn(this.checked);
  });
}

function getVal(id) {
  return document.getElementById(id).value;
}

function setVal(id, val) {
  document.getElementById(id).value = val;
}