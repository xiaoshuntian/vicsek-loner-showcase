const TAU = Math.PI * 2;
const STRATEGIES = {
  defect: 0,
  coop: 1,
  loner: 2,
};

const COLORS = {
  [STRATEGIES.coop]: "#2f8f6a",
  [STRATEGIES.defect]: "#cd4d41",
  [STRATEGIES.loner]: "#e2a72e",
};

const LABELS = {
  [STRATEGIES.coop]: "C",
  [STRATEGIES.defect]: "D",
  [STRATEGIES.loner]: "L",
};

const controls = {
  agentCount: document.getElementById("agentCount"),
  rounds: document.getElementById("rounds"),
  radius: document.getElementById("radius"),
  pFactor: document.getElementById("pFactor"),
  alpha: document.getElementById("alpha"),
  eta: document.getElementById("eta"),
  speed: document.getElementById("speed"),
  seed: document.getElementById("seed"),
  resetBtn: document.getElementById("resetBtn"),
  playBtn: document.getElementById("playBtn"),
  stepBtn: document.getElementById("stepBtn"),
  runBtn: document.getElementById("runBtn"),
};

const labels = {
  round: document.getElementById("roundLabel"),
  va: document.getElementById("vaLabel"),
  coop: document.getElementById("coopLabel"),
  seed: document.getElementById("seedLabel"),
};

const simCanvas = document.getElementById("simCanvas");
const simCtx = simCanvas.getContext("2d");
const strategyCanvas = document.getElementById("strategyChart");
const strategyCtx = strategyCanvas.getContext("2d");
const metricCanvas = document.getElementById("metricChart");
const metricCtx = metricCanvas.getContext("2d");

let state = null;
let animationHandle = null;

