import { KINDS, inputCount, outputCount } from "./gate.js";
import { evaluate } from "./sim.js";
import { andDemo, emptyCircuit, halfAdder } from "./presets.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");
const paletteEl = document.getElementById("palette");

/** @type {{ nodes: any[], wires: any[], note?: string }} */
let circuit = andDemo();
let placeKind = null; // palette selection
let selected = /** @type {{ type: 'node'|'wire', id: string } | null} */ (null);
let drag = null; // { id, ox, oy }
let wireFrom = null; // { id, port }
let hoverPort = null;
let uid = 1000;

const VIEW = { w: 720, h: 420, dpr: 1 };

function nextId(prefix) {
  return `${prefix}${uid++}`;
}

function byId(id) {
  return circuit.nodes.find(n => n.id === id);
}

function portPos(node, which, index = 0) {
  const meta = KINDS[node.kind];
  const w = meta.w;
  const h = meta.h;
  if (which === "out") return { x: node.x + w, y: node.y + h / 2 };
  const n = meta.inputs;
  if (n <= 1) return { x: node.x, y: node.y + h / 2 };
  const t = (index + 1) / (n + 1);
  return { x: node.x, y: node.y + h * t };
}

function hitNode(x, y) {
  for (let i = circuit.nodes.length - 1; i >= 0; i--) {
    const n = circuit.nodes[i];
    const m = KINDS[n.kind];
    if (x >= n.x && x <= n.x + m.w && y >= n.y && y <= n.y + m.h) return n;
  }
  return null;
}

function hitPort(x, y, radius = 10) {
  for (const n of circuit.nodes) {
    if (outputCount(n.kind)) {
      const p = portPos(n, "out");
      if (Math.hypot(p.x - x, p.y - y) <= radius) return { node: n, which: "out", port: 0 };
    }
    const nin = inputCount(n.kind);
    for (let i = 0; i < nin; i++) {
      const p = portPos(n, "in", i);
      if (Math.hypot(p.x - x, p.y - y) <= radius) return { node: n, which: "in", port: i };
    }
  }
  return null;
}

function hitWire(x, y) {
  const { wireLevel } = evaluate(circuit.nodes, circuit.wires);
  let best = null;
  let bestD = 8;
  for (const w of circuit.wires) {
    const a = byId(w.from.id);
    const b = byId(w.to.id);
    if (!a || !b) continue;
    const p0 = portPos(a, "out");
    const p1 = portPos(b, "in", w.to.port);
    const d = distToSeg(x, y, p0.x, p0.y, p1.x, p1.y);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  void wireLevel;
  return best;
}

function distToSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function inputTaken(nodeId, port) {
  return circuit.wires.some(w => w.to.id === nodeId && w.to.port === port);
}

function loadCircuit(c) {
  circuit = {
    nodes: c.nodes.map(n => ({ ...n })),
    wires: c.wires.map(w => ({
      ...w,
      from: { ...w.from },
      to: { ...w.to },
    })),
    note: c.note || "",
  };
  selected = null;
  wireFrom = null;
  placeKind = null;
  syncPalette();
  noteEl.textContent = circuit.note || "從左側放元件，點輸出腳再點輸入腳接線。點開關可切換。";
  draw();
}

function deleteSelected() {
  if (!selected) return;
  if (selected.type === "node") {
    circuit.wires = circuit.wires.filter(
      w => w.from.id !== selected.id && w.to.id !== selected.id
    );
    circuit.nodes = circuit.nodes.filter(n => n.id !== selected.id);
  } else {
    circuit.wires = circuit.wires.filter(w => w.id !== selected.id);
  }
  selected = null;
  draw();
}

function resize() {
  VIEW.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || VIEW.w;
  const cssH = Math.max(320, Math.round(cssW * 0.58));
  VIEW.w = cssW;
  VIEW.h = cssH;
  canvas.width = Math.floor(cssW * VIEW.dpr);
  canvas.height = Math.floor(cssH * VIEW.dpr);
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(VIEW.dpr, 0, 0, VIEW.dpr, 0, 0);
  draw();
}

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (VIEW.w / r.width),
    y: (e.clientY - r.top) * (VIEW.h / r.height),
  };
}

