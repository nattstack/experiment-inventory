const MAX_WEIGHT = 20;

const ITEMS = {
  stick: { id: "stick", name: "Stick", weight: 1, icon: "🪵" },
  stone: { id: "stone", name: "Stone", weight: 3, icon: "🪨" },
};

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const hintEl = document.getElementById("hint");
const slotsEl = document.getElementById("slots");
const emptyEl = document.getElementById("empty");
const weightLabel = document.getElementById("weight-label");
const weightFill = document.getElementById("weight-fill");
const weightMeter = document.getElementById("weight-meter");
const weightNote = document.getElementById("weight-note");

const state = {
  width: 0,
  height: 0,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentWeight() {
  return state.inventory.reduce((sum, stack) => sum + stack.count * ITEMS[stack.id].weight, 0);
}

function canCarry(itemId, count = 1) {
  return currentWeight() + ITEMS[itemId].weight * count <= MAX_WEIGHT;
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

function placeNodes() {
  const { width, height } = state;
  const trees = [
    { x: width * 0.18, y: height * 0.42 },
    { x: width * 0.36, y: height * 0.62 },
    { x: width * 0.58, y: height * 0.38 },
    { x: width * 0.78, y: height * 0.55 },
  ];
  const rocks = [
    { x: width * 0.26, y: height * 0.74 },
    { x: width * 0.48, y: height * 0.7 },
    { x: width * 0.7, y: height * 0.76 },
  ];

  state.nodes = [
    ...trees.map((point, index) => ({
      id: `tree-${index}`,
      type: "tree",
      x: point.x,
      y: point.y,
      radius: 46,
      hits: 3,
      maxHits: 3,
      cooldown: 0,
    })),
    ...rocks.map((point, index) => ({
      id: `rock-${index}`,
      type: "rock",
      x: point.x,
      y: point.y,
      radius: 34,
      hits: 2,
      maxHits: 2,
      cooldown: 0,
    })),
  ];
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * state.dpr);
  canvas.height = Math.floor(rect.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  placeNodes();
}

function nodeAt(x, y) {
  return state.nodes.find((node) => {
    const reach = node.type === "tree" ? node.radius + 10 : node.radius + 6;
    const dx = x - node.x;
    const dy = y - node.y;
    return dx * dx + dy * dy <= reach * reach;
  });
}

function spawnFloater(x, y, text, ok) {
  state.floaters.push({
    x,
    y,
    text,
    ok,
    life: 1,
  });
}

function spawnChips(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, 140);
    state.chips.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 1,
      color,
    });
  }
}

function harvest(node) {
  if (node.cooldown > 0) {
    spawnFloater(node.x, node.y - 36, "Still growing", false);
    hintEl.textContent = "That spot is spent. Wait for it to grow back.";
    return;
  }

  const item = node.type === "tree" ? ITEMS.stick : ITEMS.stone;
  if (!canCarry(item.id)) {
    state.blocked = true;
    canvas.classList.add("is-blocked");
    spawnFloater(node.x, node.y - 36, "Too heavy", false);
    hintEl.textContent = "Your pack is full. Click an item on the right to drop it.";
    return;
  }

  addItem(item.id);
  node.hits -= 1;
  spawnChips(node.x, node.y - (node.type === "tree" ? 28 : 8), node.type === "tree" ? "#8b5a2b" : "#9a9a9a", 10);
  spawnFloater(node.x, node.y - 42, `+1 ${item.name}  (${item.weight} wt)`, true);
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
    floater.y -= 28 * dt;
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

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(width * 0.82, height * 0.14, 46, 46, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  const { width, height } = state;
  const grassTop = height * 0.48;
  const hill = ctx.createLinearGradient(0, grassTop, 0, height);
  hill.addColorStop(0, "#6f9a49");
  hill.addColorStop(1, "#3f6a32");
  ctx.fillStyle = hill;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, grassTop + 30);
  ctx.quadraticCurveTo(width * 0.25, grassTop - 20, width * 0.5, grassTop + 18);
  ctx.quadraticCurveTo(width * 0.75, grassTop + 50, width, grassTop);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(47, 86, 36, 0.35)";
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 97) % width;
    const y = grassTop + 40 + ((i * 53) % (height * 0.42));
    ctx.fillRect(x, y, 2, 9);
  }
}