function createRng(seed) {
  let s = seed >>> 0;
  return function rand() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap01(x) {
  if (x < 0) return x + 1;
  if (x >= 1) return x - 1;
  return x;
}

function periodicDelta(a, b) {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

function angleFromVector(x, y) {
  let angle = Math.atan2(y, x);
  if (angle < 0) angle += TAU;
  return angle;
}

function sampleStrategy(rand) {
  const u = rand();
  if (u < 1 / 3) return STRATEGIES.coop;
  if (u < 2 / 3) return STRATEGIES.defect;
  return STRATEGIES.loner;
}

function getSettings() {
  return {
    count: Number(controls.agentCount.value),
    rounds: Number(controls.rounds.value),
    radius: Number(controls.radius.value),
    p: Number(controls.pFactor.value),
    alpha: Number(controls.alpha.value),
    eta: Number(controls.eta.value),
    speed: Number(controls.speed.value),
    seed: Number(controls.seed.value),
    beta: 1,
    c1: 0.5,
  };
}

function initSimulation() {
  const settings = getSettings();
  const rand = createRng(settings.seed);
  const agents = Array.from({ length: settings.count }, (_, id) => ({
    id,
    x: rand(),
    y: rand(),
    theta: rand() * TAU,
    strategy: sampleStrategy(rand),
  }));

  state = {
    settings,
    rand,
    agents,
    round: 0,
    history: [],
  };

  recordSnapshot();
  renderAll();
}

function buildNeighbors(agents, radius) {
  const neighbors = Array.from({ length: agents.length }, () => []);
  for (let i = 0; i < agents.length; i += 1) {
    for (let j = i + 1; j < agents.length; j += 1) {
      const dx = periodicDelta(agents[i].x, agents[j].x);
      const dy = periodicDelta(agents[i].y, agents[j].y);
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        neighbors[i].push(j);
        neighbors[j].push(i);
      }
    }
  }
  return neighbors;
}

function computeAverageHeading(agentIndex, agents, neighbors) {
  const idxs = [agentIndex, ...neighbors[agentIndex]];
  let sx = 0;
  let sy = 0;
  for (const idx of idxs) {
    sx += Math.cos(agents[idx].theta);
    sy += Math.sin(agents[idx].theta);
  }
  return angleFromVector(sx, sy);
}

function computeLocalVa(agentIndex, agents, neighbors) {
  const local = neighbors[agentIndex];
  if (!local.length) return 0;
  let sum = 0;
  const selfTheta = agents[agentIndex].theta;
  const selfX = Math.cos(selfTheta);
  const selfY = Math.sin(selfTheta);
  for (const idx of local) {
    const x = (selfX + Math.cos(agents[idx].theta)) / 2;
    const y = (selfY + Math.sin(agents[idx].theta)) / 2;
    sum += Math.hypot(x, y);
  }
  return sum / local.length;
}

function computeGlobalVa(agents) {
  let sx = 0;
  let sy = 0;
  for (const agent of agents) {
    sx += Math.cos(agent.theta);
    sy += Math.sin(agent.theta);
  }
  return Math.hypot(sx / agents.length, sy / agents.length);
}

function computeCooperation(agents) {
  let coop = 0;
  for (const agent of agents) {
    if (agent.strategy === STRATEGIES.coop) coop += 1;
  }
  return coop / agents.length;
}

function countStrategies(agents) {
  const counts = { C: 0, D: 0, L: 0 };
  for (const agent of agents) {
    if (agent.strategy === STRATEGIES.coop) counts.C += 1;
    if (agent.strategy === STRATEGIES.defect) counts.D += 1;
    if (agent.strategy === STRATEGIES.loner) counts.L += 1;
  }
  return counts;
}

function recordSnapshot() {
  state.history.push({
    round: state.round,
    va: computeGlobalVa(state.agents),
    coop: computeCooperation(state.agents),
    counts: countStrategies(state.agents),
  });
}

function stepSimulation() {
  if (!state || state.round >= state.settings.rounds) return;

  const { agents, settings, rand } = state;
  const neighbors = buildNeighbors(agents, settings.radius);
  const localHeading = agents.map((_, i) => computeAverageHeading(i, agents, neighbors));
  const nextAngles = agents.map((agent, i) => {
    if (agent.strategy === STRATEGIES.defect) {
      return rand() * TAU;
    }
    const noise = (rand() * 2 - 1) * settings.eta;
    return (localHeading[i] + noise + TAU) % TAU;
  });

  const movedAgents = agents.map((agent, i) => ({
    ...agent,
    x: wrap01(agent.x + settings.speed * Math.cos(nextAngles[i])),
    y: wrap01(agent.y + settings.speed * Math.sin(nextAngles[i])),
    theta: nextAngles[i],
  }));

  const movedNeighbors = buildNeighbors(movedAgents, settings.radius);
  const payoffs = movedAgents.map((agent, i) => {
    const localVa = computeLocalVa(i, movedAgents, movedNeighbors);
    let cost = 0;
    if (agent.strategy === STRATEGIES.coop) cost = settings.radius;
    if (agent.strategy === STRATEGIES.loner) cost = settings.c1 * settings.radius;
    return localVa - settings.alpha * cost;
  });

  const updatedAgents = movedAgents.map((agent, i) => {
    const nb = movedNeighbors[i];
    if (!nb.length) return agent;

    const sampledNeighbor = nb[Math.floor(rand() * nb.length)];
    const ownPayoff = payoffs[i];
    const neighborPayoff = payoffs[sampledNeighbor];
    let prob = 1 / (1 + Math.exp((ownPayoff - neighborPayoff) / settings.beta));
    if (agent.strategy === STRATEGIES.loner) {
      prob *= settings.p;
    }

    if (rand() < prob) {
      return {
        ...agent,
        strategy: movedAgents[sampledNeighbor].strategy,
      };
    }
    return agent;
  });

  state.agents = updatedAgents;
  state.round += 1;
  recordSnapshot();
  renderAll();
}

function drawArrow(ctx, x, y, angle, color, radius) {
  const headX = x + Math.cos(angle) * radius;
  const headY = y + Math.sin(angle) * radius;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(headX, headY);
  ctx.stroke();

  const wing = radius * 0.38;
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.lineTo(
    headX - Math.cos(angle - Math.PI / 7) * wing,
    headY - Math.sin(angle - Math.PI / 7) * wing
  );
  ctx.lineTo(
    headX - Math.cos(angle + Math.PI / 7) * wing,
    headY - Math.sin(angle + Math.PI / 7) * wing
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSimulation() {
  const { width, height } = simCanvas;
  simCtx.clearRect(0, 0, width, height);

  const margin = 36;
  const boxSize = width - margin * 2;
  const radiusPx = state.settings.radius * boxSize;

  simCtx.fillStyle = "rgba(252, 250, 244, 0.92)";
  simCtx.fillRect(margin, margin, boxSize, boxSize);

  simCtx.strokeStyle = "rgba(31, 42, 51, 0.22)";
  simCtx.lineWidth = 2;
  simCtx.strokeRect(margin, margin, boxSize, boxSize);

  for (const agent of state.agents) {
    const x = margin + agent.x * boxSize;
    const y = margin + agent.y * boxSize;
    const color = COLORS[agent.strategy];

    simCtx.strokeStyle = `${color}33`;
    simCtx.setLineDash([6, 8]);
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.arc(x, y, radiusPx, 0, TAU);
    simCtx.stroke();

    simCtx.setLineDash([]);
    simCtx.fillStyle = color;
    simCtx.beginPath();
    simCtx.arc(x, y, 9, 0, TAU);
    simCtx.fill();

    drawArrow(simCtx, x, y, agent.theta, color, 18);

    simCtx.fillStyle = "#122129";
    simCtx.font = "12px Georgia";
    simCtx.textAlign = "center";
    simCtx.fillText(`${LABELS[agent.strategy]}${agent.id}`, x, y - 14);
  }
}

function drawChartFrame(ctx, canvas, titleYLabel, xMax, yMax) {
  const pad = { left: 54, right: 22, top: 18, bottom: 36 };
  const innerW = canvas.width - pad.left - pad.right;
  const innerH = canvas.height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(31, 42, 51, 0.16)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (innerH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + innerW, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + innerH);
  ctx.lineTo(pad.left + innerW, pad.top + innerH);
  ctx.strokeStyle = "rgba(31, 42, 51, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#33414b";
  ctx.font = "12px Georgia";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = ((yMax * (4 - i)) / 4).toFixed(2);
    const y = pad.top + (innerH * i) / 4 + 4;
    ctx.fillText(value, pad.left - 8, y);
  }

  ctx.textAlign = "center";
  const tickCount = Math.min(5, Math.max(1, xMax));
  for (let i = 0; i <= tickCount; i += 1) {
    const ratio = tickCount === 0 ? 0 : i / tickCount;
    const x = pad.left + innerW * ratio;
    const value = Math.round(xMax * ratio);
    ctx.fillText(String(value), x, pad.top + innerH + 20);
  }

  ctx.save();
  ctx.translate(16, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(titleYLabel, 0, 0);
  ctx.restore();

  return {
    pad,
    innerW,
    innerH,
    x: round => pad.left + (round / Math.max(1, xMax)) * innerW,
    y: value => pad.top + innerH - (value / Math.max(1e-6, yMax)) * innerH,
  };
}

function drawLine(ctx, map, values, color) {
  if (!values.length) return;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = map.x(index);
    const y = map.y(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.stroke();
}

function drawLegend(ctx, items, startX, y) {
  ctx.font = "12px Georgia";
  ctx.textAlign = "left";
  let x = startX;
  for (const item of items) {
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 8, 16, 4);
    x += 22;
    ctx.fillStyle = "#33414b";
    ctx.fillText(item.label, x, y);
    x += ctx.measureText(item.label).width + 18;
  }
}

function drawStrategyChart() {
  const map = drawChartFrame(
    strategyCtx,
    strategyCanvas,
    "count",
    Math.max(1, state.history.length - 1),
    state.settings.count
  );

  drawLine(strategyCtx, map, state.history.map(s => s.counts.C), COLORS[STRATEGIES.coop]);
  drawLine(strategyCtx, map, state.history.map(s => s.counts.D), COLORS[STRATEGIES.defect]);
  drawLine(strategyCtx, map, state.history.map(s => s.counts.L), COLORS[STRATEGIES.loner]);

  drawLegend(strategyCtx, [
    { label: "Cooperators", color: COLORS[STRATEGIES.coop] },
    { label: "Defectors", color: COLORS[STRATEGIES.defect] },
    { label: "Loners", color: COLORS[STRATEGIES.loner] },
  ], 58, 16);
}

function drawMetricChart() {
  const map = drawChartFrame(
    metricCtx,
    metricCanvas,
    "value",
    Math.max(1, state.history.length - 1),
    1
  );

  drawLine(metricCtx, map, state.history.map(s => s.va), "#204e58");
  drawLine(metricCtx, map, state.history.map(s => s.coop), "#8c5a12");

  drawLegend(metricCtx, [
    { label: "Global Va", color: "#204e58" },
    { label: "Cooperation level", color: "#8c5a12" },
  ], 58, 16);
}

function updateLabels() {
  const latest = state.history[state.history.length - 1];
  labels.round.textContent = `${state.round} / ${state.settings.rounds}`;
  labels.va.textContent = latest.va.toFixed(3);
  labels.coop.textContent = latest.coop.toFixed(3);
  labels.seed.textContent = String(state.settings.seed);
}

function renderAll() {
  drawSimulation();
  drawStrategyChart();
  drawMetricChart();
  updateLabels();
}

function stopAnimation() {
  if (animationHandle !== null) {
    clearInterval(animationHandle);
    animationHandle = null;
  }
  controls.playBtn.textContent = "Play";
}

function toggleAnimation() {
  if (animationHandle !== null) {
    stopAnimation();
    return;
  }

  controls.playBtn.textContent = "Pause";
  animationHandle = setInterval(() => {
    if (state.round >= state.settings.rounds) {
      stopAnimation();
      return;
    }
    stepSimulation();
  }, 380);
}

controls.resetBtn.addEventListener("click", () => {
  stopAnimation();
  initSimulation();
});

controls.stepBtn.addEventListener("click", () => {
  stopAnimation();
  stepSimulation();
});

controls.playBtn.addEventListener("click", () => {
  toggleAnimation();
});

controls.runBtn.addEventListener("click", () => {
  stopAnimation();
  while (state.round < state.settings.rounds) {
    stepSimulation();
  }
});

initSimulation();