function draw() {
  const { out, wireLevel, cyclic } = evaluate(circuit.nodes, circuit.wires);
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // grid
  ctx.strokeStyle = "rgba(45,212,191,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < VIEW.w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.h);
    ctx.stroke();
  }
  for (let y = 0; y < VIEW.h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.w, y);
    ctx.stroke();
  }

  // wires
  for (const w of circuit.wires) {
    const a = byId(w.from.id);
    const b = byId(w.to.id);
    if (!a || !b) continue;
    const p0 = portPos(a, "out");
    const p1 = portPos(b, "in", w.to.port);
    const bit = wireLevel.get(w.id) ? 1 : 0;
    const sel = selected?.type === "wire" && selected.id === w.id;
    ctx.beginPath();
    const mx = (p0.x + p1.x) / 2;
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
    ctx.strokeStyle = sel
      ? "#fff"
      : bit
        ? "rgba(45,212,191,0.95)"
        : "rgba(100,116,139,0.7)";
    ctx.lineWidth = sel ? 3 : bit ? 2.5 : 1.5;
    ctx.stroke();
    if (bit) {
      // pulse dots
      const t = (performance.now() / 800 + w.id.length * 0.1) % 1;
      const bx =
        (1 - t) * (1 - t) * (1 - t) * p0.x +
        3 * (1 - t) * (1 - t) * t * mx +
        3 * (1 - t) * t * t * mx +
        t * t * t * p1.x;
      const by =
        (1 - t) * (1 - t) * (1 - t) * p0.y +
        3 * (1 - t) * (1 - t) * t * p0.y +
        3 * (1 - t) * t * t * p1.y +
        t * t * t * p1.y;
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(125,211,252,0.95)";
      ctx.fill();
    }
  }

  // pending wire
  if (wireFrom) {
    const n = byId(wireFrom.id);
    if (n) {
      const p0 = portPos(n, "out");
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(hoverXY.x, hoverXY.y);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // nodes
  for (const n of circuit.nodes) {
    const m = KINDS[n.kind];
    const bit = out.get(n.id) ? 1 : 0;
    const sel = selected?.type === "node" && selected.id === n.id;

    ctx.fillStyle = "#121820";
    ctx.strokeStyle = sel ? "#2dd4bf" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = sel ? 2 : 1;
    roundRect(n.x, n.y, m.w, m.h, 8);
    ctx.fill();
    ctx.stroke();

    if (n.kind === "led") {
      ctx.beginPath();
      ctx.arc(n.x + m.w / 2, n.y + m.h / 2, 12, 0, Math.PI * 2);
      ctx.fillStyle = bit ? "rgba(45,212,191,0.95)" : "rgba(30,41,59,0.9)";
      ctx.fill();
      if (bit) {
        ctx.beginPath();
        ctx.arc(n.x + m.w / 2, n.y + m.h / 2, 18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(45,212,191,0.2)";
        ctx.fill();
      }
    } else if (n.kind === "switch") {
      ctx.fillStyle = bit ? "#2dd4bf" : "#475569";
      roundRect(n.x + 10, n.y + 10, m.w - 20, m.h - 20, 6);
      ctx.fill();
      ctx.fillStyle = bit ? "#042f2e" : "#e2e8f0";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bit ? "1" : "0", n.x + m.w / 2, n.y + m.h / 2);
    } else {
      ctx.fillStyle = "#e8ecf1";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m.label, n.x + m.w / 2, n.y + m.h / 2);
    }

    // ports
    if (outputCount(n.kind)) {
      const p = portPos(n, "out");
      drawPort(p.x, p.y, bit, hoverPort?.node.id === n.id && hoverPort.which === "out");
    }
    const nin = inputCount(n.kind);
    for (let i = 0; i < nin; i++) {
      const p = portPos(n, "in", i);
      const driven = circuit.wires.some(w => w.to.id === n.id && w.to.port === i);
      const lv = driven
        ? wireLevel.get(
            circuit.wires.find(w => w.to.id === n.id && w.to.port === i).id
          )
        : 0;
      drawPort(
        p.x,
        p.y,
        lv,
        hoverPort?.node.id === n.id && hoverPort.which === "in" && hoverPort.port === i
      );
    }
  }

  statusEl.textContent = cyclic
    ? "警告：偵測到迴路（組合環）。結果可能不穩定——第一版請避免環路。"
    : `元件 ${circuit.nodes.length} · 線 ${circuit.wires.length}` +
      (placeKind ? ` · 放置：${KINDS[placeKind].label}` : "") +
      (wireFrom ? " · 選輸入腳完成接線（Esc 取消）" : "");
}

