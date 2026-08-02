/** Built-in circuits for v1. */

let _seq = 1;
function nid(prefix) {
  return `${prefix}${_seq++}`;
}

export function resetIds() {
  _seq = 1;
}

/** Empty board */
export function emptyCircuit() {
  resetIds();
  return { nodes: [], wires: [] };
}

/**
 * Half adder: S = A XOR B, C = A AND B
 * XOR = (A OR B) AND NOT(A AND B)
 */
export function halfAdder() {
  resetIds();
  const a = { id: nid("sw"), kind: "switch", x: 40, y: 70, state: 0 };
  const b = { id: nid("sw"), kind: "switch", x: 40, y: 180, state: 0 };
  const and1 = { id: nid("g"), kind: "and", x: 180, y: 110 };
  const or1 = { id: nid("g"), kind: "or", x: 180, y: 200 };
  const not1 = { id: nid("g"), kind: "not", x: 300, y: 110 };
  const and2 = { id: nid("g"), kind: "and", x: 400, y: 160 };
  const ledS = { id: nid("led"), kind: "led", x: 540, y: 150 };
  const ledC = { id: nid("led"), kind: "led", x: 300, y: 40 };

  const wires = [
    { id: nid("w"), from: { id: a.id, port: 0 }, to: { id: and1.id, port: 0 } },
    { id: nid("w"), from: { id: b.id, port: 0 }, to: { id: and1.id, port: 1 } },
    { id: nid("w"), from: { id: a.id, port: 0 }, to: { id: or1.id, port: 0 } },
    { id: nid("w"), from: { id: b.id, port: 0 }, to: { id: or1.id, port: 1 } },
    { id: nid("w"), from: { id: and1.id, port: 0 }, to: { id: not1.id, port: 0 } },
    { id: nid("w"), from: { id: or1.id, port: 0 }, to: { id: and2.id, port: 0 } },
    { id: nid("w"), from: { id: not1.id, port: 0 }, to: { id: and2.id, port: 1 } },
    { id: nid("w"), from: { id: and2.id, port: 0 }, to: { id: ledS.id, port: 0 } },
    { id: nid("w"), from: { id: and1.id, port: 0 }, to: { id: ledC.id, port: 0 } },
  ];

  return {
    nodes: [a, b, and1, or1, not1, and2, ledS, ledC],
    wires,
    note: "半加器：兩開關 → 上 LED＝進位(C)，下＝和(S)",
  };
}

/** Simple AND demo */
export function andDemo() {
  resetIds();
  const a = { id: nid("sw"), kind: "switch", x: 50, y: 80, state: 1 };
  const b = { id: nid("sw"), kind: "switch", x: 50, y: 180, state: 1 };
  const g = { id: nid("g"), kind: "and", x: 220, y: 120 };
  const led = { id: nid("led"), kind: "led", x: 380, y: 120 };
  return {
    nodes: [a, b, g, led],
    wires: [
      { id: nid("w"), from: { id: a.id, port: 0 }, to: { id: g.id, port: 0 } },
      { id: nid("w"), from: { id: b.id, port: 0 }, to: { id: g.id, port: 1 } },
      { id: nid("w"), from: { id: g.id, port: 0 }, to: { id: led.id, port: 0 } },
    ],
    note: "AND：兩開關都開，LED 才亮",
  };
}
