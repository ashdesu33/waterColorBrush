// Water Color brush made by Steve's Makerspace, modified with dynamic gradient
// change color palette below
const palettes = [
  [ "#ff1a1aff", "#FC64DC", "#90E7FF", "#C2F57F", "#FFD944", "#FF7504", 
    "#5980FF", "#D6A7FF", "#172245", "#530B2F","#202B11"
  ]
];


// ------------ Var:UI ---------------
let currentPaletteIndex = 0;      
let palette = palettes[currentPaletteIndex];
let colorButtons = [];
let currentColorIndex = 0;       
let usePaletteGradient = true;    // checkbox toggles this
let gradientToggle;
let selectedButton = null;
let sliderDrops,
  buttonDry,
  buttonWet,
  buttonDefault,
  bgColorPicker,
  colorPicker;
let state;
let gradientMix = 0;
let strokeGradientT = 0;
let strokeActive = false;
let templateSelector;
let currentTemplate = 0; // 0 = none, 1 = template1, 2 = template2
let svg1, svg2;
let bgColor = "#fff"
// ------------ Var:Brush ---------------
let defaultTime = 0.001;
let runnyColors = false;
let backgrd = 255;
let dryTime = defaultTime;

let brushTip;
let brushTipPixels;
let brushTipW, brushTipH;

let paint = [];
let tempPaint1 = [];
let tempPaint2 = [];
let paintC1 = [];
let paintC2 = [];
let gradientFactor = 1;


let prevMouseX, prevMouseY;

let paintLayer; // offscreen 2D buffer for your original code
let webglCanvas; // new WEBGL renderer
let paintColorIndex = [];

let hueShiftSpeed = 0.015;


// ------------ Var:Recording ---------------
let recordedStrokes = [];
let replaying = false;
let replayProgress = 0;
let replayDuration = 300;
let replaySpeedSlider;
let replayPhase = "idle";      
let replayMode = "preview"; 
let replayOpacity = 255;       
let replayTimer = 0;          
let capturer;
let capturingReplay = false;
let replayFrame = 0;


let textArea;
let liveText = "";
let liveFontSize = 300;
let showText = false;

let brushAngle = 0;
let brushStrokeActive = false;

let strokeDistance = 0;          
const strokeGradientLength = 1000; 
let stateButtons = [];
let activeStateButton = null;

const WHITE_HOLD_FRAMES = 18; 



function preload() {
  // customFont = loadFont("ABCGravityVariable-Trial.ttf"); 
  svg1 = loadImage("./template/template_1.svg");
  svg2 = loadImage("./template/template_2.svg");
}

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(640, 800);
  canvas.parent("canvas-container");
  background(backgrd);
  uiPanel();
  initialCanvas();

  // --- create a reusable fluffy brush texture ---
  brushTip = createGraphics(64, 64); // small, cheap; we’ll scale it up when stamping
  brushTip.pixelDensity(1);
  brushTip.clear();
  createFluffyBrushTip();
}

// ------------ DRAW METHOD ---------------