function drawTree(node) {
  const spent = node.cooldown > 0;
  const sway = spent ? 0 : Math.sin(state.time * 1.2 + node.x * 0.01) * 3;
  ctx.save();
  ctx.translate(node.x, node.y);

  ctx.fillStyle = "rgba(20, 30, 12, 0.22)";
  ctx.beginPath();
  ctx.ellipse(4, 10, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6a4326";
  ctx.fillRect(-8, -18, 16, 28);
  ctx.fillStyle = "#4d301b";
  ctx.fillRect(-8, -18, 5, 28);

  if (!spent) {
    ctx.translate(sway, 0);
    const leaf = (dx, dy, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    leaf(-6, -52, 28, "#2f6a38");
    leaf(18, -48, 24, "#3d8644");
    leaf(-20, -40, 22, "#2a5a32");
    leaf(4, -68, 20, "#4a9a52");
  } else {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(-10, -8, 20, 8);
  }

  ctx.restore();
}

function drawRock(node) {
  const spent = node.cooldown > 0;
  ctx.save();
  ctx.translate(node.x, node.y);
  ctx.fillStyle = "rgba(20, 30, 12, 0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 12, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  if (spent) {
    ctx.fillStyle = "#7d7a74";
    ctx.moveTo(-22, 8);
    ctx.lineTo(-8, -4);
    ctx.lineTo(6, 6);
    ctx.lineTo(18, 2);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#8d8a84";
    ctx.moveTo(-26, 10);
    ctx.lineTo(-18, -12);
    ctx.lineTo(4, -20);
    ctx.lineTo(24, -6);
    ctx.lineTo(22, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(2, -16);
    ctx.lineTo(8, -8);
    ctx.closePath();
    ctx.fill();
    if (node.hits < node.maxHits) {
      ctx.strokeStyle = "rgba(40,40,40,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(2, 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHover(node) {
  if (!node || node.cooldown > 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 236, 180, 0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(node.x, node.y - (node.type === "tree" ? 24 : 2), node.radius, 0, Math.PI * 2);
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
    ctx.font = "16px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(floater.text, floater.x, floater.y);
  });
  ctx.globalAlpha = 1;
}

function draw() {
  drawSky();
  drawGround();
  const hover = state.nodes.find((node) => node.id === state.hoverId);
  [...state.nodes].sort((a, b) => a.y - b.y).forEach((node) => {
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

function renderInventory() {
  const weight = currentWeight();
  const ratio = weight / MAX_WEIGHT;
  weightLabel.textContent = `${weight} / ${MAX_WEIGHT}`;
  weightFill.style.width = `${ratio * 100}%`;
  weightMeter.setAttribute("aria-valuenow", String(weight));
  weightFill.classList.toggle("is-heavy", ratio >= 0.7 && ratio < 1);
  weightFill.classList.toggle("is-full", ratio >= 1);

  if (weight === 0) weightNote.textContent = "Plenty of room.";
  else if (ratio >= 1) weightNote.textContent = "Pack is full. Drop something to gather again.";
  else if (ratio >= 0.7) weightNote.textContent = "Getting heavy. Stones eat the limit fast.";
  else weightNote.textContent = "Still light enough to keep gathering.";

  if (weight < MAX_WEIGHT) {
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
          <span>${item.weight} wt each</span>
          <span>${item.weight * stack.count} wt</span>
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
  if (node && node.cooldown === 0 && !canCarry(node.type === "tree" ? "stick" : "stone")) {
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
