/** Gate kinds and pure evaluation. */

export const KINDS = {
  switch: { label: "開關", inputs: 0, outputs: 1, w: 56, h: 40 },
  not: { label: "NOT", inputs: 1, outputs: 1, w: 64, h: 40 },
  and: { label: "AND", inputs: 2, outputs: 1, w: 64, h: 48 },
  or: { label: "OR", inputs: 2, outputs: 1, w: 64, h: 48 },
  led: { label: "LED", inputs: 1, outputs: 0, w: 48, h: 48 },
};

/** @param {string} kind @param {number[]} ins */
export function evalGate(kind, ins) {
  const b = (v) => (v ? 1 : 0);
  switch (kind) {
    case "switch":
      return b(ins[0]); // caller passes state as ins[0]
    case "not":
      return b(!ins[0]);
    case "and":
      return b(ins[0] && ins[1]);
    case "or":
      return b(ins[0] || ins[1]);
    case "led":
      return 0;
    default:
      return 0;
  }
}

export function inputCount(kind) {
  return KINDS[kind]?.inputs ?? 0;
}

export function outputCount(kind) {
  return KINDS[kind]?.outputs ?? 0;
}
