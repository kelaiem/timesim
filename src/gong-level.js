// BUILT §320 — THE GONG'S LEVEL LAW, its pure leaves in one place. They were written inside main.js's
// GONG_ACOUSTICS block (§197, §253, §269, §310) and moved here VERBATIM, so the build and the volume
// prototype (src/alarm-volume.js) read one law: the same operations in the same order, the build's
// numbers bit for bit (probe-197-gong-loudness, probe-310-gong-seat hold them). Pure: no DOM, no three.js.

// §269 — the air, and the ear's weighting, named once: GONG_ACOUSTICS (the
// wire) and GONG_CASE_PATH (the case) radiate into the same room.
export const AIR_RHO = 1.2, AIR_C = 343;                    // 20 °C, 1 atm
export const REST = 0.8;                                    // coefficient of restitution, hardened steel on steel
// Poisson's ratio, steel — the Hertz contact's only extra constant. NOTE: layout.js' STEEL_NU is 0.30; this
// 0.29 is the acoustics block's own, moved as it stood so no number moves (the two disagree; §320 records it)
export const CONTACT_NU = 0.29;
export const aWeight = (f) => {                         // IEC 61672 A-weighting, dB
  const f2 = f * f;
  const num = 12194 ** 2 * f2 * f2;
  const den = (f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2);
  return 20 * Math.log10(num / den) + 2.0;
};

// §197 — the hand-off: the share of the blow's energy an elastic impact of restitution `rest` leaves in a
// body of mass ratio mu (the head over the mass the wire presents at the contact), peaking at mu = 1.
export const eta = (mu, rest = REST) => (4 * mu / (1 + mu) ** 2) * ((1 + rest) / 2) ** 2;
// §197 — the contact's spectrum: a half-sine force pulse of duration tau drives a mode at f by this factor
// (1 at f = 0, a zero at f = 1.5/tau), so the blow reaches only the modes its contact is short enough for.
export const contactSpectrum = (f, tau) => { const x = 2 * f * tau;
  return Math.abs(Math.cos(Math.PI * f * tau) / (Math.abs(1 - x * x) < 1e-12 ? 1e-12 : 1 - x * x)); };
// §310 landing 2 — a straight wire meets the flat face along a LINE the face's own width long, whose stiffness
// is linear, ¼πE*ℓ (E* the steel pair's, E/(2(1 − ν²))); the build's own association, ((π/4)·E*)·ℓ_u·U, kept
export const lineStiffness = (Estar, faceW_u, U) => (Math.PI / 4) * Estar * faceW_u * U;
// a LINEAR contact (the line, or TODO 269's squared end) lasts half its period whatever the speed
export const linearContactTau = (mRed, k) => Math.PI * Math.sqrt(mRed / k);

// §310 landing 2 — the far field's two integrals for ANY planar wire, by direct quadrature over the hemisphere
// (doubled: the wire's plane is a mirror): F(ϑ, ϕ) = Σ c_i φ_i (n̂_i·r̂) e^{−ik r̂·x_i} Δs, each element a dipole
// along its in-plane normal. `frame` is the wire's stations { L_m, x, y, nx, ny } about its centroid (m).
export const radiationFactorsPath = (shape, frame, kAc) => {
  // every second station (81 of 161: the shortest wavelength the record counts, 20 kHz, is 17 mm against a
  // station spacing under 0.3 mm), 32 × 64 directions — the boot's budget, held to the series by the probe
  const NG = shape.length - 1, NT = 32, NP = 64, ST = 2, ds = frame.L_m / NG * ST;
  let sph = 0, peak = 0;
  for (let t = 0; t < NT; t++) {
    const th = (t + 0.5) / NT * Math.PI / 2, st = Math.sin(th);
    for (let p = 0; p < NP; p++) {
      const ph = p / NP * 2 * Math.PI, cx = st * Math.cos(ph), cy = st * Math.sin(ph);
      let re = 0, im = 0;
      for (let q = 0; q <= NG; q += ST) {
        const c = (q === 0 || q === NG) ? 0.5 : 1, a = c * shape[q] * (frame.nx[q] * cx + frame.ny[q] * cy) * ds, arg = -kAc * (frame.x[q] * cx + frame.y[q] * cy);
        re += a * Math.cos(arg); im += a * Math.sin(arg);
      }
      const F2 = re * re + im * im;
      sph += 2 * F2 * st * (Math.PI / 2 / NT) * (2 * Math.PI / NP);
      if (F2 > peak) peak = F2;
    }
  }
  return { sph, peak };
};
