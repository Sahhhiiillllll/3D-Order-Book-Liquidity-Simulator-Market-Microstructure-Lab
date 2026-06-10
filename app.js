const N_PRICE = 60;
const N_TIME = 80;
const PRICE_SPAN = 3.0;

const midPriceInput = document.getElementById('midPrice');
const volatilityInput = document.getElementById('volatility');
const imbalanceInput = document.getElementById('imbalanceIntensity');
const spoofingInput = document.getElementById('spoofing');
const flashCrashInput = document.getElementById('flashCrash');
const simulateButton = document.getElementById('simulateButton');
const animateButton = document.getElementById('animateButton');

const midPriceValue = document.getElementById('midPriceValue');
const volatilityValue = document.getElementById('volatilityValue');
const imbalanceIntensityValue = document.getElementById('imbalanceIntensityValue');
const imbalanceMetricOutput = document.getElementById('imbalanceMetric');
const liquidityDepthOutput = document.getElementById('liquidityDepth');
const marketModeOutput = document.getElementById('marketMode');
const chartElement = document.getElementById('chart');

let autoRotate = false;
let animationTimer = null;
let chartInitialized = false;
let cameraAngle = 0;

function createLinearSpace(start, stop, count) {
  const result = [];
  const step = (stop - start) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    result.push(start + step * i);
  }
  return result;
}

function simulateOrderBook(mid, vol, imb, spoof, crash) {
  const priceGrid = createLinearSpace(mid * (1 - PRICE_SPAN / 100), mid * (1 + PRICE_SPAN / 100), N_PRICE);
  const midIdx = Math.floor(N_PRICE / 2);
  const volumeMatrix = Array.from({ length: N_TIME }, () => Array(N_PRICE).fill(0));

  for (let t = 0; t < N_TIME; t += 1) {
    const swing = Math.sin(t * 0.14) * vol * mid * 0.45;
    const noise = (Math.random() * 2 - 1) * vol * mid * 0.35;
    const midT = mid + swing + noise;
    const sigma = Math.max(0.3, vol * mid);
    const baseVolT = priceGrid.map((price) => Math.exp(-((price - midT) ** 2) / (2 * sigma ** 2)) * 1000);

    const bidVolT = baseVolT.slice(0, midIdx).map((v) => v * (1 + imb));
    const askVolT = baseVolT.slice(midIdx).map((v) => v * (1 - imb));

    if (spoof && t > 10 && t < 30) {
      const spoofIdx = midIdx + Math.floor((Math.random() * 11) - 5);
      if (spoofIdx >= 0 && spoofIdx < N_PRICE) {
        if (spoofIdx < midIdx) {
          bidVolT[spoofIdx] += 5200;
        } else {
          askVolT[spoofIdx - midIdx] += 5200;
        }
      }
    }

    let bidValues = bidVolT.slice();
    let askValues = askVolT.slice();

    if (crash && t > 40 && t < 50) {
      bidValues = bidValues.map((v) => v * 0.08);
      askValues = askValues.map((v) => v * 0.08);
    }

    if (imb > 0.5) {
      bidValues = bidValues.map((v) => v * 1.25);
      askValues = askValues.map((v) => v * 0.75);
    }

    for (let p = 0; p < midIdx; p += 1) {
      volumeMatrix[t][p] = bidValues[p];
    }
    for (let p = midIdx; p < N_PRICE; p += 1) {
      volumeMatrix[t][p] = askValues[p - midIdx];
    }
  }

  return { priceGrid, timeGrid: Array.from({ length: N_TIME }, (_, idx) => idx), volumeMatrix };
}

function computeMetrics(volumeMatrix) {
  const midIdx = Math.floor(N_PRICE / 2);
  let bidSum = 0;
  let askSum = 0;
  let total = 0;

  for (let t = 0; t < N_TIME; t += 1) {
    for (let p = 0; p < N_PRICE; p += 1) {
      const value = volumeMatrix[t][p];
      total += value;
      if (p < midIdx) bidSum += value;
      else askSum += value;
    }
  }

  const imbalance = (bidSum - askSum) / (bidSum + askSum + 1e-6);
  const liquidityDepth = total / (N_PRICE * N_TIME);
  const depthScore = Math.min(100, Math.max(18, (liquidityDepth / 1180) * 100));
  return { imbalance, liquidityDepth, depthScore };
}

function computeMarketMode(imb, spoof, crash) {
  if (crash) return 'Flash crash';
  if (spoof) return 'Spoofing';
  if (imb > 0.35) return 'Bid dominant';
  if (imb < -0.35) return 'Ask dominant';
  return 'Neutral market';
}