function draw() {
  frameRate(60);


  if (replaying) {

  // ============================
  // EXPORT MODE
  // ============================
  if (replayMode === "export") {

    if (replayPhase === "preDelay") {
      replayTimer++;
      if (replayTimer >= 60) {
        replayPhase = "draw";
        replayTimer = 0;
      }
    }

    else if (replayPhase === "draw") {
      let t = replayProgress / replayDuration;
      let easedT = easeInOut(constrain(t, 0, 1));

      let total = recordedStrokes.length;
      let currentIndex = floor(easedT * total);

      for (let i = replayedUntil; i < currentIndex; i++) {
        let s = recordedStrokes[i];
        sliderDrops.value(s.size);
        renderPoints(s.x, s.y, s.t);
      }

      replayedUntil = currentIndex;
      replayProgress++;

      if (replayedUntil >= total) {
        replayPhase = "postDelay";
        replayTimer = 0;
      }
    }

    else if (replayPhase === "postDelay") {
      replayTimer++;
      if (replayTimer >= 90) {
        replayPhase = "fadeOut";
        replayTimer = 0;
      }
    }

    else if (replayPhase === "fadeOut") {
      replayOpacity = map(replayTimer, 0, 90, 255, 0);
      replayTimer++;

      if (replayTimer >= 90) {
        replayPhase = "whiteHold";   // ← FIX: transition to whiteHold
        replayTimer = 0;             // reset timer for 0.3s hold
      }
    }

    else if (replayPhase === "whiteHold") {
    // show fully white screen for 0.3 seconds
    replayTimer++;
    if (replayTimer >= WHITE_HOLD_FRAMES) {
      replayPhase = "idle";
      replaying = false;
  }
}
  }

  // ============================
  // PREVIEW MODE
  // ============================
  else if (replayMode === "preview") {

    let t = replayProgress / replayDuration;
    let easedT = easeInOut(constrain(t, 0, 1));

    let total = recordedStrokes.length;
    let currentIndex = floor(easedT * total);

    for (let i = replayedUntil; i < currentIndex; i++) {
      let s = recordedStrokes[i];
      sliderDrops.value(s.size);
      renderPoints(s.x, s.y, s.t);
    }

    replayedUntil = currentIndex;
    replayProgress++;

    if (replayedUntil >= total) {
      replaying = false;                  // FINISH clean
      replayPhase = "idle";
    }
  }
}


  // --- NORMAL LIVE DRAWING ---
  else {
    paintDrop = sliderDrops.value();
    addPaint();
  }

  // watercolor diffusion + render
  if (replayPhase !== "fadeOut" && replayPhase !== "whiteHold") {
    update();
    render();
  }

    push();
blendMode(MULTIPLY);
noStroke();
fill(bgColor);
rect(0, 0, width, height);
pop();
blendMode(BLEND);

  // UI text overlay
  addTextToCanvas();
  drawTemplateOverlay();

    // --- APPLY FADE OUT LAYER ---
  // APPLY WHITE OVERLAY IN FADE + HOLD
if (replayPhase === "fadeOut" || replayPhase === "whiteHold") {
  push();
  noStroke();

  if (replayPhase === "fadeOut") {
    // gradually fade to white
    fill(backgrd, 255 - replayOpacity);
  } else {
    // fully white during hold
    fill(backgrd);
  }
  rect(0, 0, width, height);
  pop();
}

  // CAPTURE VIDEO IF RECORDING
  if (capturingReplay) {
    const canvasElement = document.getElementById("defaultCanvas0");
    if (canvasElement) capturer.capture(canvasElement);

    replayFrame++;

    if (replayPhase === "whiteHold" && replayTimer >= (WHITE_HOLD_FRAMES - 5)){
      capturingReplay = false;
      capturer.stop();
      capturer.save();
      replayPhase = "idle";
      replaying = false;
  
    }
  }

}


function createFluffyBrushTip() {
  brushTip.noStroke();

  const w = brushTip.width;
  const h = brushTip.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = min(w, h) * 0.45;
  const noiseScale = 0.15;

  // Draw alpha only: white with varying opacity
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) continue;

      let falloff = 1 - dist / maxR;
      falloff = falloff * falloff; // smooth

      // edge fluff via noise
      let n = noise(x * noiseScale, y * noiseScale);
      falloff *= map(n, 0, 1, 0.7, 1.3);
      falloff = constrain(falloff, 0, 1);

      // watery: low alpha
      const alpha = falloff * 255 * 0.4;

      brushTip.fill(255, 255, 255, alpha); // white; we’ll tint in paint[]
      brushTip.rect(x, y, 1, 1);
    }
  }

  // cache the pixels so we can read alpha when stamping
  brushTip.loadPixels();
  brushTipPixels = brushTip.pixels;
  brushTipW = brushTip.width;
  brushTipH = brushTip.height;
}



function initialCanvas() {
  paint = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      paint.push(backgrd, backgrd, backgrd, 0);
      paintColorIndex.push(undefined);
    }
  }
  tempPaint1 = paint;
  tempPaint2 = paint;
}


