// Krippendorff's alpha (ordinal) — standard coincidence-matrix method.
// Input: reliability data matrix — rows = raters, cols = units (items).
// Null means rater did not score that unit.

export function krippendorffAlphaOrdinal(data: (number | null)[][]): number {
  const numUnits = data[0]?.length ?? 0;

  // Build coincidence matrix over all pairs within each unit.
  // Values are 1–5; index them as 0–4 for the matrix.
  const V = 5;
  const coincidence: number[][] = Array.from({ length: V }, () => new Array(V).fill(0));
  const marginal = new Array(V).fill(0);

  for (let u = 0; u < numUnits; u++) {
    const vals = data.flatMap((rater) => {
      const v = rater[u];
      return v !== null && v !== undefined ? [v] : [];
    });
    const mu = vals.length;
    if (mu < 2) continue;

    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        const ci = vals[i] - 1;
        const cj = vals[j] - 1;
        coincidence[ci][cj] += 1 / (mu - 1);
      }
    }
  }

  // Marginals from coincidence matrix
  for (let c = 0; c < V; c++) {
    for (let k = 0; k < V; k++) {
      marginal[c] += coincidence[c][k];
    }
  }
  const n = marginal.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;

  // Observed disagreement (ordinal δ²)
  let Do = 0;
  for (let c = 0; c < V; c++) {
    for (let k = 0; k < V; k++) {
      Do += coincidence[c][k] * ordinalDelta(c, k, marginal);
    }
  }
  Do /= n;

  // Expected disagreement
  let De = 0;
  for (let c = 0; c < V; c++) {
    for (let k = 0; k < V; k++) {
      De += marginal[c] * marginal[k] * ordinalDelta(c, k, marginal);
    }
  }
  De /= n * (n - 1);

  if (De === 0) return 1;
  return 1 - Do / De;
}

// Ordinal difference function: δ²(c,k) = (Σ_{g=c}^{k} n_g − (n_c+n_k)/2)²
function ordinalDelta(c: number, k: number, marginal: number[]): number {
  if (c === k) return 0;
  const lo = Math.min(c, k);
  const hi = Math.max(c, k);
  let sum = 0;
  for (let g = lo; g <= hi; g++) sum += marginal[g];
  sum -= (marginal[lo] + marginal[hi]) / 2;
  return sum * sum;
}
