import * as paper from "paper";
import * as SimplexNoise from "simplex-noise";

import "../sass/style.scss";

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("mousemove", (e) => {
  current.x = e.clientX;
  current.y = e.clientY;
});

// Current position of mouse
const current = {
  x: 0,
  y: 0,
};
// Previous position of mouse
const previous = {
  x: 0,
  y: 0,
};
// Current position of anchor
const anchor = {
  x: 0,
  y: 0,
};
// Specifies width and height (in pixels) of the outer cursor
// when it is large
const anchorBounds = {
  width: 75,
  height: 75,
};
let isAnchored = false; // is mouse anchored to a link
let isVisible = false; // is mouse cursor visible
let isNoisy = false; // is outer mouse cursor noisy
const noiseScale = 150; // speed of distortion
const noiseRange = 4; // range of distortion
const cursorRadius = 15; // radius of outer cursor when small

function init() {
  const innerCursor: HTMLElement = document.querySelector(".cursor--small"); // inner cursor

  initCanvas();
  initAnchors();

  const render = () => {
    innerCursor.style.transform = `translate(${current.x}px, ${current.y}px)`;

    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

function initCanvas() {
  const canvas: HTMLCanvasElement = document.querySelector(".cursor--canvas"); // outer cursor
  paper.setup(canvas);

  // Create outer cursor shape
  const polygon = new paper.Path.RegularPolygon(
    new paper.Point(0, 0),
    6, // segments
    cursorRadius // radius (in pixels)
  );
  polygon.strokeColor = new paper.Color(255, 0, 0, 0.5);
  polygon.strokeWidth = 1;
  polygon.smooth();

  const group = new paper.Group([polygon]);
  group.applyMatrix = false;

  // Linear interpolation function
  const lerp = (a: number, b: number, n: number) => {
    return (1 - n) * a + n * b;
  };

  // Maps a value belonging to a range (in_min to in_max) to another range (out_min to out_max)
  // https://stackoverflow.com/a/5732390
  const map = (
    value: number,
    in_min: number,
    in_max: number,
    out_min: number,
    out_max: number
  ) => {
    return (
      ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
    );
  };

  const noiseObjects = polygon.segments.map(() => new SimplexNoise());
  let segmentCoordinates = []; // segment coords for outer cursor
  paper.view.onFrame = (event) => {
    // Under the hood, onFrame calls requestAnimationFrame()
    if (!isAnchored) {
      // Move the outer cursor 20% of the distance between its current
      // position and previous position per frame
      previous.x = lerp(previous.x, current.x, 0.2);
      previous.y = lerp(previous.y, current.y, 0.2);
      group.position = new paper.Point(previous.x, previous.y);
    } else {
      previous.x = lerp(previous.x, anchor.x, 0.2);
      previous.y = lerp(previous.y, anchor.y, 0.2);
      group.position = new paper.Point(previous.x, previous.y);
    }

    // If outer cursor is anchored and is small
    if (isAnchored && polygon.bounds.width < anchorBounds.width) {
      // Scale up the shape a little bit every frame
      polygon.scale(1.08);
    } else if (!isAnchored && polygon.bounds.width > cursorRadius*2) {
      // If outer cursor is not anchored and is large (scaled up)
      if (isNoisy) {
        // If outer cursor is noisy, remove its noise
        polygon.segments.forEach((segment, i) => {
          segment.point.set(segmentCoordinates[i][0], segmentCoordinates[i][1]);
        });
        isNoisy = false;
        segmentCoordinates = [];
      }

      // Reset outer cursor size
      const scaleDown = 0.92;
      polygon.scale(scaleDown);
    }

    // If outer cursor is anchored and is large
    if (isAnchored && polygon.bounds.width >= anchorBounds.width) {
      isNoisy = true;

      // Store segment coordinates of outer cursor
      if (segmentCoordinates.length === 0) {
        polygon.segments.forEach((segment, i) => {
          segmentCoordinates[i] = [segment.point.x, segment.point.y];
        });
      }

      // Calculate noise value for each point at that frame
      polygon.segments.forEach((segment, i) => {
        const noiseX = noiseObjects[i].noise2D(event.count / noiseScale, 0);
        const noiseY = noiseObjects[i].noise2D(event.count / noiseScale, 1);

        const distortionX = map(noiseX, -1, 1, -noiseRange, noiseRange);
        const distortionY = map(noiseY, -1, 1, -noiseRange, noiseRange);

        const newX = segmentCoordinates[i][0] + distortionX;
        const newY = segmentCoordinates[i][1] + distortionY;

        segment.point.set(newX, newY);
      });
    }
    polygon.smooth();
  };
}

function initAnchors() {
  const handleMouseEnter = (e) => {
    const navItem = e.currentTarget;
    const navItemBox = navItem.getBoundingClientRect();
    // Get the coordinates of the center of the link being hovered
    anchor.x = Math.round(navItemBox.left + navItemBox.width / 2);
    anchor.y = Math.round(navItemBox.top + navItemBox.height / 2);
    isAnchored = true;
  };

  const handleMouseLeave = () => {
    isAnchored = false;
  };

  const linkItems = document.querySelectorAll(".link");
  linkItems.forEach((item) => {
    item.addEventListener("mouseenter", handleMouseEnter);
    item.addEventListener("mouseleave", handleMouseLeave);
  });
}