///// easing: keep your cosine easing or swap to cubic if you prefer
function easeInOut(t) {
  // cosine ease in/out (smooth)
  return t * t * (3 - 2 * t);
}

function setDryMode(mode) {
  if (mode === "dry") {
    dryTime = 1000;

  } else if (mode === "wet") {
    dryTime = 0.0001;
  } else {
    dryTime = defaultTime;
  }
}

function addPaint() {
  if (
    !mouseIsPressed ||
    mouseX < 0 || mouseX > width ||
    mouseY < 0 || mouseY > height
  ) {
    strokeActive = false;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    return;
  }

  if (!strokeActive || prevMouseX === undefined) {
    strokeActive = true;
    strokeDistance = 0;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    renderPoints(mouseX, mouseY, 0); // t=0 at start of stroke
    return;
  }

  const dx = mouseX - prevMouseX;
  const dy = mouseY - prevMouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const spacing = 4; // px between stamps – lower = smoother, heavier
  const steps = Math.max(1, Math.floor(distance / spacing));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = prevMouseX + dx * t;
    const y = prevMouseY + dy * t;

    const distAlong = strokeDistance + distance * t;
    let strokeT = distAlong / strokeGradientLength;
    strokeT = constrain(strokeT, 0, 1);

    renderPoints(x, y, strokeT);
    if(strokeT >=1){
        gradientFactor *= -1;
    }
    else if(strokeDistance<0){
       gradientFactor *= -1;
    }
  }

  strokeDistance += distance * gradientFactor;
  prevMouseX = mouseX;
  prevMouseY = mouseY;
}


function drawLinePoints(x1, y1, x2, y2, points, baseDist) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segLen = Math.sqrt(dx * dx + dy * dy) || 0.0001;

  for (let i = 0; i <= points; i++) {
    let t = i / points;
    let x = x1 + dx * t;
    let y = y1 + dy * t;

    // distance from stroke start to this sample
    let distAlong = baseDist + segLen * t;
    let strokeT = distAlong / strokeGradientLength; // 0 → 1
    strokeT = constrain(strokeT, 0, 1);

    renderPoints(x, y, strokeT);
  }
}

function renderPoints(cx, cy, strokeT = 0, paletteIndexOverride = null, colorIndexOverride = null, gradientOverride = null) {
  // record for replay
  if (!replaying) {
    recordedStrokes.push({
      x: cx,
      y: cy,
      size: sliderDrops.value(),
      t: strokeT,
      paletteIndex: currentPaletteIndex,
      colorIndex: currentColorIndex,
      useGradient: usePaletteGradient,
    });
  }

  const w = width;
  const h = height;

  // ---- stroke color: from palette (selected + next 2) or flat ----
  const mixCol = getStrokeColorFromPalette(
    strokeT,
    paletteIndexOverride ?? currentPaletteIndex,
    colorIndexOverride ?? currentColorIndex,
    gradientOverride ?? usePaletteGradient
  );

  const rBrush = red(mixCol);
  const gBrush = green(mixCol);
  const bBrush = blue(mixCol);

  // ---- brush size & scaling of tip ----
  const s = sliderDrops.value();         // 0–10
  const baseSize = 35 + s * 8;           // size in canvas pixels
  const halfW = baseSize * 0.5;
  const halfH = baseSize * 0.5;

  // watery: global alpha factor for this stamp
const globalAlphaFactor = 0.5;
let sizePigmentBoost = 0.9;
if (s <= 5){
  sizePigmentBoost = map(s, 0, 5, 5, 1.0);
}
map(s, 0, 10, 2, 1.0);

  // loop over the stamp area on canvas
  const xStart = Math.max(0, Math.floor(cx - halfW));
  const xEnd   = Math.min(w - 1, Math.ceil(cx + halfW));
  const yStart = Math.max(0, Math.floor(cy - halfH));
  const yEnd   = Math.min(h - 1, Math.ceil(cy + halfH));

  for (let px = xStart; px <= xEnd; px++) {
    for (let py = yStart; py <= yEnd; py++) {

      // map this canvas pixel back into the brushTip coordinate
      const u = (px - (cx - halfW)) / baseSize; // 0..1 across stamp
      const v = (py - (cy - halfH)) / baseSize; // 0..1 across stamp

      const tx = Math.floor(u * brushTipW);
      const ty = Math.floor(v * brushTipH);

      if (tx < 0 || tx >= brushTipW || ty < 0 || ty >= brushTipH) continue;

      const tipIdx = (tx + ty * brushTipW) * 4;
      const tipA   = brushTipPixels[tipIdx + 3] / 255.0;  // alpha 0..1

      if (tipA <= 0.01) continue; // nothing from this texel

      const contribution = tipA * globalAlphaFactor * sizePigmentBoost;
      if (contribution <= 0.001) continue;

      const idx = (px + py * w) * 4;

      // blend color into paint[] – keeps your diffusion/drying pipeline
      paint[idx]     = lerp(paint[idx],     rBrush, contribution);
      paint[idx + 1] = lerp(paint[idx + 1], gBrush, contribution);
      paint[idx + 2] = lerp(paint[idx + 2], bBrush, contribution);
      paint[idx + 3] += contribution * paintDrop; // "wetness"/density
    }
  }
}

