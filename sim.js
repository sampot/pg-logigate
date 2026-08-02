import { evalGate, inputCount } from "./gate.js";

/**
 * @typedef {{ id: string, kind: string, x: number, y: number, state?: number }} Node
 * @typedef {{ id: string, from: { id: string, port: number }, to: { id: string, port: number } }} Wire
 */

/**
 * Evaluate circuit. Returns output bit per node and level per wire.
 * @param {Node[]} nodes
 * @param {Wire[]} wires
 */
export function evaluate(nodes, wires) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  /** @type {Map<string, number>} */
  const out = new Map();
  /** @type {Map<string, number>} */
  const wireLevel = new Map();

  const indeg = new Map(nodes.map(n => [n.id, 0]));
  /** @type {Map<string, string[]>} */
  const children = new Map(nodes.map(n => [n.id, []]));
  for (const w of wires) {
    if (!byId.has(w.from.id) || !byId.has(w.to.id)) continue;
    indeg.set(w.to.id, (indeg.get(w.to.id) || 0) + 1);
    children.get(w.from.id).push(w.to.id);
  }

  const queue = [];
  for (const n of nodes) {
    if ((indeg.get(n.id) || 0) === 0) queue.push(n.id);
  }

  const order = [];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const c of children.get(id) || []) {
      indeg.set(c, indeg.get(c) - 1);
      if (indeg.get(c) === 0) queue.push(c);
    }
  }

  const cyclic = order.length !== nodes.length;
  if (cyclic) {
    for (const n of nodes) {
      if (!seen.has(n.id)) order.push(n.id);
    }
  }

  /** @type {Map<string, Wire>} */
  const into = new Map();
  for (const w of wires) into.set(`${w.to.id}:${w.to.port}`, w);

  for (const id of order) {
    const n = byId.get(id);
    if (!n) continue;
    const nin = inputCount(n.kind);
    const ins = [];
    for (let p = 0; p < nin; p++) {
      const w = into.get(`${id}:${p}`);
      if (!w) {
        ins.push(0);
        continue;
      }
      const src = out.has(w.from.id) ? /** @type {number} */ (out.get(w.from.id)) : 0;
      ins.push(src);
      wireLevel.set(w.id, src);
    }
    let bit = 0;
    if (n.kind === "switch") bit = n.state ? 1 : 0;
    else if (n.kind === "led") bit = ins[0] ? 1 : 0;
    else bit = evalGate(n.kind, ins);
    out.set(id, bit);
    for (const w of wires) {
      if (w.from.id === id) wireLevel.set(w.id, bit);
    }
  }

  return { out, wireLevel, cyclic };
}
