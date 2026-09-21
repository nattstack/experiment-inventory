const MAX_WEIGHT = 20;
const MAX_VOLUME = 16;

const ITEMS = {
  stick: { id: "stick", name: "Stick", weight: 1, volume: 2, icon: "🪵" },
  stone: { id: "stone", name: "Stone", weight: 3, volume: 1, icon: "🪨" },
};

const REFUSALS = {
  heavy: { floater: "Too heavy", hint: "Too heavy. Stones are dense — drop something." },
  bulky: { floater: "No room", hint: "No space left. Sticks are bulky — drop something." },
  full: { floater: "Pack is full", hint: "Your pack is full. Click an item on the right to drop it." },
};

const LAYOUT = [
  { id: "tree-0", type: "tree", px: 0.2, py: 0.5 },
  { id: "tree-1", type: "tree", px: 0.4, py: 0.66 },
  { id: "tree-2", type: "tree", px: 0.62, py: 0.46 },
  { id: "tree-3", type: "tree", px: 0.8, py: 0.58 },
  { id: "rock-0", type: "rock", px: 0.28, py: 0.78 },
  { id: "rock-1", type: "rock", px: 0.5, py: 0.74 },
  { id: "rock-2", type: "rock", px: 0.72, py: 0.8 },
];

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const hintEl = document.getElementById("hint");
const slotsEl = document.getElementById("slots");
const emptyEl = document.getElementById("empty");
const weightLabel = document.getElementById("weight-label");
const weightFill = document.getElementById("weight-fill");
const weightMeter = document.getElementById("weight-meter");
const volumeLabel = document.getElementById("volume-label");
const volumeFill = document.getElementById("volume-fill");
const volumeMeter = document.getElementById("volume-meter");
const carryNote = document.getElementById("carry-note");

const state = {
  width: 0,
  height: 0,
  unit: 1,
  dpr: 1,
  nodes: [],
  floaters: [],
  chips: [],
  inventory: [],
  hoverId: null,
  time: 0,
  blocked: false,
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function currentWeight() {
  return state.inventory.reduce((sum, stack) => sum + stack.count * ITEMS[stack.id].weight, 0);
}

function currentVolume() {
  return state.inventory.reduce((sum, stack) => sum + stack.count * ITEMS[stack.id].volume, 0);
}

function carryCheck(itemId, count = 1) {
  const item = ITEMS[itemId];
  const overweight = currentWeight() + item.weight * count > MAX_WEIGHT;
  const overvolume = currentVolume() + item.volume * count > MAX_VOLUME;
  if (overweight && overvolume) return { ok: false, reason: "full" };
  if (overweight) return { ok: false, reason: "heavy" };
  if (overvolume) return { ok: false, reason: "bulky" };
  return { ok: true, reason: null };
}

function canCarry(itemId, count = 1) {
  return carryCheck(itemId, count).ok;
}

function addItem(itemId, count = 1) {
  if (!canCarry(itemId, count)) return false;
  const stack = state.inventory.find((entry) => entry.id === itemId);
  if (stack) stack.count += count;
  else state.inventory.push({ id: itemId, count });
  renderInventory();
  return true;
}

function dropItem(itemId) {
  const stack = state.inventory.find((entry) => entry.id === itemId);
  if (!stack) return;
  stack.count -= 1;
  if (stack.count <= 0) {
    state.inventory = state.inventory.filter((entry) => entry.id !== itemId);
  }
  renderInventory();
}

function layoutNodes() {
  const { width, height, unit } = state;
  LAYOUT.forEach((spot) => {
    const existing = state.nodes.find((node) => node.id === spot.id);
    const radius = unit * (spot.type === "tree" ? 0.13 : 0.075);
    const next = {
      x: width * spot.px,
      y: height * spot.py,
      radius,
    };
    if (existing) {
      Object.assign(existing, next);
      return;
    }
    const maxHits = spot.type === "tree" ? 3 : 2;
    state.nodes.push({
      id: spot.id,
      type: spot.type,
      hits: maxHits,
      maxHits,
      cooldown: 0,
      ...next,
    });
  });
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  state.unit = Math.min(rect.width, rect.height);
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * state.dpr);
  canvas.height = Math.floor(rect.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  layoutNodes();
}

function nodeContains(node, x, y) {
  if (node.type === "tree") {
    const canopyX = node.x;
    const canopyY = node.y - node.radius * 0.72;
    const canopyR = node.radius * 0.95;
    const inCanopy = (x - canopyX) ** 2 + (y - canopyY) ** 2 <= canopyR * canopyR;
    const inTrunk =
      Math.abs(x - node.x) < node.radius * 0.2 &&
      y >= node.y - node.radius * 0.35 &&
      y <= node.y + node.radius * 0.18;
    return inCanopy || inTrunk;
  }
  const reach = node.radius * 1.15;
  return (x - node.x) ** 2 + (y - node.y) ** 2 <= reach * reach;
}

function nodeAt(x, y) {
  return [...state.nodes].reverse().find((node) => nodeContains(node, x, y));
}

function spawnFloater(x, y, text, ok) {
  state.floaters.push({ x, y, text, ok, life: 1 });
}

function spawnChips(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(50, 160);
    state.chips.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      life: 1,
      color,
    });
  }
}

