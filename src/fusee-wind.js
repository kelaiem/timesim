// THE FUSEE'S TORQUE-LAW SOLVE, moved verbatim out of main.js (BACKLOG §339 landing 2a) so a line spec can run the
// build's own solve in Node, ribbon-solve.js' precedent. main.js' comment above its call is the derivation; every name
// below is the constant main.js passes under the same name. Pure: no three.js, no DOM.
//
// u(t): the spring's wind angle off its free coil at reserve t, solved from chain conservation with the span's give
// (§150, §254). The inputs a twin barrel moves are R_wrap (DRUM_WRAP_R), the centre distance D (FUSEE_DRUM_DIST), the
// set-up θ_s and the level product P; the rest is the fusee's own z stack and the chain's pitches.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const SPRING_WIND_NPT = 4000;
export const SPRING_WIND_TMAX = 1.2;
export function springWindBeta({ FUSEE_WRAP_TURNS, FUSEE_R_LARGE, SETUP_SWEEP, DRUM_WRAP_R }) {
  return (4 * Math.PI * FUSEE_WRAP_TURNS * FUSEE_R_LARGE * SETUP_SWEEP) / DRUM_WRAP_R;
}
export function solveSpringWind({ FUSEE_WRAP_TURNS, FUSEE_LEVEL_P, DRUM_WRAP_R, FUSEE_DRUM_DIST, FUSEE_GROOVE_TURNS,
  FUSEE_GROOVE_PITCH, CHAIN_COIL_PITCH, FUSEE_F_ACTIVE, FUSEE_Z0, FUSEE_ZSPAN, COIL_TOP, DRUM_COIL_SLACK_TURNS,
  SETUP_SWEEP, SPRING_WIND_BETA, SPRING_WIND_NPT: NPT = SPRING_WIND_NPT, SPRING_WIND_TMAX: TMAX = SPRING_WIND_TMAX }) {
  const SPRING_WIND_NPT = NPT, SPRING_WIND_TMAX = TMAX;
  const N = Math.round(SPRING_WIND_NPT * SPRING_WIND_TMAX);
  const h = 1 / SPRING_WIND_NPT;
  const iFull = SPRING_WIND_NPT;             // the t = 1 node
  const W = FUSEE_WRAP_TURNS, P = FUSEE_LEVEL_P, Rw = DRUM_WRAP_R, D = FUSEE_DRUM_DIST, G = FUSEE_GROOVE_TURNS;
  const lead = FUSEE_GROOVE_PITCH / (2 * Math.PI); // the groove's rise per radian of helix
  const RwEff = Math.hypot(Rw, CHAIN_COIL_PITCH / (2 * Math.PI)); // the coil's helix factor
  // §254 (TODO 49) — THE WRAP IS HOOKED TO THE CONE, so its angular extent is
  // hook-to-departure: the cone turns 2π·W per unit reserve under the hook
  // while the tangent DEPARTURE walks as the cone's radius changes — the same
  // walk the coil's Ω(u) below carries, read from the other end of the same
  // tangent line. In band fractions the departure stands at
  //   f_dep(t) = t·F_ACTIVE + [acos(x(1)) − acos(x(t))] / (2π·G),  x = (P/u − R_wrap)/D
  // — sense-free (acos x is the tangent line's half-angle off the centre
  // line; spanTangentAngle's branch carries the sense) and f_dep(1) = F_ACTIVE
  // exactly, which is what clocks the hook: the last link arrives at full wrap
  // as the arrest requires. The old wrap was anchored at the DEPARTURE
  // (wraps = t·W) and its hook end drifted around the cone by exactly this
  // walk — the drift TODO 49 measured.
  const acosX = (ui) => Math.acos(clamp((P / ui - Rw) / D, -1, 1));
  const fDepAt = (t, ui, u1) => t * FUSEE_F_ACTIVE + (acosX(u1) - acosX(ui)) / (2 * Math.PI * G);
  const spanAt = (t, ui, u1) => {
    const dz = (FUSEE_Z0 + FUSEE_ZSPAN * fDepAt(t, ui, u1))
      - (COIL_TOP - ((u1 - ui) / (2 * Math.PI) + DRUM_COIL_SLACK_TURNS) * CHAIN_COIL_PITCH);
    const dr = Rw - P / ui;
    return { S: Math.sqrt(D * D - dr * dr + dz * dz), dz, Sp: Math.sqrt(D * D - dr * dr) };
  };
  // Ω(u): the coil's angular span up to constants — the hook turns with the
  // drum (−u) while the tangent departure walks with the radius
  // (acos((r − R_wrap)/D) is thetaT's alpha). Closed in u, so the
  // conservation check reads the coil's chain without trusting the stepper.
  const coilAngleAt = (ui) => -ui + acosX(ui);
  const integrate = (u1, live) => {
    const u = new Float64Array(N + 1), c = new Float64Array(N + 1);
    u[0] = SETUP_SWEEP;
    // u′ and the wrap's take-up rate c′ share the walk, so one evaluation
    // returns both. With Φ the wrap's angle, dΦ/dt = 2π·W − g·u′/S_p (the
    // cone's turn less the departure's walk), the wrap gains √(r² + lead²)
    // of chain per radian of Φ and its departure climbs lead per radian;
    // conservation against the span's give and the coil's Ω(u) then reads
    // u′ in closed form (the walk's two terms are the last two of the
    // denominator — drop them and this is §150's departure-anchored law).
    const rates = (t, ui) => {
      const r = P / ui;
      if (!live || t > 1) {                                  // S′ ≡ 0, departure-anchored: the closed form's branch, and the runout past t = 1
        return { du: (2 * Math.PI * W * r) / Rw, dc: 2 * Math.PI * W * Math.hypot(r, lead) };
      }
      const { S, dz, Sp } = spanAt(t, ui, u1);
      const g = P / (ui * ui);                               // −dr/du
      const helix = Math.hypot(r, lead) + (dz * lead) / S;   // chain the wrap and the span's z leg take per radian of Φ
      const du = (2 * Math.PI * W * helix)
        / (RwEff * (1 - g / Sp) + ((Rw - r) * g) / S + (dz * CHAIN_COIL_PITCH) / (2 * Math.PI * S) + (g / Sp) * helix);
      const dPhi = 2 * Math.PI * W - (g * du) / Sp;
      return { du, dc: Math.hypot(r, lead) * dPhi };
    };
    for (let i = 0; i < N; i++) {
      const t = i * h, ui = u[i], ci = c[i];
      const k1 = rates(t, ui);
      const k2 = rates(t + h / 2, ui + (h / 2) * k1.du);
      const k3 = rates(t + h / 2, ui + (h / 2) * k2.du);
      const k4 = rates(t + h, ui + h * k3.du);
      u[i + 1] = ui + (h / 6) * (k1.du + 2 * k2.du + 2 * k3.du + k4.du);
      c[i + 1] = ci + (h / 6) * (k1.dc + 2 * k2.dc + 2 * k3.dc + k4.dc);
    }
    return { u, c };
  };
  // Fixed passes for the Δz coil term's u(1): seed from the closed form,
  // feed each pass's endpoint into the next. Three passes land the
  // dependence (weak by construction) at float noise; the fourth proves it.
  let u1 = Math.sqrt(SETUP_SWEEP * SETUP_SWEEP + SPRING_WIND_BETA);
  let sol = null;
  for (let pass = 0; pass < 4; pass++) {
    sol = integrate(u1, true);
    const next = sol.u[iFull];
    if (pass === 3 && Math.abs(next - u1) > 1e-9)
      console.warn(`fusee solve: u(1) passes did not converge — |Δ| ${Math.abs(next - u1).toExponential(2)} > 1e-9`);
    u1 = next;
  }
  // Control — the S′ ≡ 0 branch must reproduce the closed form (proves the
  // integrator against the algebra it generalises).
  {
    const ctrl = integrate(u1, false).u;
    let worst = 0;
    for (let i = 0; i <= iFull; i++)
      worst = Math.max(worst, Math.abs(ctrl[i] - Math.sqrt(SETUP_SWEEP * SETUP_SWEEP + SPRING_WIND_BETA * i * h)));
    if (worst > 1e-9)
      console.warn(`fusee solve: S′≡0 control off the closed form by ${worst.toExponential(2)} (> 1e-9)`);
  }
  // Conservation — the whole point, re-read from the solved tables rather
  // than trusted from the stepper: cone + span + coil must be one length at
  // every node of the reserve, with the coil's chain read through Ω(u) —
  // the drawn construction's own angle law — not through the integrator.
  {
    const uF = sol.u[iFull];
    let worst = 0;
    const L0 = sol.c[0] + spanAt(0, sol.u[0], uF).S + RwEff * coilAngleAt(sol.u[0]);
    for (let i = 1; i <= iFull; i++) {
      const L = sol.c[i] + spanAt(i * h, sol.u[i], uF).S + RwEff * coilAngleAt(sol.u[i]);
      worst = Math.max(worst, Math.abs(L - L0));
    }
    if (worst > 1e-9)
      console.warn(`fusee solve: chain conservation drifts ${worst.toExponential(2)} over the reserve (> 1e-9)`);
    for (let i = 0; i < N; i++)
      if (!(sol.u[i + 1] > sol.u[i])) {
        console.warn(`fusee solve: u table not strictly increasing at node ${i}`);
        break;
      }
  }
  // §254 — the departure's band fraction on the same grid, with u(1) FINAL so
  // f_dep(1) is F_ACTIVE to the bit; the cut below is parametrised by it.
  {
    const uF = sol.u[iFull];
    sol.fDep = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) sol.fDep[i] = fDepAt(i * h, sol.u[i], uF);
    for (let i = 0; i < N; i++)
      if (!(sol.fDep[i + 1] > sol.fDep[i])) {
        console.warn(`fusee solve: the departure f_dep(t) is not strictly increasing at node ${i} — the walk outran the cone's turn, and the cut cannot be read back from it`);
        break;
      }
  }
  return sol;
}
