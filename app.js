const N_PRICE = 60;
const N_TIME = 80;
const PRICE_SPAN = 3.0;

const midPriceInput = document.getElementById('midPrice');
const volatilityInput = document.getElementById('volatility');
const imbalanceInput = document.getElementById('imbalanceIntensity');
const spoofingInput = document.getElementById('spoofing');
const flashCrashInput = document.getElementById('flashCrash');
const simulateButton = document.getElementById('simulateButton');

const midPriceValue = document.getElementById('midPriceValue');
const volatilityValue = document.getElementById('volatilityValue');
const imbalanceIntensityValue = document.getElementById('imbalanceIntensityValue');
const imbalanceMetricOutput = document.getElementById('imbalanceMetric');
const liquidityDepthOutput = document.getElementById('liquidityDepth');
const chartElement = document.getElementById('chart');

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
    const midT = mid + (Math.random() * 2 - 1) * vol * mid;
    const baseVolT = priceGrid.map((price) => Math.exp(-((price - midT) ** 2) / (2 * (vol * mid) ** 2)) * 1000);

    const bidVolT = baseVolT.slice(0, midIdx).map((v) => v * (1 + imb));
    const askVolT = baseVolT.slice(midIdx).map((v) => v * (1 - imb));

    if (spoof && t > 10 && t < 30) {
      const spoofIdx = midIdx + Math.floor((Math.random() * 11) - 5);
      if (spoofIdx >= 0 && spoofIdx < N_PRICE) {
        if (spoofIdx < midIdx) {
          bidVolT[spoofIdx] += 5000;
        } else {
          askVolT[spoofIdx - midIdx] += 5000;
        }
      }
    }

    let bidValues = bidVolT.slice();
    let askValues = askVolT.slice();

    if (crash && t > 40 && t < 50) {
      bidValues = bidValues.map((v) => v * 0.1);
      askValues = askValues.map((v) => v * 0.1);
    }

    if (imb > 0.5) {
      bidValues = bidValues.map((v) => v * 1.3);
      askValues = askValues.map((v) => v * 0.7);
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
  return { imbalance, liquidityDepth: total / (N_PRICE * N_TIME) };
}

function buildSurface(priceGrid, timeGrid, volumeMatrix) {
  return {
    x: priceGrid,
    y: timeGrid,
    z: volumeMatrix,
    type: 'surface',
    colorscale: 'Viridis',
    showscale: false,
    opacity: 0.96,
    lighting: { ambient: 0.8, diffuse: 0.9, specular: 0.5, roughness: 0.3 },
  };
}

function renderPlot(data, mid, vol, imb, spoof, crash) {
  const layout = {
    autosize: true,
    margin: { l: 0, r: 0, b: 0, t: 0 },
    paper_bgcolor: '#181825',
    plot_bgcolor: '#181825',
    scene: {
      xaxis: { title: 'Price', backgroundcolor: '#181825', gridcolor: '#222' },
      yaxis: { title: 'Time', backgroundcolor: '#181825', gridcolor: '#222' },
      zaxis: { title: 'Volume', backgroundcolor: '#181825', gridcolor: '#222' },
      camera: { eye: { x: 1.7, y: 1.7, z: 1.7 } },
    },
  };

  Plotly.newPlot(chartElement, [buildSurface(data.priceGrid, data.timeGrid, data.volumeMatrix)], layout, { responsive: true });
}

function updateValues() {
  midPriceValue.textContent = midPriceInput.value;
  volatilityValue.textContent = Number(volatilityInput.value).toFixed(2);
  imbalanceIntensityValue.textContent = Number(imbalanceInput.value).toFixed(2);
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

  imbalanceMetricOutput.textContent = metrics.imbalance.toFixed(3);
  liquidityDepthOutput.textContent = metrics.liquidityDepth.toFixed(1);
  renderPlot(data, mid, vol, imb, spoof, crash);
}

midPriceInput.addEventListener('input', updateValues);
volatilityInput.addEventListener('input', updateValues);
imbalanceInput.addEventListener('input', updateValues);
spoofingInput.addEventListener('change', updateValues);
flashCrashInput.addEventListener('change', updateValues);
simulateButton.addEventListener('click', runSimulation);

window.addEventListener('load', runSimulation);