function drawPort(x, y, bit, hot) {
  ctx.beginPath();
  ctx.arc(x, y, hot ? 6 : 4.5, 0, Math.PI * 2);
  ctx.fillStyle = bit ? "#2dd4bf" : "#64748b";
  ctx.fill();
  ctx.strokeStyle = hot ? "#fff" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = hot ? 2 : 1;
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let hoverXY = { x: 0, y: 0 };

canvas.addEventListener("pointerdown", e => {
  const { x, y } = canvasPos(e);
  canvas.setPointerCapture(e.pointerId);

  const port = hitPort(x, y);
  if (port) {
    if (port.which === "out") {
      wireFrom = { id: port.node.id, port: 0 };
      selected = null;
      placeKind = null;
      syncPalette();
      draw();
      return;
    }
    if (wireFrom && port.which === "in") {
      if (port.node.id === wireFrom.id) {
        wireFrom = null;
        draw();
        return;
      }
      if (inputTaken(port.node.id, port.port)) {
        // replace
        circuit.wires = circuit.wires.filter(
          w => !(w.to.id === port.node.id && w.to.port === port.port)
        );
      }
      circuit.wires.push({
        id: nextId("w"),
        from: { id: wireFrom.id, port: 0 },
        to: { id: port.node.id, port: port.port },
      });
      wireFrom = null;
      circuit.note = "";
      draw();
      return;
    }
  }

  if (placeKind) {
    const m = KINDS[placeKind];
    const node = {
      id: nextId(placeKind === "switch" ? "sw" : placeKind === "led" ? "led" : "g"),
      kind: placeKind,
      x: x - m.w / 2,
      y: y - m.h / 2,
    };
    if (placeKind === "switch") node.state = 0;
    circuit.nodes.push(node);
    selected = { type: "node", id: node.id };
    circuit.note = "";
    draw();
    return;
  }

  const n = hitNode(x, y);
  if (n) {
    selected = { type: "node", id: n.id };
    drag = { id: n.id, ox: x - n.x, oy: y - n.y, moved: false, kind: n.kind };
    draw();
    return;
  }

  const w = hitWire(x, y);
  if (w) {
    selected = { type: "wire", id: w.id };
    draw();
    return;
  }

  selected = null;
  draw();
});

canvas.addEventListener("pointermove", e => {
  const { x, y } = canvasPos(e);
  hoverXY = { x, y };
  hoverPort = hitPort(x, y);
  if (drag) {
    const n = byId(drag.id);
    if (n) {
      n.x = Math.max(0, Math.min(VIEW.w - KINDS[n.kind].w, x - drag.ox));
      n.y = Math.max(0, Math.min(VIEW.h - KINDS[n.kind].h, y - drag.oy));
      drag.moved = true;
    }
  }
  draw();
});

canvas.addEventListener("pointerup", () => {
  if (drag && !drag.moved && drag.kind === "switch") {
    const n = byId(drag.id);
    if (n) n.state = n.state ? 0 : 1;
  }
  drag = null;
  draw();
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    wireFrom = null;
    placeKind = null;
    syncPalette();
    draw();
  }
  if (e.key === "Backspace" || e.key === "Delete") {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
    deleteSelected();
  }
});

function syncPalette() {
  for (const btn of paletteEl.querySelectorAll("[data-kind]")) {
    btn.classList.toggle("active", btn.getAttribute("data-kind") === placeKind);
  }
}

paletteEl.addEventListener("click", e => {
  const btn = e.target.closest("[data-kind]");
  if (!btn) return;
  const kind = btn.getAttribute("data-kind");
  placeKind = placeKind === kind ? null : kind;
  wireFrom = null;
  syncPalette();
  draw();
});

document.getElementById("btn-half").addEventListener("click", () => loadCircuit(halfAdder()));
document.getElementById("btn-and").addEventListener("click", () => loadCircuit(andDemo()));
document.getElementById("btn-clear").addEventListener("click", () => {
  loadCircuit(emptyCircuit());
  noteEl.textContent = "空白電路：從左側選元件放到畫布上。";
});
document.getElementById("btn-del").addEventListener("click", deleteSelected);

window.addEventListener("resize", resize);

function loop() {
  draw();
  requestAnimationFrame(loop);
}

resize();
loadCircuit(halfAdder());
requestAnimationFrame(loop);
