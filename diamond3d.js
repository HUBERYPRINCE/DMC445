/**
 * Diamond3D_Pro Mathematical 3D Geometry & PBR Facet Shader Engine
 * Ported 1:1 from:
 *   /Users/hubery/Documents/ObsidianHUBERY/Information Seach/3DHtml-Diamond /Diamond3D_Pro/index.html
 *
 * Models:
 *   - Square Drill (方钻): 5-tier 25-facet pyramid (Central Inner Rhombus + Outer Rhombus Bevel
 *     + 4 Diagonal 45° Crown Quads + 4 Cardinal Star Triangles + 4 Corner Bevel Triangles
 *     + 4 Outer Trapezoidal Bevels + 4 Base Apron Walls)
 *   - Round Drill (圆钻): 26-facet Magic Cube Round Drill rotated 53° (4 Central Micro-Domed
 *     Table Triangles + 4 Orthogonal Crown Squares + 4 Corner Diagonal Quads + 12 Outer Bevel
 *     Quads + 12 Cylindrical Girdle Walls)
 *   - 5 Finishes: 💎 树脂 (resin) | ✨ AB (ab) | 🧚 仙尘 (fairy) | 🔮 水晶 (crystal) | 🌟 炫彩 (chameleon)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Diamond3DPro = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-5));
    return t * t * (3 - 2 * t);
  }

  function normalize3(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function dot2(ax, ay, bx, by) {
    return ax * bx + ay * by;
  }

  function hexToRgb(hex) {
    if (Array.isArray(hex) && hex.length >= 3) {
      return [Number(hex[0]) || 0, Number(hex[1]) || 0, Number(hex[2]) || 0];
    }
    const clean = String(hex || '#2673e7').trim().replace(/^#/, '');
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16) || 0,
        parseInt(clean[1] + clean[1], 16) || 0,
        parseInt(clean[2] + clean[2], 16) || 0
      ];
    }
    if (clean.length >= 6) {
      return [
        parseInt(clean.slice(0, 2), 16) || 0,
        parseInt(clean.slice(2, 4), 16) || 0,
        parseInt(clean.slice(4, 6), 16) || 0
      ];
    }
    return [38, 115, 231];
  }

  function computeFaceNormal(a, b, c) {
    let v1 = a;
    let v2 = b;
    let v3p = c;
    const crossZ = (v2[0] - v1[0]) * (v3p[1] - v1[1]) - (v2[1] - v1[1]) * (v3p[0] - v1[0]);
    if (crossZ < 0) {
      v2 = c;
      v3p = b;
    }
    const ux = v2[0] - v1[0];
    const uy = v2[1] - v1[1];
    const uz = v2[2] - v1[2];
    const vx = v3p[0] - v1[0];
    const vy = v3p[1] - v1[1];
    const vz = v3p[2] - v1[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    if (nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  function computeOutwardNormal(p0, p1, p2, refX, refY) {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    if (nx * refX + ny * refY + nz * 0.6 < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  // ==========================================================================
  // 1. Square Drill Geometry (25 Coplanar Facets — Diamond3D_Pro lines 1330-1479)
  // ==========================================================================
  function buildSquareDrillFacets() {
    const facets = [];
    const half = 0.5;
    const heightScale = 1.0 / 18.5;

    function v3(nx, nyDown, zHeight) {
      return [nx * half, -nyDown * half, zHeight * heightScale];
    }

    const Z_INNER = 6.40;
    const Z_OUTER = 6.10;
    const Z_CROWN = 3.55;
    const Z_BEVEL = 1.55;
    const Z_BASE = 0.00;

    // 1. Central inner rhombus (4 vertices)
    const ciT = v3(0.00, -0.30, Z_INNER);
    const ciR = v3(0.30, 0.00, Z_INNER);
    const ciB = v3(0.00, 0.30, Z_INNER);
    const ciL = v3(-0.30, 0.00, Z_INNER);

    // 2. Central outer rhombus bright bevel ring (4 vertices)
    const cT = v3(0.00, -0.42, Z_OUTER);
    const cR = v3(0.42, 0.00, Z_OUTER);
    const cB = v3(0.00, 0.42, Z_OUTER);
    const cL = v3(-0.42, 0.00, Z_OUTER);

    // 3. 4 Diagonal 45° rectangular crown quads (8 vertices)
    const nwT = v3(-0.36, -0.78, Z_CROWN);
    const nwL = v3(-0.78, -0.36, Z_CROWN);
    const neT = v3(0.36, -0.78, Z_CROWN);
    const neR = v3(0.78, -0.36, Z_CROWN);
    const swL = v3(-0.78, 0.36, Z_CROWN);
    const swB = v3(-0.36, 0.78, Z_CROWN);
    const seB = v3(0.36, 0.78, Z_CROWN);
    const seR = v3(0.78, 0.36, Z_CROWN);

    // 4. Outer bevel ring (4 vertices)
    const pUL = v3(-0.93, -0.93, Z_BEVEL);
    const pUR = v3(0.93, -0.93, Z_BEVEL);
    const pBR = v3(0.93, 0.93, Z_BEVEL);
    const pBL = v3(-0.93, 0.93, Z_BEVEL);

    // 5. Base square apron (4 vertices)
    const bUL = v3(-1.00, -1.00, Z_BASE);
    const bUR = v3(1.00, -1.00, Z_BASE);
    const bBR = v3(1.00, 1.00, Z_BASE);
    const bBL = v3(-1.00, 1.00, Z_BASE);

    function addPoly(verts, tag) {
      const normal = computeFaceNormal(verts[0], verts[1], verts[2]);
      facets.push({ verts, normal, tag });
    }

    // (1) Central inner rhombus table + 4 outer rhombus bright bevel trapezoids (5 facets)
    addPoly([ciT, ciR, ciB, ciL], 'table');
    addPoly([cT, cR, ciR, ciT], 'tableBevel');
    addPoly([cR, cB, ciB, ciR], 'tableBevel');
    addPoly([cB, cL, ciL, ciB], 'tableBevel');
    addPoly([cL, cT, ciT, ciL], 'tableBevel');

    // (2) 4 Diagonal 45° rectangular main crown quads (4 facets)
    addPoly([cT, cL, nwL, nwT], 'crownQuad');
    addPoly([cR, cT, neT, neR], 'crownQuad');
    addPoly([cL, cB, swB, swL], 'crownQuad');
    addPoly([cB, cR, seR, seB], 'crownQuad');

    // (3) 4 Cardinal star triangles (4 facets)
    addPoly([cT, nwT, neT], 'starTri');
    addPoly([cB, seB, swB], 'starTri');
    addPoly([cL, nwL, swL], 'starTri');
    addPoly([cR, seR, neR], 'starTri');

    // (4) 4 Corner bevel triangles + 4 Outer trapezoidal bevels (8 facets)
    addPoly([nwT, nwL, pUL], 'cornerBevel');
    addPoly([neR, neT, pUR], 'cornerBevel');
    addPoly([swL, swB, pBL], 'cornerBevel');
    addPoly([seB, seR, pBR], 'cornerBevel');

    addPoly([neT, nwT, pUL, pUR], 'outerBevel');
    addPoly([nwL, swL, pBL, pUL], 'outerBevel');
    addPoly([swB, seB, pBR, pBL], 'outerBevel');
    addPoly([seR, neR, pUR, pBR], 'outerBevel');

    // (5) 4 Base apron walls (4 facets) -> Total = 25 coplanar facets
    addPoly([pUR, pUL, bUL, bUR], 'apron');
    addPoly([pUL, pBL, bBL, bUL], 'apron');
    addPoly([pBL, pBR, bBR, bBL], 'apron');
    addPoly([pBR, pUR, bUR, bBR], 'apron');

    return facets;
  }

  // ==========================================================================
  // 2. Round Drill Geometry (26-Facet Magic Cube + 12-Fold Starburst Special Round)
  // ==========================================================================
  function buildRoundDrillFacets() {
    const facets = [];
    const segs = 12;
    const a = 0.102;
    const b = 0.296;
    const c = 0.264;
    const rGirdle = 0.490;
    const rBase = 0.500;

    const z0 = 0.000;
    const z1 = 0.085;
    const z2c = 0.228;
    const z2 = 0.295;
    const z3 = 0.402;
    const zApex = 0.426;

    const rotOffset = (53.0 * Math.PI) / 180.0;
    const cosR = Math.cos(rotOffset);
    const sinR = Math.sin(rotOffset);

    function rotPt(x, y, z) {
      return [x * cosR - y * sinR, x * sinR + y * cosR, z];
    }

    function addPoly(verts, tag) {
      let cx = 0,
        cy = 0;
      for (let i = 0; i < verts.length; i++) {
        cx += verts[i][0];
        cy += verts[i][1];
      }
      cx /= verts.length;
      cy /= verts.length;
      const normal = computeOutwardNormal(verts[0], verts[1], verts[2], cx, cy);
      facets.push({ verts, normal, tag });
    }

    const P_APEX = [0, 0, zApex];
    const C00 = rotPt(-a, -a, z3);
    const C10 = rotPt(a, -a, z3);
    const C11 = rotPt(a, a, z3);
    const C01 = rotPt(-a, a, z3);

    addPoly([P_APEX, C00, C10], 'centerCap');
    addPoly([P_APEX, C10, C11], 'centerCap');
    addPoly([P_APEX, C11, C01], 'centerCap');
    addPoly([P_APEX, C01, C00], 'centerCap');

    const V0 = rotPt(b, -a, z2);
    const V1 = rotPt(b, a, z2);
    const V2 = rotPt(c, c, z2c);
    const V3 = rotPt(a, b, z2);
    const V4 = rotPt(-a, b, z2);
    const V5 = rotPt(-c, c, z2c);
    const V6 = rotPt(-b, a, z2);
    const V7 = rotPt(-b, -a, z2);
    const V8 = rotPt(-c, -c, z2c);
    const V9 = rotPt(-a, -b, z2);
    const V10 = rotPt(a, -b, z2);
    const V11 = rotPt(c, -c, z2c);

    addPoly([C10, V0, V1, C11], 'cardinalSq');
    addPoly([C11, V3, V4, C01], 'cardinalSq');
    addPoly([C01, V6, V7, C00], 'cardinalSq');
    addPoly([C00, V9, V10, C10], 'cardinalSq');

    addPoly([C11, V1, V2, V3], 'cornerQuad');
    addPoly([C01, V4, V5, V6], 'cornerQuad');
    addPoly([C00, V7, V8, V9], 'cornerQuad');
    addPoly([C10, V10, V11, V0], 'cornerQuad');

    const V_RING = [V0, V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11];
    const girdleDeg = [-18, 18, 45, 72, 108, 135, 162, 198, 225, 252, 288, 315];
    const G_RING = [];
    const B_RING = [];
    for (let i = 0; i < segs; i++) {
      const rad = (girdleDeg[i] * Math.PI) / 180.0;
      const gx = Math.cos(rad);
      const gy = Math.sin(rad);
      G_RING.push(rotPt(gx * rGirdle, gy * rGirdle, z1));
      B_RING.push(rotPt(gx * rBase, gy * rBase, z0));
    }

    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      addPoly([G_RING[i], G_RING[ni], V_RING[ni], V_RING[i]], 'outerBevel');
      addPoly([B_RING[i], B_RING[ni], G_RING[ni], G_RING[i]], 'girdleWall');
    }

    return facets;
  }

  // Special Round Drill Geometry (aSpecPos / aSpecNormal — Diamond3D_Pro lines 1485-1510)
  function buildSpecialRoundDrillFacets() {
    const facets = [];
    const segs = 12;
    const sr0 = 0.50,
      sr1 = 0.48,
      sr2 = 0.34,
      sr3 = 0.19;
    const sz0 = 0.00,
      sz1 = 0.10,
      sz2 = 0.27,
      sz3 = 0.40;

    function circleRing(r, z, phase) {
      const pts = [];
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2 + phase;
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r, z]);
      }
      return pts;
    }

    const SR0 = circleRing(sr0, sz0, 0);
    const SR1 = circleRing(sr1, sz1, 0);
    const SR2 = circleRing(sr2, sz2, Math.PI / segs);
    const SR3 = circleRing(sr3, sz3, 0);

    function addPoly(verts, tag) {
      let cx = 0,
        cy = 0;
      for (let i = 0; i < verts.length; i++) {
        cx += verts[i][0];
        cy += verts[i][1];
      }
      cx /= verts.length;
      cy /= verts.length;
      const normal = computeOutwardNormal(verts[0], verts[1], verts[2], cx, cy);
      facets.push({ verts, normal, tag });
    }

    // 12-sided circular top table
    addPoly(SR3.slice(), 'centerCap');

    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      addPoly([SR2[i], SR2[ni], SR3[ni], SR3[i]], 'cardinalSq');
      addPoly([SR1[i], SR1[ni], SR2[i]], 'cornerQuad');
      addPoly([SR1[ni], SR2[ni], SR2[i]], 'outerBevel');
      addPoly([SR0[i], SR0[ni], SR1[ni], SR1[i]], 'girdleWall');
    }
    return facets;
  }

  const SQUARE_FACETS = buildSquareDrillFacets();
  const ROUND_FACETS = buildRoundDrillFacets();
  const SPECIAL_ROUND_FACETS = buildSpecialRoundDrillFacets();

  // Studio Three-Point Lights (from Diamond3D_Pro lines 2394-2400)
  const L_KEY = normalize3([-0.52, 0.42, 0.74]);
  const L_FILL = normalize3([0.55, -0.38, 0.74]);
  const L_TOP = normalize3([0.0, 0.65, 0.76]);
  const L_RIM = normalize3([0.62, 0.62, 0.48]);

  function rotateVec3(p, rxRad, ryRad) {
    const cosY = Math.cos(ryRad);
    const sinY = Math.sin(ryRad);
    const x1 = p[0] * cosY + p[2] * sinY;
    const y1 = p[1];
    const z1 = -p[0] * sinY + p[2] * cosY;

    const cosX = Math.cos(rxRad);
    const sinX = Math.sin(rxRad);
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    return [x2, y2, z2];
  }

  // ==========================================================================
  // 3. Diamond3D_Pro Per-Facet Optical Shader (6 Finishes + 3 LightFX Modes)
  // ==========================================================================
  function shadeFacetRgb(baseRgb, ON, WN, isRound, finishMode, tag, phase, sweepGain, fxOpts) {
    const vPhase = typeof phase === 'number' ? phase : 0.0;
    const sGain = typeof sweepGain === 'number' && sweepGain > 0 ? clamp01(sweepGain) : 0.0;
    const vPhaseSin = Math.sin(vPhase);
    const r0 = (baseRgb[0] || 0) / 255;
    const g0 = (baseRgb[1] || 0) / 255;
    const b0 = (baseRgb[2] || 0) / 255;

    const minLift = 0.065;
    const dr = Math.max(minLift, r0);
    const dg = Math.max(minLift + 0.005, g0);
    const db = Math.max(minLift + 0.015, b0);

    const NdotV = clamp01(WN[2]);
    const isTable = ON[2] >= 0.92 ? 1.0 : 0.0;

    // 1. Base Three-Point PBR diffuse
    const diffKey = Math.max(0, dot3(WN, L_KEY));
    const diffFill = Math.max(0, dot3(WN, L_FILL));
    const diffTop = Math.max(0, dot3(WN, L_TOP));

    const diffuseFactor = 0.44 + 0.52 * diffKey + 0.22 * diffFill + 0.16 * diffTop;
    let cr = dr * diffuseFactor;
    let cg = dg * diffuseFactor;
    let cb = db * diffuseFactor;

    const wnLen = Math.hypot(WN[0], WN[1]) || 1e-5;
    const wnx = WN[0] / wnLen;
    const wny = WN[1] / wnLen;

    const azCos = dot2(wnx, wny, -0.5048461, 0.8632094);
    const rawContrast = mix(0.80 + 0.30 * azCos, 1.04, Math.max(isTable, isRound ? 0.45 : 0.0));
    cr *= rawContrast;
    cg *= rawContrast;
    cb *= rawContrast;

    const dLum = 0.299 * dr + 0.587 * dg + 0.114 * db;
    const richR = clamp01(mix(dLum, dr, 1.24));
    const richG = clamp01(mix(dLum, dg, 1.24));
    const richB = clamp01(mix(dLum, db, 1.24));

    if (isRound) {
      cr = mix(cr, richR * (0.85 + 0.20 * NdotV), 0.62);
      cg = mix(cg, richG * (0.85 + 0.20 * NdotV), 0.62);
      cb = mix(cb, richB * (0.85 + 0.20 * NdotV), 0.62);

      const align233 = dot2(wnx, wny, -0.601815, 0.798635);
      const align186 = dot2(wnx, wny, -0.99367, 0.112336);
      const align143 = dot2(wnx, wny, -0.798635, -0.601815);
      const alignNE = dot2(wnx, wny, 0.707107, 0.707107);
      const alignSE = dot2(wnx, wny, 0.707107, -0.707107);

      const isCenterCap = tag === 'centerCap' ? 1.0 : 0.0;
      const isCardinalSq = tag === 'cardinalSq' ? 1.0 : 0.0;
      const isCornerQuad = tag === 'cornerQuad' ? 1.0 : 0.0;
      const isOuterBevel = tag === 'outerBevel' ? 1.0 : 0.0;
      const isGirdleWall = tag === 'girdleWall' ? 1.0 : 0.0;

      const vOuterChecker = 0.075 * Math.cos((Math.atan2(ON[1], ON[0]) - 0.925025) * 6.0);
      const mask143 = smoothstep(0.75, 0.96, align143);
      const mask233 = smoothstep(0.76, 0.96, align233);
      const mask186 = smoothstep(0.75, 0.95, align186);

      const gridStepTone =
        1.0 +
        isCenterCap * (0.07 - 0.08 * alignSE + 0.06 * align143) +
        isCardinalSq * (0.14 * mask143 - 0.12 * alignSE) +
        isCornerQuad * (-0.06 - 0.10 * alignSE) +
        isOuterBevel * (-0.12 - 0.10 * alignSE + 0.13 * Math.max(0, alignNE) + vOuterChecker) +
        isGirdleWall * (-0.24 + 0.18 * Math.max(0, alignNE));

      cr *= gridStepTone;
      cg *= gridStepTone;
      cb *= gridStepTone;

      const hiPrimaryR = mix(richR * 1.18, 0.98, 0.62);
      const hiPrimaryG = mix(richG * 1.18, 0.97, 0.62);
      const hiPrimaryB = mix(richB * 1.18, 1.00, 0.62);

      const g1 = clamp01((mask233 * isCardinalSq * 0.76 + mask143 * isCardinalSq * 0.58) * (0.82 + 0.18 * vPhaseSin));
      const g2 = clamp01(mask186 * isCornerQuad * 0.62 * (0.82 - 0.18 * vPhaseSin));
      cr = mix(cr, hiPrimaryR, g1);
      cg = mix(cg, hiPrimaryG, g1);
      cb = mix(cb, hiPrimaryB, g1);

      cr = mix(cr, Math.min(0.96, richR * 1.35 + 0.14), g2);
      cg = mix(cg, Math.min(0.96, richG * 1.35 + 0.14), g2);
      cb = mix(cb, Math.min(0.96, richB * 1.35 + 0.14), g2);
    } else {
      const alignNW = dot2(wnx, wny, -0.707107, 0.707107);
      const alignNE = dot2(wnx, wny, 0.707107, 0.707107);
      let sqStep = 1.0;
      if (tag === 'table') {
        sqStep = 1.06;
      } else if (tag === 'tableBevel') {
        sqStep = 1.14 + 0.28 * alignNW + 0.06 * alignNE;
      } else if (tag === 'crownQuad') {
        sqStep = 0.98 + 0.30 * alignNW + 0.08 * alignNE;
      } else if (tag === 'starTri') {
        sqStep = 0.92 + 0.34 * alignNW - 0.06 * alignNE;
      } else if (tag === 'cornerBevel') {
        sqStep = 0.88 + 0.28 * alignNW;
      } else if (tag === 'outerBevel') {
        sqStep = 0.84 + 0.32 * alignNW + 0.05 * alignNE;
      } else if (tag === 'apron') {
        sqStep = 0.66 + 0.20 * alignNW;
      }
      cr *= sqStep;
      cg *= sqStep;
      cb *= sqStep;
    }

    // 2. Clearcoat Specular Reflection & 5-Softbox Jewel Studio EnvMap (from createJewelStudioEnvMap, IOR=1.56)
    const H1 = normalize3([L_KEY[0], L_KEY[1], L_KEY[2] + 1.0]);
    const H2 = normalize3([L_TOP[0], L_TOP[1], L_TOP[2] + 1.0]);
    const H3 = normalize3([L_RIM[0], L_RIM[1], L_RIM[2] + 1.0]);
    const spec1 = Math.pow(Math.max(0, dot3(WN, H1)), 22) * (1.0 - isTable * 0.35);
    const spec2 = Math.pow(Math.max(0, dot3(WN, H2)), 34) * (0.7 + 0.3 * isTable);
    const spec3 = Math.pow(Math.max(0, dot3(WN, H3)), 18) * (1.0 - isTable * 0.5);
    const specTotal = spec1 * 0.54 + spec2 * 0.38 + spec3 * 0.22;

    // Reflection vector R = reflect(-V, WN) where V = (0,0,1) => R = (2*Nz*Nx, 2*Nz*Ny, 2*Nz^2 - 1)
    const rx = 2.0 * WN[2] * WN[0];
    const ry = 2.0 * WN[2] * WN[1];
    const rz = 2.0 * WN[2] * WN[2] - 1.0;

    // 5 Softboxes from Diamond3D_Pro createJewelStudioEnvMap (lines 2348-2378)
    // Softbox 1: Key Warm Ivory (-0.52, -0.52, 0.68) -> rgb(1.00, 0.98, 0.95)
    const sb1 = Math.pow(Math.max(0, rx * -0.52 + ry * -0.52 + rz * 0.68), 8) * 0.92;
    // Softbox 2: Rim Cool Ice Blue (0.55, 0.48, 0.68) -> rgb(0.88, 0.95, 1.00)
    const sb2 = Math.pow(Math.max(0, rx * 0.55 + ry * 0.48 + rz * 0.68), 9) * 0.86;
    // Softbox 3: Top Zenith Pure White (0.0, -0.12, 0.99) -> rgb(1.00, 1.00, 1.00)
    const sb3 = Math.pow(Math.max(0, ry * -0.12 + rz * 0.99), 14) * 0.78 * (1.0 - isTable * 0.45);
    // Softbox 4: Mid-Left Warm Amber (-0.78, 0.22, 0.58) -> rgb(0.99, 0.90, 0.78)
    const sb4 = Math.pow(Math.max(0, rx * -0.78 + ry * 0.22 + rz * 0.58), 7) * 0.58;
    // Softbox 5: Mid-Right Soft Lavender (0.76, -0.28, 0.58) -> rgb(0.85, 0.71, 1.00)
    const sb5 = Math.pow(Math.max(0, rx * 0.76 + ry * -0.28 + rz * 0.58), 7) * 0.55;

    const envR = sb1 * 1.00 + sb2 * 0.88 + sb3 * 1.00 + sb4 * 0.99 + sb5 * 0.85;
    const envG = sb1 * 0.98 + sb2 * 0.95 + sb3 * 1.00 + sb4 * 0.90 + sb5 * 0.71;
    const envB = sb1 * 0.95 + sb2 * 1.00 + sb3 * 1.00 + sb4 * 0.78 + sb5 * 1.00;

    // Schlick Fresnel for Acrylic/Epoxy Resin IOR = 1.56 (F0 = ((1.56-1)/(1.56+1))^2 = 0.048)
    const fresnelClearcoat = 0.048 + (1.0 - 0.048) * Math.pow(1.0 - NdotV, 3.2);
    const envWeight = (0.20 + 0.58 * fresnelClearcoat) * (1.0 - isTable * 0.35);

    cr += specTotal * 0.98 + envR * envWeight;
    cg += specTotal * 0.97 + envG * envWeight;
    cb += specTotal * 1.00 + envB * envWeight;

    // 3. Epoxy Resin Subsurface Glow & Ultra-Dark Pavilion Foil Bounce
    const rimTerm = Math.pow(1.0 - NdotV, 2.15) * (1.0 - isTable * 0.5);
    const sssFactor = 0.13 * (isRound ? 0.45 : 1.0) * (0.42 + 0.58 * rimTerm);
    cr += Math.pow(dr, 0.76) * sssFactor;
    cg += Math.pow(dg, 0.76) * sssFactor;
    cb += Math.pow(db, 0.76) * sssFactor;

    if (dLum < 0.14 && finishMode !== 'ab') {
      const darkFactor = (0.14 - dLum) / 0.14;
      const foilBounce = darkFactor * (0.045 + 0.055 * Math.max(0, dot3(WN, L_RIM)) + 0.04 * NdotV);
      cr += foilBounce * 0.92;
      cg += foilBounce * 0.96;
      cb += foilBounce * 1.06;
    }

    // 4. Finish Modes (from Diamond3D_Pro lines 3398-3507)
    if (finishMode === 'ab') {
      const opticalPath = (1.0 - NdotV) * 8.6 + (WN[0] * 1.75 - WN[1] * 1.45) * 2.4;
      const wr = 0.5 + 0.5 * Math.cos(opticalPath);
      const wg = 0.5 + 0.5 * Math.cos(opticalPath + 2.094);
      const t1 = smoothstep(0.22, 0.85, wr);
      const t2 = smoothstep(0.15, 0.85, wg);
      const abR = mix(0.26, mix(0.98, 1.00, t1), t2);
      const abG = mix(0.88, mix(0.36, 0.86, t1), t2);
      const abB = mix(1.00, mix(0.88, 0.40, t1), t2);
      const fresnelAB = Math.pow(1.0 - NdotV, 1.35);
      const abMask = clamp01(fresnelAB * 0.78 + (1.0 - isTable * 0.5) * 0.52);
      const paleTone = dLum > 0.80 ? 1.0 - (dLum - 0.80) * 0.65 * (1.0 - NdotV) : 1.0;
      cr = mix(cr, cr * 0.58 * paleTone + abR * 0.56, abMask * 0.76);
      cg = mix(cg, cg * 0.58 * paleTone + abG * 0.56, abMask * 0.76);
      cb = mix(cb, cb * 0.58 * paleTone + abB * 0.56, abMask * 0.76);
    } else if (finishMode === 'fairy') {
      // Fairy Dust: Pearl velvet sheen + mica sparkle lift
      const paleAtten = dLum > 0.80 ? 0.45 : 1.0;
      const pearlAmt = (0.16 + 0.22 * Math.pow(1.0 - NdotV, 1.4)) * paleAtten;
      cr = mix(cr, 0.98, pearlAmt) + specTotal * 0.32 * paleAtten;
      cg = mix(cg, 0.96, pearlAmt) + specTotal * 0.30 * paleAtten;
      cb = mix(cb, 1.00, pearlAmt) + specTotal * 0.36 * paleAtten;
    } else if (finishMode === 'crystal') {
      // Crystal: High-chroma jelly transmission + silver-foil pavilion bounce
      const backMask = clamp01(dot2(wnx, wny, 0.68, -0.73)) * (1.0 - isTable);
      const pavilionDepth = dLum > 0.80 ? mix(0.68, 0.96, NdotV) : 1.0;
      const jellyR = Math.pow(clamp01(mix(dLum, dr, 1.42)), 0.74) * pavilionDepth;
      const jellyG = Math.pow(clamp01(mix(dLum, dg, 1.42)), 0.74) * pavilionDepth;
      const jellyB = Math.pow(clamp01(mix(dLum, db, 1.42)), 0.74) * pavilionDepth;
      cr = mix(cr, jellyR, 0.48) + jellyR * backMask * 0.38 * pavilionDepth + specTotal * 0.32;
      cg = mix(cg, jellyG, 0.48) + jellyG * backMask * 0.38 * pavilionDepth + specTotal * 0.32;
      cb = mix(cb, jellyB, 0.48) + jellyB * backMask * 0.38 * pavilionDepth + specTotal * 0.32;
    } else if (finishMode === 'chameleon') {
      // Chameleon: Vacuum-electroplated thin-film color shift concentrated on crown bevels so base DMC hue stays legible
      const shiftPhase = (1.0 - NdotV) * 5.6 + (WN[0] * 2.2 - WN[1] * 1.9);
      const chR = 0.5 + 0.5 * Math.cos(shiftPhase + 0.2);
      const chG = 0.5 + 0.5 * Math.cos(shiftPhase + 2.1);
      const chB = 0.5 + 0.5 * Math.cos(shiftPhase + 4.2);
      const facetShade = 0.68 + 0.28 * NdotV + 0.22 * Math.max(0, dot3(WN, L_KEY));
      const rimShift = clamp01((1.0 - NdotV) * 0.72 + (1.0 - isTable) * 0.18);
      const specMetal = Math.pow(NdotV, 5.0) * (1.0 - isTable * 0.35) * 0.28;
      cr = mix(cr, (dr * 0.66 + chR * 0.42) * facetShade, rimShift * 0.56) + chR * specMetal;
      cg = mix(cg, (dg * 0.66 + chG * 0.42) * facetShade, rimShift * 0.56) + chG * specMetal;
      cb = mix(cb, (db * 0.66 + chB * 0.42) * facetShade, rimShift * 0.56) + chB * specMetal;
    } else if (finishMode === 'glow') {
      // Night Glow Fluorescent Resin (Diamond3D_Pro line 3505)
      const glowLift = 0.45 + 0.55 * rimTerm;
      cr += 0.05 * glowLift;
      cg += 0.20 * glowLift;
      cb += 0.14 * glowLift;
    }

    // 5. Golden Theater Sweep Directional Beam & Real-time LightFX (Diamond3D_Pro lines 3510-3555)
    if (sGain > 0.005) {
      cr += sGain * 0.44;
      cg += sGain * 0.41;
      cb += sGain * 0.34;
    }

    if (fxOpts && fxOpts.lightFxMode && fxOpts.lightFxMode !== 'none') {
      const fxTime = typeof fxOpts.lightFxTime === 'number' ? fxOpts.lightFxTime : 0.0;
      const uv = Array.isArray(fxOpts.normUV) ? fxOpts.normUV : [WN[0] * 0.45, WN[1] * 0.45];
      const facetSparkle =
        Math.pow(clamp01(WN[0] * Math.cos(fxTime * 2.2 + vPhase) + WN[1] * Math.sin(fxTime * 2.2 + vPhase)), 6.0) *
        (1.0 - isTable * 0.5);
      if (fxOpts.lightFxMode === 'goldSweep') {
        const sweepCenter = Math.sin(fxTime * 1.45) * 1.15;
        const diagCoord = uv[0] * 0.78 - uv[1] * 0.62;
        const distBand = Math.abs(diagCoord - sweepCenter);
        const mainBeam = Math.exp(-distBand * distBand * 9.5);
        const coreBeam = Math.exp(-distBand * distBand * 42.0);
        const boost = mainBeam * 0.24 + coreBeam * 0.28 + facetSparkle * mainBeam * 0.28;
        const dim = 0.76 + 0.36 * mainBeam;
        cr = cr * dim + 1.0 * boost;
        cg = cg * dim + 0.89 * boost;
        cb = cb * dim + 0.64 * boost;
      } else if (fxOpts.lightFxMode === 'auroraPrism') {
        const waveCoord = uv[0] * 2.2 + uv[1] * 1.6 - fxTime * 2.1 + Math.sin(uv[1] * 3.5 + fxTime * 1.3) * 0.45;
        const aR = 0.5 + 0.5 * Math.cos(waveCoord);
        const aG = 0.5 + 0.5 * Math.cos(waveCoord + 2.094);
        const aB = 0.5 + 0.5 * Math.cos(waveCoord + 4.188);
        const ribbonMask = smoothstep(-0.35, 0.85, Math.sin(waveCoord * 1.35));
        const prismGlint = Math.pow(1.0 - NdotV, 1.35) * 0.65 + (1.0 - isTable) * 0.45 + facetSparkle * 0.55;
        cr = mix(cr * 0.86, cr * 0.72 + aR * 0.56, ribbonMask * 0.68) + aR * (ribbonMask * prismGlint * 0.34);
        cg = mix(cg * 0.86, cg * 0.72 + aG * 0.56, ribbonMask * 0.68) + aG * (ribbonMask * prismGlint * 0.34);
        cb = mix(cb * 0.86, cb * 0.72 + aB * 0.56, ribbonMask * 0.68) + aB * (ribbonMask * prismGlint * 0.34);
      } else if (fxOpts.lightFxMode === 'twinStage') {
        const ax = Math.cos(fxTime * 1.65) * 0.56;
        const ay = Math.sin(fxTime * 1.65) * 0.56;
        const bx = Math.cos(-fxTime * 1.35 + 2.04) * 0.56;
        const by = Math.sin(-fxTime * 1.35 + 2.04) * 0.56;
        const coneA = 1.0 - smoothstep(0.08, 0.68, Math.hypot(uv[0] - ax, uv[1] - ay));
        const coneB = 1.0 - smoothstep(0.08, 0.68, Math.hypot(uv[0] - bx, uv[1] - by));
        const stageGain = Math.max(coneA, coneB);
        const dim = 0.72 + 0.32 * stageGain;
        cr = cr * dim + (coneA * 0.99 * 0.24 + coneB * 0.44 * 0.22) + facetSparkle * stageGain * 0.32;
        cg = cg * dim + (coneA * 0.78 * 0.24 + coneB * 0.84 * 0.22) + facetSparkle * stageGain * 0.32;
        cb = cb * dim + (coneA * 0.36 * 0.24 + coneB * 1.00 * 0.22) + facetSparkle * stageGain * 0.32;
      }
    }

    // 6. Soft-Knee Highlight Limiter
    const softKnee = c => {
      const over = Math.max(0, c - 0.78);
      return Math.min(0.98, c - over * (over / (over + 0.32)));
    };
    return [
      Math.round(clamp01(softKnee(cr)) * 255),
      Math.round(clamp01(softKnee(cg)) * 255),
      Math.round(clamp01(softKnee(cb)) * 255)
    ];
  }

  function shadeFacet(baseRgb, ON, WN, isRound, finishMode, tag, phase, sweepGain, fxOpts) {
    const [fr, fg, fb] = shadeFacetRgb(baseRgb, ON, WN, isRound, finishMode, tag, phase, sweepGain, fxOpts);
    return `rgb(${fr},${fg},${fb})`;
  }

  // ==========================================================================
  // 4. Shared 3D Facet Projection Pipeline (Consumed by both SVG & 60fps Canvas)
  // ==========================================================================
  function projectDrill(options, cx, cy, scale) {
    const opts = options || {};
    const rgb = opts.rgb ? hexToRgb(opts.rgb) : hexToRgb(opts.hex);
    const shape = opts.shape === 'square' ? 'square' : 'round';
    const isRound = shape === 'round';
    const rotXDeg = typeof opts.rotX === 'number' ? opts.rotX : 5;
    const rotYDeg = typeof opts.rotY === 'number' ? opts.rotY : -6;
    const finish = opts.finish || 'resin';
    const phase = typeof opts.phase === 'number' ? opts.phase : 0.0;
    const showShadow = opts.showShadow !== false;
    const hasSweep = typeof opts.sweepPos === 'number' && Number.isFinite(opts.sweepPos);
    const sweepPos = hasSweep ? opts.sweepPos : 0.0;
    const L_SWEEP = hasSweep ? normalize3([sweepPos * 0.72, -0.34, 0.88]) : null;
    const lightFxMode = opts.lightFxMode || 'none';
    const lightFxTime = typeof opts.lightFxTime === 'number' ? opts.lightFxTime : 0.0;
    const normUVBase = Array.isArray(opts.normUV) ? opts.normUV : null;

    const rxRad = (rotXDeg * Math.PI) / 180;
    const ryRad = (rotYDeg * Math.PI) / 180;
    const sourceFacets = isRound
      ? finish !== 'resin'
        ? SPECIAL_ROUND_FACETS
        : ROUND_FACETS
      : SQUARE_FACETS;
    const H1 = normalize3([L_KEY[0], L_KEY[1], L_KEY[2] + 1.0]);

    const projected = [];
    let bestGlint = { score: -1, x: cx - scale * 0.14, y: cy - scale * 0.14 };
    let secondGlint = { score: -1, x: cx + scale * 0.16, y: cy - scale * 0.08 };
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

    for (let i = 0; i < sourceFacets.length; i++) {
      const f = sourceFacets[i];
      const rotNorm = rotateVec3(f.normal, rxRad, ryRad);
      if (rotNorm[2] < -0.22) continue;

      let zSum = 0;
      let sxSum = 0;
      let sySum = 0;
      const pts = [];
      const coords = [];
      for (let j = 0; j < f.verts.length; j++) {
        const v = [f.verts[j][0], f.verts[j][1], f.verts[j][2] - 0.16];
        const rv = rotateVec3(v, rxRad, ryRad);
        const persp = 1 + rv[2] * 0.26;
        const px = cx + rv[0] * scale * persp;
        const py = cy - rv[1] * scale * persp;
        coords.push([px, py]);
        pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
        sxSum += px;
        sySum += py;
        zSum += rv[2];
      }
      const avgZ = zSum / f.verts.length;
      const cxFacet = sxSum / f.verts.length;
      const cyFacet = sySum / f.verts.length;
      const normFacetX = (cxFacet - cx) / (scale * 0.48);
      const normFacetY = (cyFacet - cy) / (scale * 0.48);

      let sweepGain = 0.0;
      if (hasSweep) {
        const band = Math.exp(-Math.pow((normFacetX - sweepPos) / 0.34, 2));
        const tiltBoost = 0.45 + 0.55 * Math.max(0, dot3(rotNorm, L_SWEEP));
        const skirtAtten = f.tag === 'apron' || f.tag === 'girdleWall' ? 0.45 : 1.0;
        sweepGain = band * tiltBoost * skirtAtten;
      }

      const fxOpts =
        lightFxMode !== 'none'
          ? {
              lightFxMode,
              lightFxTime,
              normUV: normUVBase || [normFacetX * 0.72, -normFacetY * 0.72]
            }
          : null;

      const rgbTuple = shadeFacetRgb(rgb, f.normal, rotNorm, isRound, finish, f.tag, phase, sweepGain, fxOpts);
      const fill = `rgb(${rgbTuple[0]},${rgbTuple[1]},${rgbTuple[2]})`;
      const keyAlign = dot3(rotNorm, L_KEY);

      let fStroke = lum < 30 ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.22)';
      let fStrokeW = scale * 0.0056;
      if (f.tag === 'table' || f.tag === 'tableBevel' || f.tag === 'centerCap' || f.tag === 'cardinalSq') {
        fStroke =
          lum > 215
            ? 'rgba(23,23,23,0.34)'
            : keyAlign > 0.35
            ? lum < 30
              ? 'rgba(255,255,255,0.64)'
              : 'rgba(255,255,255,0.52)'
            : lum < 30
            ? 'rgba(255,255,255,0.38)'
            : 'rgba(255,255,255,0.28)';
        fStrokeW = scale * 0.0072;
      } else if (f.tag === 'apron' || f.tag === 'girdleWall') {
        fStroke = lum < 30 ? 'rgba(255,255,255,0.24)' : 'rgba(17,17,19,0.36)';
        fStrokeW = scale * 0.0052;
      } else if (lum > 210) {
        fStroke = 'rgba(23,23,23,0.28)';
      } else if (keyAlign < 0.05) {
        fStroke = lum < 30 ? 'rgba(255,255,255,0.20)' : 'rgba(17,17,19,0.26)';
      }

      if (f.tag !== 'apron' && f.tag !== 'girdleWall') {
        const alignScore = dot3(rotNorm, H1);
        if (alignScore > bestGlint.score) {
          secondGlint = { ...bestGlint };
          bestGlint = { score: alignScore, x: cxFacet, y: cyFacet };
        } else if (alignScore > secondGlint.score) {
          secondGlint = { score: alignScore, x: cxFacet, y: cyFacet };
        }
      }

      projected.push({
        coords,
        pts: pts.join(' '),
        cxFacet,
        cyFacet,
        avgZ,
        rgbTuple,
        fill,
        keyAlign,
        stroke: fStroke,
        strokeW: fStrokeW,
        isTopTable: f.tag === 'table' || f.tag === 'centerCap'
      });
    }

    projected.sort((a, b) => a.avgZ - b.avgZ);

    const glintNormX = (bestGlint.x - cx) / (scale * 0.48);
    const glintSweepBoost = hasSweep ? Math.exp(-Math.pow((glintNormX - sweepPos) / 0.34, 2)) * 0.28 : 0.0;
    const fxGlintBoost = lightFxMode !== 'none' ? 0.14 + 0.14 * Math.sin(lightFxTime * 4.2 + phase) : 0.0;
    const glintPower = clamp01((bestGlint.score - 0.45) / 0.55 + glintSweepBoost + fxGlintBoost);

    const subNormX = (secondGlint.x - cx) / (scale * 0.48);
    const subSweepBoost = hasSweep ? Math.exp(-Math.pow((subNormX - sweepPos) / 0.34, 2)) * 0.24 : 0.0;
    const subPower = clamp01((secondGlint.score - 0.42) / 0.58 + subSweepBoost + fxGlintBoost * 0.8);

    return {
      rgb,
      lum,
      isRound,
      rotXDeg,
      rotYDeg,
      finish,
      showShadow,
      projected,
      bestGlint,
      secondGlint,
      glintPower,
      subPower
    };
  }

  function renderSingleDrillInnerSvg(options, cx, cy, scale) {
    const p = projectDrill(options, cx, cy, scale);

    let shadowSvg = '';
    if (p.showShadow) {
      const sx = (cx - p.rotYDeg * 0.16).toFixed(1);
      const sy = (cy + 3.2 + p.rotXDeg * 0.15).toFixed(1);
      const rHalf = (scale * 0.54).toFixed(1);
      const causticCol =
        p.lum > 210
          ? 'rgba(23,23,23,0.14)'
          : p.lum < 30
          ? 'rgba(23,23,23,0.38)'
          : `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},0.26)`;
      if (p.isRound) {
        shadowSvg = `<circle cx="${sx}" cy="${sy}" r="${rHalf}" fill="url(#aoShadow)"/><circle cx="${sx}" cy="${sy}" r="${(scale * 0.38).toFixed(1)}" fill="${causticCol}"/>`;
      } else {
        const x0 = (Number(sx) - Number(rHalf)).toFixed(1);
        const y0 = (Number(sy) - Number(rHalf)).toFixed(1);
        const w = (Number(rHalf) * 2).toFixed(1);
        shadowSvg = `<rect x="${x0}" y="${y0}" width="${w}" height="${w}" rx="4.2" fill="url(#aoShadow)"/><rect x="${(Number(x0) + 3).toFixed(1)}" y="${(Number(y0) + 3).toFixed(1)}" width="${(Number(w) - 6).toFixed(1)}" height="${(Number(w) - 6).toFixed(1)}" rx="2.5" fill="${causticCol}"/>`;
      }
    }

    const polyEls = p.projected
      .map(f => {
        const basePoly = `<polygon points="${f.pts}" fill="${f.fill}" stroke="${f.stroke}" stroke-width="${f.strokeW.toFixed(2)}" stroke-linejoin="round"/>`;
        if (f.isTopTable) {
          return `${basePoly}<polygon points="${f.pts}" fill="url(#softboxSheen)" pointer-events="none"/>`;
        }
        return basePoly;
      })
      .join('');

    let fairySvg = '';
    if (p.finish === 'fairy') {
      const dustOffsets = [
        [-0.22, -0.18, 1.3],
        [0.18, -0.24, 1.0],
        [-0.08, 0.16, 1.2],
        [0.24, 0.12, 1.1],
        [0.04, -0.06, 1.4],
        [-0.26, 0.08, 0.9],
        [0.12, 0.25, 1.1],
        [-0.14, -0.28, 1.0]
      ];
      fairySvg = dustOffsets
        .map(([dx, dy, rScale]) => {
          const px = (cx + dx * scale).toFixed(1);
          const py = (cy + dy * scale).toFixed(1);
          const r = (scale * 0.014 * rScale).toFixed(2);
          return `<circle cx="${px}" cy="${py}" r="${r}" fill="#ffffff" opacity="0.88"/>`;
        })
        .join('');
    }

    const glintX = p.bestGlint.x.toFixed(1);
    const glintY = p.bestGlint.y.toFixed(1);
    const sRadius = (scale * (0.068 + 0.042 * p.glintPower)).toFixed(1);
    const sInner = (scale * (0.012 + 0.008 * p.glintPower)).toFixed(2);
    const starOpacity = (0.78 + 0.22 * p.glintPower).toFixed(2);
    const prismRadius = (scale * (0.055 + 0.035 * p.glintPower)).toFixed(1);

    const subX = p.secondGlint.x.toFixed(1);
    const subY = p.secondGlint.y.toFixed(1);
    const subR = (scale * (0.038 + 0.026 * p.subPower)).toFixed(1);
    const subIn = (scale * (0.007 + 0.005 * p.subPower)).toFixed(2);
    const subOpacity = (0.58 + 0.28 * p.subPower).toFixed(2);

    const starSvg =
      `<circle cx="${glintX}" cy="${glintY}" r="${prismRadius}" fill="url(#prismFire)"/>` +
      `<g transform="translate(${glintX},${glintY})" opacity="${starOpacity}"><path d="M0,-${sRadius} L${sInner},-${sInner} L${sRadius},0 L${sInner},${sInner} L0,${sRadius} L-${sInner},${sInner} L-${sRadius},0 L-${sInner},-${sInner} Z" fill="#ffffff"/></g>` +
      `<g transform="translate(${subX},${subY})" opacity="${subOpacity}"><path d="M0,-${subR} L${subIn},-${subIn} L${subR},0 L${subIn},${subIn} L0,${subR} L-${subIn},${subIn} L-${subR},0 L-${subIn},-${subIn} Z" fill="#ffffff"/></g>`;

    return `${shadowSvg}${polyEls}${fairySvg}${starSvg}`;
  }

  let svgDefUid = 0;

  function buildSvgOpticalDefs(suffix) {
    const s = suffix || '';
    return (
      '<defs>' +
      `<radialGradient id="aoShadow${s}" cx="50%" cy="50%" r="50%">` +
      '<stop offset="0%" stop-color="rgba(6,10,18,0.52)"/>' +
      '<stop offset="68%" stop-color="rgba(8,12,22,0.28)"/>' +
      '<stop offset="100%" stop-color="rgba(8,12,22,0.0)"/>' +
      '</radialGradient>' +
      `<radialGradient id="prismFire${s}" cx="50%" cy="50%" r="50%">` +
      '<stop offset="0%" stop-color="rgba(255,255,255,0.65)"/>' +
      '<stop offset="45%" stop-color="rgba(255,232,168,0.34)"/>' +
      '<stop offset="78%" stop-color="rgba(125,218,255,0.24)"/>' +
      '<stop offset="100%" stop-color="rgba(192,132,252,0.0)"/>' +
      '</radialGradient>' +
      `<linearGradient id="softboxSheen${s}" x1="0%" y1="0%" x2="100%" y2="100%">` +
      '<stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>' +
      '<stop offset="48%" stop-color="rgba(255,255,255,0.04)"/>' +
      '<stop offset="100%" stop-color="rgba(0,0,0,0.12)"/>' +
      '</linearGradient>' +
      '</defs>'
    );
  }

  const SVG_OPTICAL_DEFS = buildSvgOpticalDefs('');

  function renderDrillSvg(options) {
    const opts = options || {};
    const inner = renderSingleDrillInnerSvg(opts, 50, 50, 82);
    if (opts.omitDefs) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
    }
    const suffix = `_u${++svgDefUid}`;
    const scopedInner = inner
      .replace(/url\(#aoShadow\)/g, `url(#aoShadow${suffix})`)
      .replace(/url\(#prismFire\)/g, `url(#prismFire${suffix})`)
      .replace(/url\(#softboxSheen\)/g, `url(#softboxSheen${suffix})`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${buildSvgOpticalDefs(suffix)}${scopedInner}</svg>`;
  }

  function renderDrillSvgDataUri(options) {
    const svg = renderDrillSvg({ ...(options || {}), omitDefs: false });
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const CANVAS_SYMBOLS = ['A', 'C', 'H', 'K', 'M', 'N', 'S', 'T', 'V', 'X', '+', '=', '#'];

  function pickCanvasSymbol(codeStr, idx) {
    const str = String(codeStr || idx || '310');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return CANVAS_SYMBOLS[(hash + (idx % 3 === 0 ? 0 : idx % 3)) % CANVAS_SYMBOLS.length];
  }

  // Render a 5x5 Diamond3D_Pro Matrix Board (with canvas grid, GEOM_PAD, printed symbol guide & sub-mm jitter)
  function renderMatrixSvg(options) {
    const opts = options || {};
    const hexList = Array.isArray(opts.hexList) && opts.hexList.length > 0 ? opts.hexList : [opts.hex || '#1d4ed8'];
    const shape = opts.shape === 'square' ? 'square' : 'round';
    const finish = opts.finish || 'resin';
    const rotX = typeof opts.rotX === 'number' ? opts.rotX : 6;
    const rotY = typeof opts.rotY === 'number' ? opts.rotY : -8;
    const boardBg = opts.boardBg || '#181b26';
    const symbolMode = Boolean(opts.symbolMode);
    const symbolCode = opts.symbolCode || '';
    const hasSweep = typeof opts.sweepPos === 'number' && Number.isFinite(opts.sweepPos);
    const globalSweepPos = hasSweep ? opts.sweepPos : null;

    const cellsSvg = [];
    const cellSize = 36;
    const start = 10;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const cellHex = hexList[idx % hexList.length];
        const rgb = hexToRgb(cellHex);
        const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
        // Authentic Diamond3D_Pro color-matched backing pad (GEOM_PAD)
        const padR = Math.round(Math.min(228, rgb[0]) * 0.68 + 42);
        const padG = Math.round(Math.min(226, rgb[1]) * 0.68 + 42);
        const padB = Math.round(Math.min(222, rgb[2]) * 0.68 + 42);
        const padFill = symbolMode || shape === 'round' ? `rgb(${padR},${padG},${padB})` : boardBg;

        const x0 = start + c * cellSize;
        const y0 = start + r * cellSize;
        const tileCx = x0 + cellSize * 0.5;
        const tileCy = y0 + cellSize * 0.5;
        // Sub-millimeter organic placement jitter (Diamond3D_Pro jitterAmount = 0.018)
        const jx = Math.sin(idx * 17.3 + 1.1) * 0.55;
        const jy = Math.cos(idx * 23.7 + 0.7) * 0.55;
        const cx = tileCx + jx;
        const cy = tileCy + jy;
        const inkColor = lum > 155 ? '#171717' : '#f6f5f2';

        cellsSvg.push(
          `<rect x="${x0}" y="${y0}" width="${cellSize}" height="${cellSize}" fill="${padFill}" stroke="rgba(23,23,23,0.2)" stroke-width="0.6"/>`
        );

        // Printed canvas symbol cell (exposed empty canvas guides on outer/diagonal canvas tiles when symbolMode is active)
        const isEmptyCanvasCell = symbolMode && ((r + c) % 3 === 0 || (r === 0 && c === 4) || (r === 4 && c === 0));
        if (symbolMode) {
          const glyph = pickCanvasSymbol(symbolCode, idx === 12 ? 0 : 0);
          if (shape === 'round') {
            cellsSvg.push(
              `<circle cx="${tileCx}" cy="${tileCy}" r="${(cellSize * 0.37).toFixed(1)}" fill="none" stroke="${inkColor}" stroke-opacity="0.45" stroke-width="0.8" stroke-dasharray="2.2 1.6"/>`
            );
          } else {
            cellsSvg.push(
              `<rect x="${x0 + 3}" y="${y0 + 3}" width="${cellSize - 6}" height="${cellSize - 6}" rx="1.5" fill="none" stroke="${inkColor}" stroke-opacity="0.45" stroke-width="0.8" stroke-dasharray="2.2 1.6"/>`
            );
          }
          if (isEmptyCanvasCell) {
            cellsSvg.push(
              `<text x="${tileCx}" y="${tileCy + 4.5}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="600" fill="${inkColor}" fill-opacity="0.82">${glyph}</text>`
            );
            continue;
          }
        }

        cellsSvg.push(
          renderSingleDrillInnerSvg(
            {
              rgb,
              shape,
              finish,
              phase: (r * 7 + c * 13) * 0.68,
              rotX: rotX + (r - 2) * 1.4 + Math.sin(idx * 11.7) * 0.9,
              rotY: rotY + (c - 2) * 1.4 + Math.cos(idx * 19.3) * 0.9,
              sweepPos: hasSweep ? (globalSweepPos - (c - 2) * 0.36) / 0.24 : null,
              showShadow: true
            },
            cx,
            cy,
            cellSize * (shape === 'square' ? 0.96 : 0.94)
          )
        );
      }
    }
    const suffix = `_m${++svgDefUid}`;
    const scopedCells = cellsSvg
      .join('')
      .replace(/url\(#aoShadow\)/g, `url(#aoShadow${suffix})`)
      .replace(/url\(#prismFire\)/g, `url(#prismFire${suffix})`)
      .replace(/url\(#softboxSheen\)/g, `url(#softboxSheen${suffix})`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${buildSvgOpticalDefs(suffix)}<rect x="6" y="6" width="188" height="188" rx="8" fill="${boardBg}"/>${scopedCells}</svg>`;
  }

  function renderMatrixSvgDataUri(options) {
    const svg = renderMatrixSvg(options);
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ==========================================================================
  // 5. V4 60fps Canvas 2D Optical PBR Renderer & Inertia Controller
  // ==========================================================================
  function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r || 0, Math.min(w, h) * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function drawStarGlintCanvas(ctx, x, y, rOuter, rInner, opacity) {
    if (!ctx || rOuter <= 0 || opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp01(opacity);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - rOuter);
    ctx.lineTo(x + rInner, y - rInner);
    ctx.lineTo(x + rOuter, y);
    ctx.lineTo(x + rInner, y + rInner);
    ctx.lineTo(x, y + rOuter);
    ctx.lineTo(x - rInner, y + rInner);
    ctx.lineTo(x - rOuter, y);
    ctx.lineTo(x - rInner, y - rInner);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDrillOnCanvas(ctx, options, cx, cy, scale) {
    if (!ctx) return null;
    const p = projectDrill(options, cx, cy, scale);

    if (p.showShadow) {
      const sx = cx - p.rotYDeg * 0.16;
      const sy = cy + scale * 0.032 + p.rotXDeg * 0.15;
      const rHalf = scale * 0.54;
      const aoGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rHalf);
      aoGrad.addColorStop(0, 'rgba(6,10,18,0.52)');
      aoGrad.addColorStop(0.68, 'rgba(8,12,22,0.26)');
      aoGrad.addColorStop(1, 'rgba(8,12,22,0)');
      const causticCol =
        p.lum > 210
          ? 'rgba(23,23,23,0.14)'
          : p.lum < 30
          ? 'rgba(23,23,23,0.36)'
          : `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},0.24)`;

      if (p.isRound) {
        ctx.fillStyle = aoGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, rHalf, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = causticCol;
        ctx.beginPath();
        ctx.arc(sx, sy, scale * 0.38, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = aoGrad;
        roundRectPath(ctx, sx - rHalf, sy - rHalf, rHalf * 2, rHalf * 2, scale * 0.045);
        ctx.fill();
        ctx.fillStyle = causticCol;
        roundRectPath(ctx, sx - rHalf + 3, sy - rHalf + 3, rHalf * 2 - 6, rHalf * 2 - 6, scale * 0.028);
        ctx.fill();
      }

      if (p.finish === 'glow') {
        const glowGrad = ctx.createRadialGradient(cx, cy, scale * 0.12, cx, cy, scale * 0.62);
        glowGrad.addColorStop(0, 'rgba(16,185,129,0.22)');
        glowGrad.addColorStop(1, 'rgba(16,185,129,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < p.projected.length; i++) {
      const f = p.projected[i];
      const coords = f.coords;
      if (!coords || coords.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(coords[0][0], coords[0][1]);
      for (let k = 1; k < coords.length; k++) {
        ctx.lineTo(coords[k][0], coords[k][1]);
      }
      ctx.closePath();

      // Continuous per-facet clearcoat lighting gradient (smooth jewel sheen rather than flat polygon fill)
      let minX = coords[0][0];
      let maxX = coords[0][0];
      let minY = coords[0][1];
      let maxY = coords[0][1];
      for (let k = 1; k < coords.length; k++) {
        if (coords[k][0] < minX) minX = coords[k][0];
        if (coords[k][0] > maxX) maxX = coords[k][0];
        if (coords[k][1] < minY) minY = coords[k][1];
        if (coords[k][1] > maxY) maxY = coords[k][1];
      }
      const [fr, fg, fb] = f.rgbTuple;
      const hiShift = f.isTopTable ? 28 : 16;
      const loShift = f.isTopTable ? 12 : 18;
      const fGrad = ctx.createLinearGradient(minX, minY, maxX, maxY);
      fGrad.addColorStop(
        0,
        `rgb(${Math.min(255, fr + hiShift)},${Math.min(255, fg + hiShift)},${Math.min(255, fb + hiShift + 2)})`
      );
      fGrad.addColorStop(0.55, `rgb(${fr},${fg},${fb})`);
      fGrad.addColorStop(
        1,
        `rgb(${Math.max(0, fr - loShift)},${Math.max(0, fg - loShift)},${Math.max(0, fb - loShift + 2)})`
      );
      ctx.fillStyle = fGrad;
      ctx.fill();

      if (f.isTopTable) {
        const sGrad = ctx.createLinearGradient(minX, minY, maxX, maxY);
        sGrad.addColorStop(0, 'rgba(255,255,255,0.34)');
        sGrad.addColorStop(0.48, 'rgba(255,255,255,0.03)');
        sGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = sGrad;
        ctx.fill();
      }

      if (f.strokeW > 0) {
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = Math.max(0.4, f.strokeW);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (p.finish === 'fairy') {
      const fxTime = options && typeof options.lightFxTime === 'number' ? options.lightFxTime : 0.0;
      const dustOffsets = [
        [-0.22, -0.18, 1.3],
        [0.18, -0.24, 1.0],
        [-0.08, 0.16, 1.2],
        [0.24, 0.12, 1.1],
        [0.04, -0.06, 1.4],
        [-0.26, 0.08, 0.9],
        [0.12, 0.25, 1.1],
        [-0.14, -0.28, 1.0],
        [-0.18, 0.22, 0.85],
        [0.22, -0.10, 0.95]
      ];
      ctx.save();
      for (let i = 0; i < dustOffsets.length; i++) {
        const [dx, dy, rScale] = dustOffsets[i];
        const px = cx + dx * scale;
        const py = cy + dy * scale;
        const twinkle = 0.55 + 0.45 * Math.sin(fxTime * 4.5 + p.rotYDeg * 0.09 + i * 1.9);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = i % 3 === 0 ? '#bae6fd' : i % 3 === 1 ? '#fef08a' : '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, scale * 0.014 * rScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Prism dispersion halo + crisp 4-point star sparkles
    const prismRadius = scale * (0.062 + 0.042 * p.glintPower);
    const pGrad = ctx.createRadialGradient(p.bestGlint.x, p.bestGlint.y, 0, p.bestGlint.x, p.bestGlint.y, prismRadius);
    pGrad.addColorStop(0, 'rgba(255,255,255,0.72)');
    pGrad.addColorStop(0.42, 'rgba(255,232,168,0.36)');
    pGrad.addColorStop(0.75, 'rgba(125,218,255,0.24)');
    pGrad.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(p.bestGlint.x, p.bestGlint.y, prismRadius, 0, Math.PI * 2);
    ctx.fill();

    drawStarGlintCanvas(
      ctx,
      p.bestGlint.x,
      p.bestGlint.y,
      scale * (0.068 + 0.044 * p.glintPower),
      scale * (0.012 + 0.008 * p.glintPower),
      0.8 + 0.2 * p.glintPower
    );
    drawStarGlintCanvas(
      ctx,
      p.secondGlint.x,
      p.secondGlint.y,
      scale * (0.038 + 0.026 * p.subPower),
      scale * (0.007 + 0.005 * p.subPower),
      0.58 + 0.28 * p.subPower
    );
    return p;
  }

  function renderDrillToCanvas(ctx, width, height, options) {
    if (!ctx || !width || !height) return;
    const opts = options || {};
    ctx.clearRect(0, 0, width, height);

    if (opts.boardBg) {
      ctx.save();
      ctx.fillStyle = opts.boardBg;
      if (opts.boardRadius) {
        roundRectPath(ctx, 0, 0, width, height, opts.boardRadius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    }

    const zoom = Math.max(0.75, Math.min(1.85, typeof opts.zoom === 'number' ? opts.zoom : 1.0));
    if (opts.compareHex) {
      const colScale = Math.min(width * 0.36, height * 0.54) * zoom;
      drawDrillOnCanvas(ctx, { ...opts, hex: opts.hex }, width * 0.28, height * 0.46, colScale);
      drawDrillOnCanvas(ctx, { ...opts, hex: opts.compareHex }, width * 0.72, height * 0.46, colScale);
      if (opts.leftLabel || opts.rightLabel) {
        ctx.save();
        ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = opts.labelColor || '#a1a9b8';
        if (opts.leftLabel) ctx.fillText(opts.leftLabel, width * 0.28, height * 0.90);
        if (opts.rightLabel) ctx.fillText(opts.rightLabel, width * 0.72, height * 0.90);
        ctx.restore();
      }
      return;
    }
    if (opts.dualMode) {
      const colScale = Math.min(width * 0.36, height * 0.56) * zoom;
      drawDrillOnCanvas(ctx, { ...opts, shape: 'round' }, width * 0.28, height * 0.5, colScale);
      drawDrillOnCanvas(ctx, { ...opts, shape: 'square' }, width * 0.72, height * 0.5, colScale);
      return;
    }

    const drillScale = Math.min(width, height) * 0.78 * zoom;
    drawDrillOnCanvas(ctx, opts, width * 0.5, height * 0.5, drillScale);
  }

  function renderMatrixToCanvas(ctx, width, height, options) {
    if (!ctx || !width || !height) return;
    const opts = options || {};
    const hexList = Array.isArray(opts.hexList) && opts.hexList.length > 0 ? opts.hexList : [opts.hex || '#1d4ed8'];
    const shape = opts.shape === 'square' ? 'square' : 'round';
    const finish = opts.finish || 'resin';
    const rotX = typeof opts.rotX === 'number' ? opts.rotX : 6;
    const rotY = typeof opts.rotY === 'number' ? opts.rotY : -8;
    const boardBg = opts.boardBg || '#181b26';
    const symbolMode = Boolean(opts.symbolMode);
    const symbolCode = opts.symbolCode || '';
    const hasSweep = typeof opts.sweepPos === 'number' && Number.isFinite(opts.sweepPos);
    const globalSweepPos = hasSweep ? opts.sweepPos : null;
    const lightFxMode = opts.lightFxMode || 'none';
    const lightFxTime = typeof opts.lightFxTime === 'number' ? opts.lightFxTime : 0.0;
    const zoom = Math.max(0.75, Math.min(1.65, typeof opts.zoom === 'number' ? opts.zoom : 1.0));

    ctx.clearRect(0, 0, width, height);
    const boardDim = Math.min(width, height) * 0.92 * zoom;
    const boardX = (width - boardDim) * 0.5;
    const boardY = (height - boardDim) * 0.5;
    const padOuter = boardDim * 0.025;
    const cellSize = (boardDim - padOuter * 2) / 5;

    ctx.save();
    ctx.fillStyle = boardBg;
    roundRectPath(ctx, boardX, boardY, boardDim, boardDim, boardDim * 0.045);
    ctx.fill();
    ctx.restore();

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const cellHex = hexList[idx % hexList.length];
        const rgb = hexToRgb(cellHex);
        const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
        const padR = Math.round(Math.min(228, rgb[0]) * 0.68 + 42);
        const padG = Math.round(Math.min(226, rgb[1]) * 0.68 + 42);
        const padB = Math.round(Math.min(222, rgb[2]) * 0.68 + 42);
        const padFill = symbolMode || shape === 'round' ? `rgb(${padR},${padG},${padB})` : boardBg;

        const x0 = boardX + padOuter + c * cellSize;
        const y0 = boardY + padOuter + r * cellSize;
        const tileCx = x0 + cellSize * 0.5;
        const tileCy = y0 + cellSize * 0.5;
        const jx = Math.sin(idx * 17.3 + 1.1) * cellSize * 0.015;
        const jy = Math.cos(idx * 23.7 + 0.7) * cellSize * 0.015;
        const inkColor = lum > 155 ? '#171717' : '#f6f5f2';

        ctx.fillStyle = padFill;
        ctx.fillRect(x0, y0, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(23,23,23,0.22)';
        ctx.lineWidth = Math.max(0.5, cellSize * 0.016);
        ctx.strokeRect(x0, y0, cellSize, cellSize);

        const isEmptyCanvasCell = symbolMode && ((r + c) % 3 === 0 || (r === 0 && c === 4) || (r === 4 && c === 0));
        if (symbolMode) {
          const glyph = pickCanvasSymbol(symbolCode, idx === 12 ? 0 : 0);
          ctx.save();
          ctx.strokeStyle = inkColor;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = Math.max(0.7, cellSize * 0.022);
          if (typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([cellSize * 0.06, cellSize * 0.045]);
          }
          if (shape === 'round') {
            ctx.beginPath();
            ctx.arc(tileCx, tileCy, cellSize * 0.37, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            const m = cellSize * 0.085;
            roundRectPath(ctx, x0 + m, y0 + m, cellSize - m * 2, cellSize - m * 2, 2);
            ctx.stroke();
          }
          if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
          ctx.restore();

          if (isEmptyCanvasCell) {
            ctx.save();
            ctx.fillStyle = inkColor;
            ctx.globalAlpha = 0.84;
            ctx.font = `600 ${Math.round(cellSize * 0.36)}px "JetBrains Mono", Menlo, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyph, tileCx, tileCy + 1);
            ctx.restore();
            continue;
          }
        }

        drawDrillOnCanvas(
          ctx,
          {
            rgb,
            shape,
            finish,
            phase: (r * 7 + c * 13) * 0.68,
            rotX: rotX + (r - 2) * 1.4 + Math.sin(idx * 11.7) * 0.9,
            rotY: rotY + (c - 2) * 1.4 + Math.cos(idx * 19.3) * 0.9,
            sweepPos: hasSweep ? (globalSweepPos - (c - 2) * 0.36) / 0.24 : null,
            lightFxMode,
            lightFxTime,
            normUV: [(c - 2) * 0.38, (2 - r) * 0.38],
            showShadow: true
          },
          tileCx + jx,
          tileCy + jy,
          cellSize * (shape === 'square' ? 0.96 : 0.94)
        );
      }
    }
  }

  function createInertiaController(options) {
    const opts = options || {};
    const onFrame = typeof opts.onFrame === 'function' ? opts.onFrame : function () {};
    const scheduleFn =
      typeof opts.requestFrame === 'function'
        ? opts.requestFrame
        : typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : function (cb) {
            return setTimeout(cb, 16);
          };

    const reducedMotionMql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const state = {
      rotX: typeof opts.rotX === 'number' ? opts.rotX : 8,
      rotY: typeof opts.rotY === 'number' ? opts.rotY : -10,
      vx: 0,
      vy: 0,
      zoom: 1.0,
      autoSpin: Boolean(opts.autoSpin),
      lightFxMode: opts.lightFxMode || 'none',
      lightFxTime: 0,
      sweepPos: null,
      dragging: false,
      paused: false,
      lastX: 0,
      lastY: 0,
      lastTickMs: 0,
      rafId: null,
      destroyed: false
    };

    function isReducedMotion() {
      return Boolean(reducedMotionMql && reducedMotionMql.matches);
    }

    function needsTick() {
      if (state.paused) return false;
      if (isReducedMotion()) return false;
      if (state.autoSpin || state.lightFxMode !== 'none' || state.sweepPos !== null) {
        return true;
      }
      if (state.dragging) return false;
      return Math.abs(state.vx) > 0.04 || Math.abs(state.vy) > 0.04;
    }

    function ensureRunning() {
      if (state.destroyed || state.paused || state.rafId !== null) return;
      if (isReducedMotion()) {
        onFrame({
          rotX: state.rotX,
          rotY: state.rotY,
          zoom: state.zoom,
          lightFxMode: state.lightFxMode,
          lightFxTime: state.lightFxTime,
          sweepPos: state.sweepPos
        });
        return;
      }
      state.lastTickMs = Date.now();
      const tick = () => {
        if (state.destroyed || state.paused) {
          state.rafId = null;
          return;
        }
        const now = Date.now();
        const dt = Math.min(0.05, Math.max(0.008, (now - state.lastTickMs) / 1000));
        state.lastTickMs = now;

        if (!state.dragging) {
          const decay = Math.pow(0.89, dt * 60);
          state.rotY = Math.max(-68, Math.min(68, state.rotY + state.vx * (dt * 60)));
          state.rotX = Math.max(-48, Math.min(48, state.rotX + state.vy * (dt * 60)));
          state.vx *= decay;
          state.vy *= decay;
          if (Math.abs(state.vx) < 0.03) state.vx = 0;
          if (Math.abs(state.vy) < 0.03) state.vy = 0;

          if (state.autoSpin) {
            state.rotY += 38 * dt;
            if (state.rotY > 65) state.rotY = -65;
            state.rotX = 14 + 9 * Math.sin((state.rotY * Math.PI) / 65);
          }
        }

        if (state.lightFxMode !== 'none') {
          state.lightFxTime += dt;
        }

        if (state.sweepPos !== null) {
          state.sweepPos += dt * 3.8;
          if (state.sweepPos > 1.25) {
            state.sweepPos = null;
            if (typeof opts.onSweepEnd === 'function') opts.onSweepEnd();
          }
        }

        onFrame({
          rotX: state.rotX,
          rotY: state.rotY,
          zoom: state.zoom,
          lightFxMode: state.lightFxMode,
          lightFxTime: state.lightFxTime,
          sweepPos: state.sweepPos
        });

        if (needsTick()) {
          state.rafId = scheduleFn(tick);
        } else {
          state.rafId = null;
        }
      };
      state.rafId = scheduleFn(tick);
    }

    return {
      getState() {
        return {
          rotX: state.rotX,
          rotY: state.rotY,
          zoom: state.zoom,
          autoSpin: state.autoSpin,
          lightFxMode: state.lightFxMode,
          lightFxTime: state.lightFxTime,
          sweepPos: state.sweepPos
        };
      },
      pointerDown(x, y) {
        state.dragging = true;
        state.lastX = x;
        state.lastY = y;
        state.vx = 0;
        state.vy = 0;
      },
      pointerMove(x, y) {
        if (!state.dragging) return;
        const dx = x - state.lastX;
        const dy = y - state.lastY;
        state.lastX = x;
        state.lastY = y;
        const dRy = dx * 0.55;
        const dRx = -dy * 0.55;
        state.rotY = Math.max(-68, Math.min(68, state.rotY + dRy));
        state.rotX = Math.max(-48, Math.min(48, state.rotX + dRx));
        state.vx = dRy * 0.72;
        state.vy = dRx * 0.72;
        onFrame({
          rotX: state.rotX,
          rotY: state.rotY,
          zoom: state.zoom,
          lightFxMode: state.lightFxMode,
          lightFxTime: state.lightFxTime,
          sweepPos: state.sweepPos
        });
      },
      pointerUp() {
        state.dragging = false;
        if (isReducedMotion()) {
          state.vx = 0;
          state.vy = 0;
          return;
        }
        ensureRunning();
      },
      wheel(deltaY) {
        state.zoom = Math.max(0.75, Math.min(1.85, state.zoom - deltaY * 0.0012));
        ensureRunning();
      },
      nudge(dRotX, dRotY) {
        state.rotX = Math.max(-48, Math.min(48, state.rotX + dRotX));
        state.rotY = Math.max(-68, Math.min(68, state.rotY + dRotY));
        ensureRunning();
      },
      reset() {
        state.rotX = 8;
        state.rotY = -10;
        state.zoom = 1.0;
        state.vx = 0;
        state.vy = 0;
        ensureRunning();
      },
      setAutoSpin(enabled) {
        state.autoSpin = Boolean(enabled);
        ensureRunning();
      },
      setLightFx(mode) {
        state.lightFxMode = mode || 'none';
        ensureRunning();
      },
      triggerSweep() {
        if (isReducedMotion()) {
          state.sweepPos = null;
          if (typeof opts.onSweepEnd === 'function') opts.onSweepEnd();
          return;
        }
        state.sweepPos = -1.2;
        ensureRunning();
      },
      cancelSweep() {
        state.sweepPos = null;
      },
      repaint() {
        onFrame({
          rotX: state.rotX,
          rotY: state.rotY,
          zoom: state.zoom,
          lightFxMode: state.lightFxMode,
          lightFxTime: state.lightFxTime,
          sweepPos: state.sweepPos
        });
      },
      setPaused(paused) {
        state.paused = Boolean(paused);
        if (!state.paused && needsTick()) {
          ensureRunning();
        }
      },
      destroy() {
        state.destroyed = true;
        state.rafId = null;
      }
    };
  }

  return {
    SQUARE_FACETS,
    ROUND_FACETS,
    SPECIAL_ROUND_FACETS,
    hexToRgb,
    shadeFacet,
    renderDrillSvg,
    renderDrillSvgDataUri,
    renderMatrixSvg,
    renderMatrixSvgDataUri,
    renderDrillToCanvas,
    renderMatrixToCanvas,
    roundRectPath,
    createInertiaController
  };
});