function buildSurface(priceGrid, timeGrid, volumeMatrix) {
  return {
    x: priceGrid,
    y: timeGrid,
    z: volumeMatrix,
    type: 'surface',
    colorscale: [
      [0, '#00ffff'],
      [0.16, '#5c4fff'],
      [0.48, '#b22cff'],
      [0.78, '#ff1fe0'],
      [1, '#ff8cff'],
    ],
    showscale: false,
    opacity: 0.96,
    lighting: { ambient: 0.7, diffuse: 0.92, specular: 0.44, roughness: 0.28, fresnel: 0.2 },
    contours: {
      z: {
        show: true,
        start: 80,
        end: 800,
        size: 80,
        color: '#ffffff',
        width: 1,
      },
    },
  };
}

function renderPlot(data) {
  const eye = {
    x: 1.7 * Math.cos(cameraAngle),
    y: 1.7 * Math.sin(cameraAngle),
    z: 1.55,
  };

  const layout = {
    autosize: true,
    margin: { l: 0, r: 0, b: 0, t: 0 },
    paper_bgcolor: 'rgba(4, 7, 16, 0.84)',
    plot_bgcolor: 'rgba(4, 7, 16, 0.84)',
    scene: {
      xaxis: { title: 'Price', backgroundcolor: '#0f1325', gridcolor: '#20294a', zerolinecolor: '#2d3e6f' },
      yaxis: { title: 'Time', backgroundcolor: '#0f1325', gridcolor: '#20294a', zerolinecolor: '#2d3e6f' },
      zaxis: { title: 'Volume', backgroundcolor: '#0f1325', gridcolor: '#20294a', zerolinecolor: '#2d3e6f' },
      camera: { eye, center: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } },
    },
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: false,
  };

  if (chartInitialized) {
    Plotly.react(chartElement, [buildSurface(data.priceGrid, data.timeGrid, data.volumeMatrix)], layout, config);
  } else {
    Plotly.newPlot(chartElement, [buildSurface(data.priceGrid, data.timeGrid, data.volumeMatrix)], layout, config).then(() => {
      chartInitialized = true;
    });
  }
}

function updateValues() {
  midPriceValue.textContent = midPriceInput.value;
  volatilityValue.textContent = Number(volatilityInput.value).toFixed(2);
  imbalanceIntensityValue.textContent = Number(imbalanceInput.value).toFixed(2);
}

function updateSummary(metrics, imb, spoof, crash) {
  imbalanceMetricOutput.textContent = metrics.imbalance.toFixed(3);
  liquidityDepthOutput.textContent = metrics.liquidityDepth.toFixed(1);
  marketModeOutput.textContent = computeMarketMode(imb, spoof, crash);
}

function runSimulation() {
  updateValues();

  const mid = Number(midPriceInput.value);
  const vol = Number(volatilityInput.value);
  const imb = Number(imbalanceInput.value);
  const spoof = spoofingInput.checked;
  const crash = flashCrashInput.checked;

  const data = simulateOrderBook(mid, vol, imb, spoof, crash);
  const metrics = computeMetrics(data.volumeMatrix);

  updateSummary(metrics, imb, spoof, crash);
  renderPlot(data);
}

function rotateCamera() {
  if (!autoRotate || !chartInitialized) return;
  cameraAngle += 0.01;
  const eye = {
    x: 1.7 * Math.cos(cameraAngle),
    y: 1.7 * Math.sin(cameraAngle),
    z: 1.55,
  };
  Plotly.relayout(chartElement, { 'scene.camera.eye': eye });
}

function toggleAnimation() {
  autoRotate = !autoRotate;
  animateButton.textContent = autoRotate ? 'Pause Animation' : 'Animate Market';
  animateButton.classList.toggle('active', autoRotate);
}

function startCameraLoop() {
  if (animationTimer) return;
  animationTimer = setInterval(() => {
    rotateCamera();
  }, 50);
}

midPriceInput.addEventListener('input', updateValues);
volatilityInput.addEventListener('input', updateValues);
imbalanceInput.addEventListener('input', updateValues);
spoofingInput.addEventListener('change', updateValues);
flashCrashInput.addEventListener('change', updateValues);

simulateButton.addEventListener('click', runSimulation);
animateButton.addEventListener('click', toggleAnimation);

window.addEventListener('load', () => {
  runSimulation();
  startCameraLoop();
  autoRotate = true;
  animateButton.textContent = 'Pause Animation';
  animateButton.classList.add('active');
});