function harvest(node) {
  if (node.cooldown > 0) {
    spawnFloater(node.x, node.y - node.radius, "Still growing", false);
    hintEl.textContent = "That spot is spent. Wait for it to grow back.";
    return;
  }

  const item = node.type === "tree" ? ITEMS.stick : ITEMS.stone;
  const check = carryCheck(item.id);
  if (!check.ok) {
    const refusal = REFUSALS[check.reason];
    state.blocked = true;
    canvas.classList.add("is-blocked");
    spawnFloater(node.x, node.y - node.radius, refusal.floater, false);
    hintEl.textContent = refusal.hint;
    return;
  }

  addItem(item.id);
  node.hits -= 1;
  const burstY = node.type === "tree" ? node.y - node.radius * 0.6 : node.y - node.radius * 0.15;
  spawnChips(node.x, burstY, node.type === "tree" ? "#8b5a2b" : "#9a9a9a", 12);
  spawnFloater(node.x, node.y - node.radius, `+1 ${item.name}  (${item.weight} wt · ${item.volume} vol)`, true);
  hintEl.textContent = `Picked up a ${item.name.toLowerCase()}.`;

  if (node.hits <= 0) {
    node.cooldown = node.type === "tree" ? 7 : 5;
    hintEl.textContent =
      node.type === "tree" ? "The tree is a stump for now." : "The rock crumbled. It will settle again.";
  }
}

function update(dt) {
  state.time += dt;
  state.nodes.forEach((node) => {
    if (node.cooldown > 0) {
      node.cooldown -= dt;
      if (node.cooldown <= 0) {
        node.cooldown = 0;
        node.hits = node.maxHits;
      }
    }
  });

  state.floaters = state.floaters.filter((floater) => {
    floater.life -= dt * 0.7;
    floater.y -= 32 * dt;
    return floater.life > 0;
  });

  state.chips = state.chips.filter((chip) => {
    chip.life -= dt * 1.4;
    chip.x += chip.vx * dt;
    chip.y += chip.vy * dt;
    chip.vy += 180 * dt;
    return chip.life > 0;
  });
}

function drawSky() {
  const { width, height } = state;
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, "#8ec4de");
  sky.addColorStop(0.55, "#f0d5a0");
  sky.addColorStop(1, "#d7c07a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunR = state.unit * 0.055;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.beginPath();
  ctx.arc(width * 0.84, height * 0.14, sunR, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  const { width, height } = state;
  const grassTop = height * 0.46;
  const hill = ctx.createLinearGradient(0, grassTop, 0, height);
  hill.addColorStop(0, "#6f9a49");
  hill.addColorStop(1, "#3f6a32");
  ctx.fillStyle = hill;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, grassTop + 30);
  ctx.quadraticCurveTo(width * 0.25, grassTop - height * 0.04, width * 0.5, grassTop + 18);
  ctx.quadraticCurveTo(width * 0.75, grassTop + height * 0.06, width, grassTop);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(47, 86, 36, 0.32)";
  const blade = Math.max(6, state.unit * 0.012);
  for (let i = 0; i < 36; i += 1) {
    const x = (i * 97) % width;
    const y = grassTop + 40 + ((i * 53) % (height * 0.42));
    ctx.fillRect(x, y, 2, blade);
  }
}