function update() {
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let arrayPos = (x + y * width) * 4;
      if (paint[arrayPos + 3] > 4) {
        tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - 4;

        // mix pixel to right
        if (x < width - 1) {
          tempPaint1[arrayPos + 4] =
            (paint[arrayPos + 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos + 5] =
            (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos + 6] =
            (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos + 7] = paint[arrayPos + 7] + 1;
        }

        // mix pixel to left
        if (x > 0) {
          tempPaint1[arrayPos - 4] =
            (paint[arrayPos - 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos - 3] =
            (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos - 2] =
            (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos - 1] = paint[arrayPos - 1] + 1;
        }

        // mix pixel below
        tempPaint1[arrayPos + width * 4] =
          (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
        tempPaint1[arrayPos + width * 4 + 1] =
          (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint1[arrayPos + width * 4 + 2] =
          (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint1[arrayPos + width * 4 + 3] =
          paint[arrayPos + width * 4 + 3] + 1;

        // mix pixel above
        tempPaint1[arrayPos - width * 4] =
          (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
        tempPaint1[arrayPos - width * 4 + 1] =
          (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint1[arrayPos - width * 4 + 2] =
          (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint1[arrayPos - width * 4 + 3] =
          paint[arrayPos - width * 4 + 3] + 1;
      }

      // gradually dry paint
      tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
      if (tempPaint1[arrayPos + 3] < 0) {
        tempPaint1[arrayPos + 3] = 0;
      }
    }
  }

  if (runnyColors == true) {
    paint = tempPaint1;
  } else {
    for (let x = width; x > 0; x--) {
      for (let y = height; y > 0; y--) {
        let arrayPos = (x + y * width) * 4;
        if (paint[arrayPos + 3] > 4) {
          tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - 4;

          // mix pixel to right
          if (x < width - 1) {
            tempPaint2[arrayPos + 4] =
              (paint[arrayPos + 4] + paint[arrayPos]) / 2;
            tempPaint2[arrayPos + 5] =
              (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
            tempPaint2[arrayPos + 6] =
              (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
            tempPaint2[arrayPos + 7] = paint[arrayPos + 7] + 1;
          }

          // mix pixel to left
          if (x > 0) {
            tempPaint2[arrayPos - 4] =
              (paint[arrayPos - 4] + paint[arrayPos]) / 2;
            tempPaint2[arrayPos - 3] =
              (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
            tempPaint2[arrayPos - 2] =
              (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
            tempPaint2[arrayPos - 1] = paint[arrayPos - 1] + 1;
          }

          // mix pixel below
          tempPaint2[arrayPos + width * 4] =
            (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos + width * 4 + 1] =
            (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos + width * 4 + 2] =
            (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos + width * 4 + 3] =
            paint[arrayPos + width * 4 + 3] + 1;

          // mix pixel above
          tempPaint2[arrayPos - width * 4] =
            (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos - width * 4 + 1] =
            (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos - width * 4 + 2] =
            (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos - width * 4 + 3] =
            paint[arrayPos - width * 4 + 3] + 1;
        }

        // gradually dry paint
        tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
        if (tempPaint2[arrayPos + 3] < 0) {
          tempPaint2[arrayPos + 3] = 0;
        }
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let arrayPos = (x + y * width) * 4;
        paint[arrayPos] = (tempPaint1[arrayPos] + tempPaint2[arrayPos]) / 2;
      }
    }
  }

  applyDynamicGradient();
}



function render() {
  loadPixels();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let pix = (x + y * width) * 4;
      pixels[pix] = paint[pix];
      pixels[pix + 1] = paint[pix + 1];
      pixels[pix + 2] = paint[pix + 2];
    }
  }
  updatePixels();
}

// ******* Dynamic Gradient Speed *******
function applyDynamicGradient() {
  const gradientStrength = 0.20;
  const diffusion = 0.12;
  const noiseScale = 0.015;
  const paintThreshold = 3;

  const w = width;
  const h = height;

  for (let x = 1; x < w - 1; x++) {
    for (let y = 1; y < h - 1; y++) {

      let i = (x + y * w) * 4;
      if (paint[i + 3] < paintThreshold) continue;

      let c1 = paintC1[x + y * w];
      let c2 = paintC2[x + y * w];
      if (!c1 || !c2) continue;

      // stable turbulence — no flicker spine
      let n = noise(
        x * noiseScale,
        y * noiseScale,
        0.5
      );

      let t = smoothstep(0.0, 1.0, n);

      let targetR = lerp(red(c1), red(c2), t);
      let targetG = lerp(green(c1), green(c2), t);
      let targetB = lerp(blue(c1), blue(c2), t);

      // diffusion
      let avgR = 0, avgG = 0, avgB = 0;
      let count = 0;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          let j = ((x + dx) + (y + dy) * w) * 4;
          avgR += paint[j];
          avgG += paint[j + 1];
          avgB += paint[j + 2];
          count++;
        }
      }

      avgR /= count;
      avgG /= count;
      avgB /= count;

      targetR = lerp(targetR, avgR, diffusion);
      targetG = lerp(targetG, avgG, diffusion);
      targetB = lerp(targetB, avgB, diffusion);

      // fade gradient where pigment is densest (center line fix)
      let alpha = paint[i + 5];
      let densityFade = constrain(map(alpha, 0, 80, 1.0, 0.3), 0.3, 1.0);

      paint[i]     = lerp(paint[i],     targetR, gradientStrength * densityFade);
      paint[i + 1] = lerp(paint[i + 1], targetG, gradientStrength * densityFade);
      paint[i + 2] = lerp(paint[i + 2], targetB, gradientStrength * densityFade);

    }
  }
}

// Smoothstep easing helper
function smoothstep(edge0, edge1, x) {
  x = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}



// ******* UI Panel function *********
function uiPanel() {
  let buttonX = 20;
  let buttonY = 20;
  let buttonSize = 24;

  // Sidebar controls
  const controlDiv = select("#controls");
  
  controlDiv.child(createP("Canvas Background:"));



// --------Background Canvas----------------------
let bgButtons = [];

for (let i = 0; i < palette.length; i++) {
  const c = palette[i];       // original palette color
  const displayColor = hex20Percent(c); // softened for UI

  let btn = createDiv("");

  btn.style("background-color", displayColor);
  btn.style("width", "24px");
  btn.style("height", "24px");
  btn.style("display", "inline-block");
  btn.style("margin-right", "6px");
  btn.style("border", "2px solid #ccc");
  btn.style("border-radius", "6px");
  btn.style("cursor", "pointer");

  btn.mousePressed(() => {
    bgColor = color(hex20Percent(c));   
    highlightBGButton(btn);
  });

  controlDiv.child(btn);
  bgButtons.push(btn);
}

function highlightBGButton(btn) {
  for (let b of bgButtons) {
    b.style("border", "2px solid #ccc");
  }
  btn.style("border", "2px solid black");
}



  
  
// --------Brush Palette----------------------


controlDiv.child(createP("Brush Color:"));

// Color buttons
for (let i = 0; i < palette.length; i++) {
  let btn = createDiv("");
  btn.style("background-color", palette[i].toString());
  btn.style("width", buttonSize + "px");
  btn.style("height", buttonSize + "px");
  btn.style("display", "inline-block");
  btn.style("margin-right", "6px");
  btn.style("border", "2px solid #ccc");
  btn.style("border-radius", "6px");
  btn.style("cursor", "pointer");

  btn.mousePressed(() => {
    const p = palettes[currentPaletteIndex];
    const c = p[i % p.length];

    currentColorIndex = i; // remember which color is selected in the palette
    highlightButton(btn);
  });

  controlDiv.child(btn);
  colorButtons.push(btn);
}
  
  

// helper to re-color buttons when palette changes
function refreshColorButtons() {
  const p = palettes[currentPaletteIndex];
  for (let i = 0; i < colorButtons.length; i++) {
    const c = p[i % p.length];
    colorButtons[i].style("background-color", c.toString());
  }

  // keep currentColorIndex valid for the new palette
  currentColorIndex = currentColorIndex % p.length;
}
  
  
// --------Brush Gradient----------------------

let gradLabel = createP("Stroke Gradient:");
controlDiv.child(gradLabel);

let gradientToggle = createCheckbox("Use selected color", true);
usePaletteGradient = true;
gradientToggle.changed(() => {
  usePaletteGradient = gradientToggle.checked();
});
controlDiv.child(gradientToggle);

  
// --------Bursh Size----------------------

  controlDiv.child(createP("Brush Size:"));
  sliderDrops = createSlider(0, 10, 5);
  controlDiv.child(sliderDrops);

  
  
  // --------Bursh State------------------------
  buttonDry = createButton("Dry All");
  buttonWet = createButton("Keep Wet");
  buttonDefault = createButton("Default Dry");
  controlDiv.child(buttonDry);
  controlDiv.child(buttonWet);
  controlDiv.child(buttonDefault);
  stateButtons.push(buttonDry, buttonWet, buttonDefault);

  buttonDry.mousePressed(() => {
  setDryMode("dry");
  highlightStateButton(buttonDry);
});

buttonWet.mousePressed(() => {
  setDryMode("wet");
  highlightStateButton(buttonWet);
});

buttonDefault.mousePressed(() => {
  setDryMode("default");
  highlightStateButton(buttonDefault);
});
  
// --------Add Text------------------------
// controlDiv.child(createP("Add Text:"));
// textArea = createElement("textarea", "");
// textArea.attribute("rows", "3");
// textArea.attribute("placeholder", "Type text here...");
// textArea.style("width", "100%");
// textArea.style("resize", "vertical");
// controlDiv.child(textArea);

// // update text live while typing
// textArea.input(() => {
//   liveText = textArea.value();
//   showText = true;
// });

// --------Text Template------------------------

  templateSelector = createSelect();
  templateSelector.option("No Template", 0);
  templateSelector.option("Template 1", 1);
  templateSelector.option("Template 2", 2);

  templateSelector.changed(() => {
    currentTemplate = int(templateSelector.value());
  });

  controlDiv.child(createP("Text Template:"));
  controlDiv.child(templateSelector);
  
// --------Replay Animation------------------------
  replaySpeedSlider = createSlider(60, 1800, 300); // 1–30 seconds range
  controlDiv.child(createP("Replay Duration:"));
  controlDiv.child(replaySpeedSlider);

  let replayButton = createButton("Replay Animation");
  controlDiv.child(replayButton);
  replayButton.mousePressed(() => {
    startReplay();
  });
  
  let exportReplayButton = createButton("Export Replay Video");
exportReplayButton.mousePressed(() => {
  startReplayRecording();
});
controlDiv.child(exportReplayButton);

  
// --------Export Image------------------------
  exportButton = createButton("Export Image");
  exportButton.mousePressed(() => {
    // save as PNG with transparency
    saveCanvas("my_painting", "png");
  });
  controlDiv.child(exportButton);

}



// ******* helper UI function *********
function highlightButton(btn) {
  clearHighlight();
  btn.style("border", "2px solid black");
  selectedButton = btn;
}
function clearHighlight() {
  if (selectedButton) {
    selectedButton.style("border", "2px solid #ccc");
  }
}
///// updated startReplay
function startReplay() {
  if (recordedStrokes.length === 0) return;

  replayMode = "preview";                 // <— important
  replayDuration = replaySpeedSlider.value();

  background(backgrd);
  initialCanvas();

  replaying = true;
  replayPhase = "draw";                   // <— preview starts immediately
  replayProgress = 0;
  replayedUntil = 0;
  replayOpacity = 255;
  replayTimer = 0;
}




function getGradientColor() {
  const p = palettes[currentPaletteIndex];
  const n = p.length;
  if (n === 0) return color(0);

  // selected base color
  const baseIndex = currentColorIndex % n;
  const baseColor = color(p[baseIndex]);

  // handle stroke state
  if (!strokeActive && mouseIsPressed) {
    // lock a value for this stroke so it doesn't flicker each frame
    strokeGradientT = sin(frameCount * 0.02) * 0.5 + 0.5; // 0..1
    strokeActive = true;
  }

  if (!mouseIsPressed) {
    strokeActive = false;
  }

  // no gradient: just the base color
  if (!usePaletteGradient) {
    return baseColor;
  }

  // gradient: base + next + next-next
  const c1 = color(p[(baseIndex + 1) % n]);
  const c2 = color(p[(baseIndex + 2) % n]);

  let t = constrain(strokeGradientT, 0, 1);

  // 0..0.5: base -> c1, 0.5..1: c1 -> c2
  if (t < 0.5) {
    let tt = t / 0.5;
    return lerpColor(baseColor, c1, tt);
  } else {
    let tt = (t - 0.5) / 0.5;
    return lerpColor(c1, c2, tt);
  }
}


function addTextToCanvas() {
if (showText && liveText.trim() !== "") {
  push();
  textAlign(CENTER, CENTER);
  fill('#000');
  noStroke();

  let maxWidth = width * 0.8;
  let maxHeight = height * 0.8;
  let baseSize = 300;
  let minSize = 10;
  let currentSize = baseSize;
  let wrapped = "";

  // initial split (manual line breaks preserved)
  let paragraphs = liveText.split("\n");

  // --- find if any single word is too wide ---
  let longestWord = "";
  for (let p of paragraphs) {
    let words = p.split(/\s+/);
    for (let w of words) {
      if (w.length > 0 && textWidth(w) > textWidth(longestWord)) {
        longestWord = w;
      }
    }
  }

  // --- dynamically shrink font until longest word fits ---
  textSize(currentSize);
  while (currentSize > minSize && textWidth(longestWord) > maxWidth) {
    currentSize -= 2;
    textSize(currentSize);
  }

  textSize(currentSize);
  textLeading(currentSize * 0.8);

  // --- word wrapping for normal spaces ---
  for (let p of paragraphs) {
    let words = p.split(/\s+/);
    let currentLine = "";
    for (let w of words) {
      let testLine = currentLine === "" ? w : currentLine + " " + w;
      if (textWidth(testLine) < maxWidth) {
        currentLine = testLine;
      } else {
        wrapped += currentLine + "\n";
        currentLine = w;
      }
    }
    wrapped += currentLine + "\n";
  }

  let lines = wrapped.trim().split("\n");
  let lineHeight = currentSize * 0.8;
  let totalHeight = lines.length * lineHeight;

  // --- draw centered ---
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], width / 2, height / 2 - totalHeight / 2 + i * lineHeight);
  }

  pop();
}
}

function getStrokeColorFromPalette(t, paletteIndex = currentPaletteIndex, colorIndex = currentColorIndex, gradientFlag = usePaletteGradient) {
  const p = palettes[paletteIndex];
  const n = p.length;
  if (!p || n === 0) return color(0);

  // base = currently selected color in that palette
  const baseIndex = ((colorIndex % n) + n) % n;
  const base = color(p[baseIndex]);

  // no gradient: just flat color
  if (!gradientFlag || n < 3) {
    return base;
  }

  // gradient: base + next + next-next (wrap)
  const c1 = color(p[(baseIndex + 1) % n]);
  const c2 = color(p[(baseIndex + 2) % n]);

  let tt = constrain(t, 0, 1);

  // 0..0.5: base -> c1, 0.5..1: c1 -> c2
  if (tt < 0.5) {
    return lerpColor(base, c1, tt / 0.5);
  } else {
    return lerpColor(c1, c2, (tt - 0.5) / 0.5);
  }
}

function bakeTextToCanvas() {
  if (liveText.trim() === "") return;

  push();
  textAlign(CENTER, CENTER);
  textSize(liveFontSize);
  textLeading(liveFontSize * 1.2);
  fill(getGradientColor());
  noStroke();

  let maxWidth = width * 0.8;
  let words = liveText.split(/\s+/);
  let wrapped = "";
  let currentLine = "";

  for (let w of words) {
    let testLine = currentLine === "" ? w : currentLine + " " + w;
    if (textWidth(testLine) < maxWidth) {
      currentLine = testLine;
    } else {
      wrapped += currentLine + "\n";
      currentLine = w;
    }
  }
  wrapped += currentLine;

  let lines = wrapped.split("\n");
  let lineHeight = liveFontSize * 1.2;
  let totalHeight = lines.length * lineHeight;

  for (let i = 0; i < lines.length; i++) {
    text(lines[i], width / 2, height / 2 - totalHeight / 2 + i * lineHeight);
  }
  pop();

  // merge into existing paint pixels
  loadPixels();
  updatePixels();

  // reset live text
  showText = false;
  textArea.value("");
  liveText = "";
}


function startReplayRecording() {
  if (recordedStrokes.length === 0) return;

  replayMode = "export";                  // <— important
  replayDuration = replaySpeedSlider.value();

  capturer = new CCapture({ format:"webm", framerate:60, quality:100 });

  background(backgrd);
  initialCanvas();

  replaying = true;
  replayPhase = "preDelay";               // <— export has preDelay
  replayProgress = 0;
  replayedUntil = 0;
  replayOpacity = 255;
  replayTimer = 0;

  capturingReplay = true;
  capturer.start();
}



function highlightStateButton(btn) {
  // turn off highlight for all state buttons
  for (let b of stateButtons) {
    b.style("background-color", "#ffffff");
    b.style("color", "#000000");
    b.style("border", "1px solid #ccc");
  }

  // highlight selected one
  btn.style("background-color", "#000000");
  btn.style("color", "#ffffff");
  btn.style("border", "1px solid #000000");

  activeStateButton = btn;
}


function hex20Percent(hex) {
  const c = color(hex);
  const o = 0.2; // 20% opacity flattened onto white

  const R = red(c)   * o + 255 * (1 - o);
  const G = green(c) * o + 255 * (1 - o);
  const B = blue(c)  * o + 255 * (1 - o);

  return rgbToHex(R, G, B);
}

// helper to convert color
function rgbToHex(r, g, b) {
  const toHex = v => {
    v = Math.round(v);
    return ("0" + v.toString(16)).slice(-2);
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}


function drawTemplateOverlay() {
  if (currentTemplate === 0) return;

  let img;
  if (currentTemplate === 1) img = svg1;
  if (currentTemplate === 2) img = svg2;

  if (!img) return;

  // --- SCALE TO FIT CANVAS ---
  let scaleFactor = Math.min(
    width / img.width,
    height / img.height
  );

  let newW = img.width * scaleFactor;
  let newH = img.height * scaleFactor;

  // --- CENTER POSITION ---
  let x = (width - newW) / 2;
  let y = 0;

  // --- DRAW IMAGE ON TOP ---
  image(img, x, y, newW, newH);
}