function drawTree(node) {
  const spent = node.cooldown > 0;
  const r = node.radius;
  const sway = spent ? 0 : Math.sin(state.time * 1.2 + node.x * 0.01) * (r * 0.04);
  ctx.save();
  ctx.translate(node.x, node.y);

  ctx.fillStyle = "rgba(20, 30, 12, 0.22)";
  ctx.beginPath();
  ctx.ellipse(r * 0.08, r * 0.12, r * 0.62, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6a4326";
  ctx.fillRect(-r * 0.12, -r * 0.28, r * 0.24, r * 0.4);
  ctx.fillStyle = "#4d301b";
  ctx.fillRect(-r * 0.12, -r * 0.28, r * 0.08, r * 0.4);

  if (!spent) {
    ctx.translate(sway, 0);
    const leaf = (dx, dy, radius, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    leaf(-r * 0.08, -r * 0.78, r * 0.5, "#2f6a38");
    leaf(r * 0.32, -r * 0.7, r * 0.42, "#3d8644");
    leaf(-r * 0.36, -r * 0.62, r * 0.38, "#2a5a32");
    leaf(r * 0.06, -r * 1.02, r * 0.34, "#4a9a52");
  } else {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(-r * 0.16, -r * 0.1, r * 0.32, r * 0.12);
  }

  ctx.restore();
}

function drawRock(node) {
  const spent = node.cooldown > 0;
  const r = node.radius;
  ctx.save();
  ctx.translate(node.x, node.y);
  ctx.fillStyle = "rgba(20, 30, 12, 0.2)";
  ctx.beginPath();
  ctx.ellipse(r * 0.04, r * 0.22, r * 0.72, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  if (spent) {
    ctx.fillStyle = "#7d7a74";
    ctx.moveTo(-r * 0.7, r * 0.22);
    ctx.lineTo(-r * 0.22, -r * 0.08);
    ctx.lineTo(r * 0.16, r * 0.16);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(r * 0.62, r * 0.26);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#8d8a84";
    ctx.moveTo(-r * 0.78, r * 0.28);
    ctx.lineTo(-r * 0.5, -r * 0.36);
    ctx.lineTo(r * 0.1, -r * 0.58);
    ctx.lineTo(r * 0.7, -r * 0.16);
    ctx.lineTo(r * 0.64, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, -r * 0.18);
    ctx.lineTo(r * 0.06, -r * 0.44);
    ctx.lineTo(r * 0.22, -r * 0.16);
    ctx.closePath();
    ctx.fill();
    if (node.hits < node.maxHits) {
      ctx.strokeStyle = "rgba(40,40,40,0.55)";
      ctx.lineWidth = Math.max(2, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.28);
      ctx.lineTo(r * 0.06, r * 0.16);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHover(node) {
  if (!node || node.cooldown > 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 236, 180, 0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  const y = node.type === "tree" ? node.y - node.radius * 0.72 : node.y;
  ctx.beginPath();
  ctx.arc(node.x, y, node.radius * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFx() {
  state.chips.forEach((chip) => {
    ctx.globalAlpha = chip.life;
    ctx.fillStyle = chip.color;
    ctx.fillRect(chip.x, chip.y, 4, 4);
  });
  ctx.globalAlpha = 1;

  state.floaters.forEach((floater) => {
    ctx.globalAlpha = floater.life;
    ctx.fillStyle = floater.ok ? "#fff4cc" : "#ffb3a1";
    ctx.font = `${Math.max(14, state.unit * 0.022)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(floater.text, floater.x, floater.y);
  });
  ctx.globalAlpha = 1;
}

function draw() {
  drawSky();
  drawGround();
  const hover = state.nodes.find((node) => node.id === state.hoverId);
  [...state.nodes]
    .sort((a, b) => a.y - b.y)
    .forEach((node) => {
      if (node.type === "tree") drawTree(node);
      else drawRock(node);
    });
  drawHover(hover);
  drawFx();
}

function pointerToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function itemForNode(node) {
  return node.type === "tree" ? "stick" : "stone";
}

function setGauge(fill, meter, label, used, max) {
  const ratio = used / max;
  label.textContent = `${used} / ${max}`;
  fill.style.width = `${ratio * 100}%`;
  meter.setAttribute("aria-valuenow", String(used));
  fill.classList.toggle("is-heavy", ratio >= 0.7 && ratio < 1);
  fill.classList.toggle("is-full", ratio >= 1);
}

function carryMessage(weight, volume) {
  const weightRatio = weight / MAX_WEIGHT;
  const volumeRatio = volume / MAX_VOLUME;
  if (weight === 0 && volume === 0) return "Plenty of room.";
  if (weightRatio >= 1 && volumeRatio >= 1) return "Packed tight and heavy. Drop something to gather again.";
  if (weightRatio >= 1) return "Too heavy. Stones are dense — drop something.";
  if (volumeRatio >= 1) return "No space left. Sticks are bulky — drop something.";
  if (weightRatio >= 0.7 && volumeRatio >= 0.7) return "Getting heavy and bulky.";
  if (weightRatio >= 0.7) return "Getting heavy. Stones eat the weight limit.";
  if (volumeRatio >= 0.7) return "Getting bulky. Sticks eat the space.";
  return "Still room to keep gathering.";
}

function renderInventory() {
  const weight = currentWeight();
  const volume = currentVolume();
  setGauge(weightFill, weightMeter, weightLabel, weight, MAX_WEIGHT);
  setGauge(volumeFill, volumeMeter, volumeLabel, volume, MAX_VOLUME);
  carryNote.textContent = carryMessage(weight, volume);

  if (canCarry("stick") || canCarry("stone")) {
    state.blocked = false;
    canvas.classList.remove("is-blocked");
  }

  slotsEl.innerHTML = "";
  state.inventory.forEach((stack) => {
    const item = ITEMS[stack.id];
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "slot";
    button.type = "button";
    button.innerHTML = `
      <span class="slot-icon" aria-hidden="true">${item.icon}</span>
      <span>
        <span class="slot-head">
          <strong>${item.name}</strong>
          <span>x${stack.count}</span>
        </span>
        <span class="slot-meta">
          <span>${item.weight} wt · ${item.volume} vol each</span>
          <span>${item.weight * stack.count} wt · ${item.volume * stack.count} vol</span>
        </span>
      </span>
      <span class="slot-drop">Drop</span>
    `;
    button.addEventListener("click", () => {
      dropItem(item.id);
      hintEl.textContent = `Dropped a ${item.name.toLowerCase()}.`;
    });
    li.appendChild(button);
    slotsEl.appendChild(li);
  });

  emptyEl.classList.toggle("is-hidden", state.inventory.length > 0);
}

function loop(last) {
  requestAnimationFrame((now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    update(dt);
    draw();
    loop(now);
  });
}

canvas.addEventListener("pointermove", (event) => {
  const { x, y } = pointerToWorld(event);
  const node = nodeAt(x, y);
  state.hoverId = node ? node.id : null;
  if (node && node.cooldown === 0 && !canCarry(itemForNode(node))) {
    canvas.classList.add("is-blocked");
  } else if (!state.blocked) {
    canvas.classList.remove("is-blocked");
  }
});

canvas.addEventListener("pointerleave", () => {
  state.hoverId = null;
});

canvas.addEventListener("click", (event) => {
  const { x, y } = pointerToWorld(event);
  const node = nodeAt(x, y);
  if (!node) {
    hintEl.textContent = "Click a tree or a rock to gather.";
    return;
  }
  harvest(node);
});

window.addEventListener("resize", resize);
resize();
renderInventory();
loop(performance.now());

window.ExperimentInventory = {
  addItem,
  dropItem,
  carryCheck,
  currentWeight,
  currentVolume,
};
