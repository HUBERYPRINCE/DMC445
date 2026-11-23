(function () {
  const catalog = window.DMC_CATALOG || window.DMC_445_CATALOG || { colors: [], meta: { groups: [], shapes: {} } };
  const D3D = window.Diamond3DPro;
  const Icons = window.Icons;
  const MIN_WEIGHT = 100;
  const MAX_WEIGHT = 100000;
  const STEP_WEIGHT = 100;
  const MAX_SVG_CACHE = 1600;
  const svgCache = new Map();
  const reducedMotionMql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function isReducedMotion() {
    return Boolean(reducedMotionMql && reducedMotionMql.matches);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function copyTextReliable(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        /* fall through to legacy textarea copy */
      }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return Boolean(ok);
    } catch (err) {
      return false;
    }
  }

  function iconHtml(name, size) {
    return Icons ? Icons.svg(name, 'currentColor', size || 14) : '';
  }

  function hydrateIcons() {
    if (!Icons) return;
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      const size = Number(el.dataset.size) || 14;
      el.innerHTML = Icons.svg(name, 'currentColor', size);
    });
  }

  function getDrillSvgCached(opts) {
    if (!D3D) return '';
    const rotX = typeof opts.rotX === 'number' ? opts.rotX : 5;
    const rotY = typeof opts.rotY === 'number' ? opts.rotY : -6;
    const sweepKey = opts.sweepPos === null || opts.sweepPos === undefined ? '' : Number(opts.sweepPos).toFixed(2);
    const key = `${opts.hex}|${opts.shape || 'round'}|${opts.finish || 'resin'}|${rotX}|${rotY}|${sweepKey}`;
    if (svgCache.has(key)) {
      const hit = svgCache.get(key);
      svgCache.delete(key);
      svgCache.set(key, hit);
      return hit;
    }
    const svg = D3D.renderDrillSvg({ ...opts, omitDefs: true });
    if (svgCache.size >= MAX_SVG_CACHE) {
      svgCache.delete(svgCache.keys().next().value);
    }
    svgCache.set(key, svg);
    return svg;
  }

  const STORAGE_KEY = 'dmc445_atelier_v4_state';
  const SCHEMES_KEY = 'dmc445_atelier_v4_schemes';
  const FINISH_KEYS = ['resin', 'ab', 'fairy', 'crystal', 'chameleon', 'glow'];
  const FINISH_LABELS = {
    resin: '普通高透树脂',
    ab: 'AB 极光镀膜',
    fairy: '仙尘细闪',
    crystal: '水晶透明',
    chameleon: '炫彩电镀',
    glow: '夜光蓄能'
  };

  const state = {
    allColors: catalog.colors || [],
    filteredColors: [],
    matchedTokens: [],
    activeGroup: 'ALL',
    activeRange: 'all',
    searchQuery: '',
    sortBy: 'seq',
    catalogSort: 'seq',
    gridDensity: 'comfort',
    colorMatchHex: null,
    matchDeltaMap: {},
    swatchCardDataUrl: null,
    swatchCardFilename: '',
    currentShape: 'round',
    studioFinish: 'resin',
    quickWeight: 100,
    loupeWeight: 100,
    loupeViewMode: 'single',
    matrixPattern: 'solid',
    loupeSymbolMode: false,
    loupeAutoSpin: false,
    loupeLightFx: 'none',
    loupeCollapsedMobile: false,
    featuredColor: null,
    compareColor: null,
    pickCompareMode: false,
    recentCodes: [],
    bomParsed: [],
    photoPalette: [],
    photoLabel: '',
    schemes: [],
    receiptSort: 'cart',
    receiptChecked: {},
    calcWidth: 40,
    calcHeight: 50,
    calcCoverage: 100,
    calcMargin: 15,
    calcRecommendedGrams: 200,
    studioOpen: false,
    studioColor: null,
    studioShape: 'round',
    studioWeight: 100,
    studioAutoSpin: false,
    studioSweeping: false,
    studioLightFx: 'none',
    studioViewMode: 'single',
    studioSymbolMode: false,
    studioBoardBg: '#181b26',
    cmdkOpen: false,
    cmdkIndex: 0,
    cmdkItems: [],
    favMap: { '310': true, '5200': true, '666': true, '798': true },
    cart: [],
    cartMap: {}
  };

  function persistSchemes() {
    try {
      localStorage.setItem(SCHEMES_KEY, JSON.stringify(state.schemes.slice(0, 8)));
    } catch (err) {
      /* ignore */
    }
  }

  function loadSavedSchemes() {
    try {
      const raw = localStorage.getItem(SCHEMES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const validCodes = new Set(state.allColors.map((c) => c.code));
      return parsed
        .slice(0, 8)
        .filter((sc) => sc && typeof sc === 'object' && typeof sc.id === 'string' && typeof sc.name === 'string' && Array.isArray(sc.items))
        .map((sc) => ({
          id: sc.id.slice(0, 48),
          name: sc.name.slice(0, 64),
          items: sc.items
            .filter((it) => it && typeof it === 'object' && typeof it.code === 'string' && validCodes.has(it.code))
            .map((it) => ({
              code: it.code,
              shape: it.shape === 'square' ? 'square' : 'round',
              weightGrams: clampWeight(it.weightGrams)
            }))
        }))
        .filter((sc) => sc.items.length > 0);
    } catch (err) {
      return [];
    }
  }

  function persistState() {
    try {
      const payload = {
        shape: state.currentShape,
        finish: state.studioFinish,
        gridDensity: state.gridDensity,
        favMap: state.favMap,
        recentCodes: state.recentCodes.slice(0, 6),
        cart: state.cart.map((i) => ({ code: i.code, shape: i.shape, weightGrams: i.weightGrams }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* ignore storage quota or private mode */
    }
  }

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  // Unified Modal Stack with Per-Layer Inert Isolation, Dynamic Z-Index & Focus Restoration
  const modalStack = [];
  let restoreFocusRaf = null;
  let loupeIntersecting = true;
  let pathMarqueeCtrl = null;
  let marqueeHoveredColor = null;
  let marqueeWindowOffset = 0;

  function setAppInert(locked) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    if (locked) root.setAttribute('inert', '');
    else root.removeAttribute('inert');
  }

  function syncControllerPauseStates() {
    const hiddenDoc = typeof document.hidden === 'boolean' && document.hidden;
    const modalOpen = modalStack.length > 0;
    const topId = modalOpen ? modalStack[modalStack.length - 1].id : null;
    if (loupeCtrl) {
      loupeCtrl.setPaused(hiddenDoc || modalOpen || !loupeIntersecting);
    }
    if (studioCtrl) {
      studioCtrl.setPaused(hiddenDoc || !state.studioOpen || topId !== 'studioModalMask');
    }
    if (pathMarqueeCtrl) {
      pathMarqueeCtrl.setExternalPaused(hiddenDoc || modalOpen);
    }
  }

  function hasOpenModal() {
    return modalStack.length > 0;
  }

  function getTopModalMask() {
    if (!modalStack.length) return null;
    return document.getElementById(modalStack[modalStack.length - 1].id);
  }

  function syncModalStackLayers() {
    setAppInert(modalStack.length > 0);
    modalStack.forEach((entry, idx) => {
      const el = document.getElementById(entry.id);
      if (!el) return;
      const isTop = idx === modalStack.length - 1;
      el.style.zIndex = String(entry.id === 'cmdkModalMask' ? Math.max(92, 80 + idx * 4) : 80 + idx * 4);
      if (isTop) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
    syncControllerPauseStates();
  }

  function pushModalLayer(maskId, focusTargetId) {
    const mask = document.getElementById(maskId);
    if (!mask) return;
    if (restoreFocusRaf !== null) {
      cancelAnimationFrame(restoreFocusRaf);
      restoreFocusRaf = null;
    }
    const existingIdx = modalStack.findIndex((m) => m.id === maskId);
    if (existingIdx >= 0) {
      const [existing] = modalStack.splice(existingIdx, 1);
      modalStack.push(existing);
    } else {
      const ret = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modalStack.push({ id: maskId, returnFocus: ret });
    }
    mask.hidden = false;
    syncModalStackLayers();
    if (focusTargetId) {
      requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus({ preventScroll: true }));
    }
  }

  function popModalLayer(maskId, opts) {
    const mask = document.getElementById(maskId);
    if (mask) {
      mask.hidden = true;
      mask.removeAttribute('inert');
      mask.style.zIndex = '';
    }
    const idx = modalStack.findIndex((m) => m.id === maskId);
    const popped = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    syncModalStackLayers();
    if (opts && opts.skipFocus) return;
    const target = popped && popped.returnFocus;
    if (restoreFocusRaf !== null) cancelAnimationFrame(restoreFocusRaf);
    restoreFocusRaf = requestAnimationFrame(() => {
      restoreFocusRaf = requestAnimationFrame(() => {
        restoreFocusRaf = null;
        if (target && target !== document.body && document.contains(target) && !target.closest('[hidden],[inert]')) {
          target.focus({ preventScroll: true });
        } else {
          const topMask = getTopModalMask();
          if (topMask) {
            const firstFocusable = topMask.querySelector('button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), [tabindex="0"]');
            firstFocusable?.focus({ preventScroll: true });
          }
        }
      });
    });
  }

  function getModalReturnFocusAnchor(maskId) {
    const found = modalStack.find((m) => m.id === maskId);
    return found ? found.returnFocus : null;
  }

  function replaceModalLayer(oldMaskId, newMaskId, focusTargetId) {
    const anchor = getModalReturnFocusAnchor(oldMaskId) || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    popModalLayer(oldMaskId, { skipFocus: true });
    pushModalLayer(newMaskId, focusTargetId);
    const top = modalStack[modalStack.length - 1];
    if (top && top.id === newMaskId && anchor) {
      top.returnFocus = anchor;
    }
  }

  let suppressCmdkTriggerUntil = 0;

  function clampWeight(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < MIN_WEIGHT) return MIN_WEIGHT;
    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(n / 10) * 10));
  }

  function formatBeads(beads) {
    if (beads >= 10000) return (beads / 10000).toFixed(2).replace(/\.00$/, '') + '万';
    return String(Math.round(beads));
  }

  function announce(text) {
    const el = document.getElementById('a11yAnnouncer');
    if (el) el.textContent = text;
  }

  // Optimistic Undo & Status Toast (inert when closed + pause on hover/focus)
  let toastTimer = null;
  let toastUndoCb = null;
  function closeToast() {
    const el = document.getElementById('wxToast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.classList.remove('wx-toast--open');
    el.inert = true;
    toastUndoCb = null;
  }

  function scheduleToastClose(ms) {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(closeToast, ms);
  }

  function showToast(msg, onUndo) {
    const el = document.getElementById('wxToast');
    const msgEl = document.getElementById('wxToastMsg');
    const undoBtn = document.getElementById('btnToastUndo');
    if (!el || !msgEl) return;
    msgEl.textContent = msg;
    announce(msg);
    toastUndoCb = typeof onUndo === 'function' ? onUndo : null;
    if (undoBtn) undoBtn.hidden = !toastUndoCb;
    el.inert = false;
    el.classList.add('wx-toast--open');
    scheduleToastClose(toastUndoCb ? 4800 : 1800);
  }

  function parseSearchTokens(rawQuery) {
    return (rawQuery || '')
      .trim()
      .toLowerCase()
      .split(/[\s,，、/;；|]+/)
      .map((raw) => {
        const clean = raw.replace(/^#|^dmc[_-]?/i, '');
        const m = clean.match(/^([a-z0-9]+?)(?:[:*x×-](\d+)g?)?$/i);
        if (!m) return { code: clean, weight: null };
        return {
          code: m[1].toLowerCase(),
          weight: m[2] ? clampWeight(Number(m[2])) : null
        };
      })
      .filter((t) => t.code);
  }

  function matchNumericRange(codeStr, range) {
    if (!range || range === 'all') return true;
    const n = parseInt(String(codeStr), 10);
    if (!Number.isFinite(n)) return false;
    if (range === '150-399') return n >= 150 && n <= 399;
    if (range === '400-699') return n >= 400 && n <= 699;
    if (range === '700-899') return n >= 700 && n <= 899;
    if (range === '900-999') return n >= 900 && n <= 999;
    if (range === '3000+') return n >= 3000;
    return true;
  }

  // Perceptual Weighted RGB Color Distance (redmean approximation to CIELAB ΔE)
  function hexToRgb255(hex) {
    const h = String(hex || '#888888').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(full, 16);
    if (!Number.isFinite(num)) return [128, 128, 128];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function perceptualDistSq(rgbA, rgbB) {
    const rMean = (rgbA[0] + rgbB[0]) * 0.5;
    const dr = rgbA[0] - rgbB[0];
    const dg = rgbA[1] - rgbB[1];
    const db = rgbA[2] - rgbB[2];
    return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
  }

  function normalizeHexInput(raw) {
    const clean = String(raw || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(clean)) {
      return '#' + clean.split('').map((ch) => ch + ch).join('').toUpperCase();
    }
    if (/^[0-9a-f]{6}$/i.test(clean)) {
      return '#' + clean.toUpperCase();
    }
    return null;
  }

  function rgbToHueSortKey(rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) * 0.5;
    const d = max - min;
    if (d === 0) return 1000 + l;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (s < 0.12) return 1000 + l;
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return h * 360 + (1 - l) * 0.01;
  }

  function syncColorMatchUi() {
    const banner = document.getElementById('colorMatchBanner');
    const trigger = document.getElementById('colorMatchTrigger');
    const dot = document.getElementById('colorMatchDot');
    const bDot = document.getElementById('colorMatchBannerDot');
    const hexInput = document.getElementById('inputColorMatchHex');
    const nativeInput = document.getElementById('inputColorMatch');
    const active = Boolean(state.colorMatchHex);
    if (banner) banner.hidden = !active;
    if (trigger) trigger.classList.toggle('color-match-pill--active', active);
    if (active) {
      if (dot) dot.style.background = state.colorMatchHex;
      if (bDot) bDot.style.background = state.colorMatchHex;
      if (hexInput && document.activeElement !== hexInput) hexInput.value = state.colorMatchHex;
      if (nativeInput && nativeInput.value.toUpperCase() !== state.colorMatchHex) {
        nativeInput.value = state.colorMatchHex.toLowerCase();
      }
    }
  }

  function activateColorMatch(rawHex) {
    const norm = normalizeHexInput(rawHex);
    if (!norm) return;
    state.colorMatchHex = norm;
    state.activeGroup = 'ALL';
    state.activeRange = 'all';
    state.sortBy = 'seq';
    state.searchQuery = '';
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClearSearch');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.hidden = true;
    document.querySelectorAll('#rangeJumpRow .range-chip').forEach((b) => {
      const on = b.dataset.range === 'all';
      b.classList.toggle('range-chip--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    syncColorMatchUi();
    applyFilters();
    if (state.filteredColors[0]) {
      focusColorInLoupe(state.filteredColors[0]);
    }
  }

  function clearColorMatch() {
    if (!state.colorMatchHex) return;
    state.colorMatchHex = null;
    state.matchDeltaMap = {};
    syncColorMatchUi();
    applyFilters();
  }

  function findNearestNeighbors(color, limit) {
    if (!color) return [];
    const baseRgb = hexToRgb255(color.hex);
    const scored = [];
    for (let i = 0; i < state.allColors.length; i++) {
      const candidate = state.allColors[i];
      if (candidate.code === color.code) continue;
      if (!candidate._rgb) candidate._rgb = hexToRgb255(candidate.hex);
      scored.push({ color: candidate, dist: perceptualDistSq(baseRgb, candidate._rgb) });
    }
    scored.sort((a, b) => a.dist - b.dist);
    return scored.slice(0, limit || 3).map((x) => x.color);
  }

  function buildCartItem(color, shape, weightGrams) {
    if (!color) return null;
    const cleanShape = shape === 'square' ? 'square' : 'round';
    const cleanWeight = clampWeight(weightGrams);
    const ratio = cleanWeight / 100;
    const beadsPer100g = cleanShape === 'square' ? 19200 : 16500;
    const beads = Math.round(beadsPer100g * ratio);
    const subtotal = (Number(color.price100g || 11.5) * ratio).toFixed(2);
    return {
      key: `${color.code}_${cleanShape}`,
      code: color.code,
      hex: color.hex,
      light: Number.isFinite(Number(color.light)) ? Number(color.light) : 50,
      shape: cleanShape,
      weightGrams: cleanWeight,
      price100g: color.price100g,
      beads,
      beadsText: formatBeads(beads),
      subtotal
    };
  }

  // Cached logical canvas dimensions (zero per-frame getBoundingClientRect layout thrash)
  const canvasMetricCache = new WeakMap();

  function measureCanvasLogicalSize(canvas) {
    if (!canvas) return null;
    const host = canvas.parentElement || canvas;
    const rect = host.getBoundingClientRect();
    const cssW = Math.max(200, Math.round(rect.width || host.clientWidth || 340));
    const cssH = Math.max(160, Math.round(rect.height || host.clientHeight || 224));
    const metrics = { width: cssW, height: cssH };
    canvasMetricCache.set(canvas, metrics);
    return metrics;
  }

  function invalidateCanvasMetrics() {
    const lc = document.getElementById('loupeCanvas3D');
    const sc = document.getElementById('studioCanvas3D');
    if (lc) canvasMetricCache.delete(lc);
    if (sc) canvasMetricCache.delete(sc);
  }

  function syncCanvasSize(canvas) {
    if (!canvas) return null;
    const cached = canvasMetricCache.get(canvas) || measureCanvasLogicalSize(canvas);
    const cssW = cached.width;
    const cssH = cached.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { ctx, width: cssW, height: cssH };
  }

  // Persistent 60fps Loupe Canvas Controller
  const loupeCtrl =
    D3D && typeof D3D.createInertiaController === 'function'
      ? D3D.createInertiaController({
          rotX: 8,
          rotY: -10,
          onFrame: paintLoupeFrame
        })
      : null;

  // Fullscreen Studio Modal Canvas Controller
  const studioCtrl =
    D3D && typeof D3D.createInertiaController === 'function'
      ? D3D.createInertiaController({
          rotX: 8,
          rotY: -10,
          onSweepEnd: () => {
            state.studioSweeping = false;
            const sweepBtn = document.getElementById('btnStudioSweep');
            sweepBtn?.classList.remove('studio-stage__spin--active');
            sweepBtn?.setAttribute('aria-pressed', 'false');
          },
          onFrame: paintStudioFrame
        })
      : null;

  function buildMatrixHexList(color, pattern) {
    if (!color) return { hexList: ['#1d4ed8'], legendColors: [] };
    if (pattern === 'gradient') {
      const bandColors = [color, ...findNearestNeighbors(color, 4)].sort((a, b) => {
        const la = Number.isFinite(Number(a.light)) ? Number(a.light) : 50;
        const lb = Number.isFinite(Number(b.light)) ? Number(b.light) : 50;
        return lb - la;
      });
      const hexList = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const band = Math.min(bandColors.length - 1, Math.floor(((r + c) * bandColors.length) / 9));
          hexList.push(bandColors[band].hex);
        }
      }
      return { hexList, legendColors: bandColors };
    }
    if (pattern === 'cart') {
      const unique = [];
      const seen = new Set();
      state.cart.forEach((item) => {
        if (!seen.has(item.code)) {
          seen.add(item.code);
          unique.push(item);
        }
      });
      const pool = unique.length >= 2 ? unique.slice(0, 6) : [color, ...findNearestNeighbors(color, 3)];
      const hexList = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const idx = (r + c * 2) % pool.length;
          hexList.push(pool[idx].hex);
        }
      }
      return { hexList, legendColors: pool };
    }
    return { hexList: [color.hex], legendColors: [color] };
  }

  function paintLoupeFrame(frame) {
    const canvas = document.getElementById('loupeCanvas3D');
    const c = state.featuredColor || state.allColors[0];
    if (!canvas || !c || !D3D) return;
    const info = syncCanvasSize(canvas);
    if (!info || !info.ctx) return;
    const f = frame || (loupeCtrl ? loupeCtrl.getState() : { rotX: 8, rotY: -10, zoom: 1.0, lightFxMode: 'none', lightFxTime: 0 });
    const zoomEl = document.getElementById('loupeZoomTag');
    if (zoomEl) zoomEl.textContent = `${Number(f.zoom || 1).toFixed(2)}x`;

    if (state.loupeViewMode === 'matrix') {
      const { hexList } = buildMatrixHexList(c, state.matrixPattern);
      D3D.renderMatrixToCanvas(info.ctx, info.width, info.height, {
        hexList,
        shape: state.currentShape,
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        boardBg: state.studioBoardBg,
        symbolMode: state.loupeSymbolMode,
        symbolCode: c.code,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos
      });
    } else if (state.loupeViewMode === 'compare') {
      const cmp = state.compareColor && state.compareColor.code !== c.code
        ? state.compareColor
        : findNearestNeighbors(c, 1)[0] || c;
      state.compareColor = cmp;
      const isLightBg = state.studioBoardBg === '#f5f2eb' || state.studioBoardBg === '#ffffff';
      D3D.renderDrillToCanvas(info.ctx, info.width, info.height, {
        hex: c.hex,
        compareHex: cmp.hex,
        leftLabel: `#${c.code}`,
        rightLabel: `#${cmp.code}`,
        labelColor: isLightBg ? '#14171c' : '#f3f5f8',
        shape: state.currentShape,
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos,
        showShadow: true
      });
    } else {
      D3D.renderDrillToCanvas(info.ctx, info.width, info.height, {
        hex: c.hex,
        shape: state.currentShape,
        dualMode: state.loupeViewMode === 'dual',
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos,
        showShadow: true
      });
    }
  }

  function paintStudioFrame(frame) {
    if (!state.studioOpen) return;
    const canvas = document.getElementById('studioCanvas3D');
    const c = state.studioColor || state.featuredColor;
    if (!canvas || !c || !D3D) return;
    const info = syncCanvasSize(canvas);
    if (!info || !info.ctx) return;
    const f = frame || (studioCtrl ? studioCtrl.getState() : { rotX: 8, rotY: -10, zoom: 1.0, lightFxMode: 'none', lightFxTime: 0 });

    if (state.studioViewMode === 'matrix') {
      const { hexList } = buildMatrixHexList(c, state.matrixPattern);
      D3D.renderMatrixToCanvas(info.ctx, info.width, info.height, {
        hexList,
        shape: state.studioShape,
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        boardBg: state.studioBoardBg,
        symbolMode: state.studioSymbolMode,
        symbolCode: c.code,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos
      });
    } else if (state.studioViewMode === 'compare') {
      const cmp = state.compareColor && state.compareColor.code !== c.code
        ? state.compareColor
        : findNearestNeighbors(c, 1)[0] || c;
      state.compareColor = cmp;
      const isLightBg = state.studioBoardBg === '#f5f2eb' || state.studioBoardBg === '#ffffff';
      D3D.renderDrillToCanvas(info.ctx, info.width, info.height, {
        hex: c.hex,
        compareHex: cmp.hex,
        leftLabel: `#${c.code}`,
        rightLabel: `#${cmp.code}`,
        labelColor: isLightBg ? '#14171c' : '#f3f5f8',
        shape: state.studioShape,
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos,
        showShadow: true
      });
    } else {
      D3D.renderDrillToCanvas(info.ctx, info.width, info.height, {
        hex: c.hex,
        shape: state.studioShape,
        dualMode: state.studioViewMode === 'dual',
        finish: state.studioFinish,
        rotX: f.rotX,
        rotY: f.rotY,
        zoom: f.zoom,
        lightFxMode: f.lightFxMode,
        lightFxTime: f.lightFxTime,
        sweepPos: f.sweepPos,
        showShadow: true
      });
    }
  }

  // Non-Warping Compositor Clip-Path Shape Switcher
  function syncShapePill(animate) {
    const row = document.getElementById('shapeSwitchRow');
    const overlay = document.getElementById('shapeSwitchOverlay');
    const activeBtn = state.currentShape === 'square'
      ? document.getElementById('btnShapeSquare')
      : document.getElementById('btnShapeRound');
    if (!row || !overlay || !activeBtn) return;
    const w = row.scrollWidth || row.offsetWidth || 1;
    const left = activeBtn.offsetLeft;
    const right = Math.max(0, w - (left + activeBtn.offsetWidth));
    if (!animate) overlay.style.transition = 'none';
    overlay.style.clipPath = `inset(0 ${right}px 0 ${left}px round 999px)`;
    if (!animate) {
      void overlay.offsetWidth;
      overlay.style.transition = '';
    }
  }

  // True Vertical Digit-Rolling Odometer for Cart Dock Price
  function buildOdometer(el, str) {
    el.innerHTML = '';
    [...str].forEach((ch) => {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'odo-col';
        const reel = document.createElement('span');
        reel.className = 'odo-reel';
        for (let d = 0; d <= 9; d++) {
          const s = document.createElement('span');
          s.textContent = String(d);
          reel.appendChild(s);
        }
        reel.style.transform = `translateY(-${Number(ch) * 1.1}em)`;
        col.appendChild(reel);
        el.appendChild(col);
      } else {
        const st = document.createElement('span');
        st.textContent = ch;
        el.appendChild(st);
      }
    });
  }

  function updateCartOdometer(totalPriceStr) {
    const el = document.getElementById('cartDockPrice');
    const srEl = document.getElementById('cartDockPriceSr');
    if (srEl) srEl.textContent = `当前购物车总计 ${totalPriceStr}`;
    if (!el) return;
    const digits = totalPriceStr.replace(/[^0-9]/g, '');
    const reels = Array.from(el.querySelectorAll('.odo-reel'));
    const staticSig = el.dataset.sig || '';
    const nextSig = totalPriceStr.replace(/[0-9]/g, '#');
    if (reels.length !== digits.length || staticSig !== nextSig) {
      el.dataset.sig = nextSig;
      buildOdometer(el, totalPriceStr);
      return;
    }
    const reduced = isReducedMotion();
    reels.forEach((reel, i) => {
      reel.style.transitionDelay = reduced ? '0ms' : `${(reels.length - 1 - i) * 25}ms`;
      reel.style.transform = `translateY(-${Number(digits[i]) * 1.1}em)`;
    });
  }

  function renderGroupsBar() {
    const bar = document.getElementById('groupsBar');
    if (!bar) return;
    const groups = (catalog.meta && catalog.meta.groups) || [];
    const favCount = Object.keys(state.favMap).filter((k) => state.favMap[k]).length;
    const cartColors = new Set(state.cart.map((i) => i.code)).size;

    let html = `
      <button class="group-dot-pill ${state.activeGroup === 'ALL' && state.sortBy === 'seq' ? 'group-dot-pill--active' : ''}" data-group="ALL" aria-pressed="${state.activeGroup === 'ALL' && state.sortBy === 'seq'}" type="button">
        <span>445</span>
      </button>
    `;
    groups.forEach((g) => {
      const active = state.activeGroup === g.id;
      html += `
        <button class="group-dot-pill group-dot-pill--swatch ${active ? 'group-dot-pill--active' : ''}" data-group="${g.id}" aria-pressed="${active}" type="button" title="${g.name}" aria-label="筛选色系 ${g.name}">
          <span class="group-dot-pill__swatch" style="background:${g.id}"></span>
        </button>
      `;
    });
    html += `
      <button class="group-dot-pill ${state.sortBy === 'fav' ? 'group-dot-pill--active' : ''}" data-sort="fav" aria-pressed="${state.sortBy === 'fav'}" type="button" aria-label="筛选收藏色号">${iconHtml(state.sortBy === 'fav' ? 'starFilled' : 'star', 12)}<span>${favCount}</span></button>
      <button class="group-dot-pill ${state.sortBy === 'incart' ? 'group-dot-pill--active' : ''}" data-sort="incart" aria-pressed="${state.sortBy === 'incart'}" type="button" aria-label="筛选购物车内色号">${iconHtml('bag', 12)}<span>${cartColors}</span></button>
    `;
    bar.innerHTML = html;
  }

  function renderLoupeHeaderAndControls() {
    const c = state.featuredColor || state.allColors[0];
    if (!c) return;
    const title = document.getElementById('heroTitle');
    const hexTag = document.getElementById('heroHexTag');
    const dot = document.getElementById('heroColorDot');
    const addBtn = document.getElementById('btnHeroQuickAdd');
    const inputW = document.getElementById('inputLoupeWeight');

    if (title) title.textContent = `#${c.code}`;
    if (hexTag) hexTag.textContent = String(c.hex || '').toUpperCase();
    if (dot) dot.style.background = c.hex;
    if (inputW) inputW.value = String(state.loupeWeight);
    const estPrice = ((Number(c.price100g || 11.5) * state.loupeWeight) / 100).toFixed(2);
    if (addBtn) addBtn.textContent = `+ ${state.loupeWeight}g · ¥${estPrice}`;

    // Telemetry strip
    const lightEl = document.getElementById('metricLight');
    const priceEl = document.getElementById('metricPrice');
    const beadsEl = document.getElementById('metricBeads');
    const beadsPer100 = state.currentShape === 'square' ? 19200 : 16500;
    const lightVal = Number.isFinite(Number(c.light)) ? Math.round(Number(c.light)) : 50;
    if (lightEl) lightEl.textContent = `${lightVal}%`;
    if (priceEl) priceEl.textContent = `¥${Number(c.price100g || 11.5).toFixed(2)}`;
    if (beadsEl) beadsEl.textContent = formatBeads(Math.round((beadsPer100 * state.loupeWeight) / 100));

    // Perceptual nearest-neighbor substitute chips
    const neighborsEl = document.getElementById('loupeNeighborsList');
    const neighbors = findNearestNeighbors(c, 3);
    if (neighborsEl) {
      neighborsEl.innerHTML = neighbors
        .map(
          (n) => `
          <button class="neighbor-chip" type="button" data-neighbor="${n.code}" title="${state.loupeViewMode === 'compare' ? `设为右侧对比色 #${n.code}` : `切换到临近色 #${n.code}`}">
            <span class="neighbor-chip__dot" style="background:${n.hex}"></span>
            <span>#${n.code}</span>
          </button>`
        )
        .join('');
    }

    // Recent Inspected Colors Rail (last 4 excluding current)
    const recentRow = document.getElementById('loupeRecentRow');
    const recentList = document.getElementById('loupeRecentList');
    if (recentRow && recentList) {
      const recents = state.recentCodes
        .filter((code) => code !== c.code)
        .slice(0, 4)
        .map((code) => state.allColors.find((x) => x.code === code))
        .filter(Boolean);
      recentRow.hidden = recents.length === 0;
      recentList.innerHTML = recents
        .map(
          (n) => `
          <button class="neighbor-chip" type="button" data-recent="${n.code}" title="回到最近检视的 #${n.code}">
            <span class="neighbor-chip__dot" style="background:${n.hex}"></span>
            <span>#${n.code}</span>
          </button>`
        )
        .join('');
    }

    // Compare Strip HUD
    const cmpStrip = document.getElementById('loupeCompareStrip');
    const cmpLabel = document.getElementById('loupeCompareLabel');
    if (cmpStrip) {
      const showCmp = state.loupeViewMode === 'compare';
      cmpStrip.hidden = !showCmp;
      if (showCmp) {
        const cmp = state.compareColor && state.compareColor.code !== c.code ? state.compareColor : neighbors[0] || c;
        state.compareColor = cmp;
        const delta = Math.sqrt(perceptualDistSq(hexToRgb255(c.hex), hexToRgb255(cmp.hex))) / 7.65;
        if (cmpLabel) cmpLabel.textContent = `#${c.code} vs #${cmp.code} · ΔE ${delta.toFixed(1)}`;
      }
    }

    // Matrix Multi-Color Pattern Strip HUD
    const matStrip = document.getElementById('loupeMatrixStrip');
    const matDots = document.getElementById('loupeMatrixDots');
    if (matStrip) {
      const showMat = state.loupeViewMode === 'matrix';
      matStrip.hidden = !showMat;
      if (showMat) {
        document.querySelectorAll('#loupeMatrixPatternPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.mpat === state.matrixPattern;
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (matDots) {
          const { legendColors } = buildMatrixHexList(c, state.matrixPattern);
          matDots.innerHTML = legendColors
            .map((lc) => `<span class="matrix-dot" style="background:${lc.hex}" title="#${lc.code}"></span>`)
            .join('');
        }
      }
    }

    document.querySelectorAll('#loupeWeightBar .loupe-w-btn').forEach((btn) => {
      const on = Number(btn.dataset.weight) === state.loupeWeight;
      btn.classList.toggle('loupe-w-btn--active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    const stageEl = document.getElementById('loupeStage');
    if (stageEl) {
      stageEl.classList.toggle('loupe-stage--ivory', state.studioBoardBg === '#f5f2eb');
      stageEl.classList.toggle('loupe-stage--white', state.studioBoardBg === '#ffffff');
    }
    document.querySelectorAll('#loupeBgDots .studio-bg-dot').forEach((btn) => {
      const on = btn.dataset.bg === state.studioBoardBg;
      btn.classList.toggle('studio-bg-dot--active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    const symBtn = document.getElementById('btnLoupeSymbol');
    if (symBtn) {
      symBtn.hidden = state.loupeViewMode !== 'matrix';
      symBtn.classList.toggle('studio-stage__spin--active', state.loupeSymbolMode);
      symBtn.setAttribute('aria-pressed', String(state.loupeSymbolMode));
    }

    const dockMount = document.getElementById('cartDockGemMount');
    if (dockMount) {
      dockMount.innerHTML = getDrillSvgCached({
        hex: c.hex,
        shape: state.currentShape,
        rotX: 16,
        rotY: -18,
        finish: state.studioFinish,
        size: 64
      });
    }

    if (loupeCtrl) loupeCtrl.repaint();
  }

  function applyFilters() {
    const rawQ = (state.searchQuery || '').trim().toLowerCase();
    const tokens = parseSearchTokens(rawQ);
    state.matchedTokens = tokens;
    const isMulti = tokens.length > 1;
    const singleQ = tokens[0] ? tokens[0].code : '';

    let list = state.allColors.filter((c) => {
      if (state.activeGroup !== 'ALL' && c.group !== state.activeGroup) return false;
      if (!matchNumericRange(c.code, state.activeRange)) return false;
      if (!singleQ) return true;
      if (isMulti) {
        return tokens.some((tk) => c.code.toLowerCase() === tk.code || c.hex.toLowerCase().replace(/^#/, '') === tk.code);
      }
      return c.code.toLowerCase().includes(singleQ) || c.hex.toLowerCase().includes(rawQ);
    });

    if (state.sortBy === 'fav') {
      list = list.filter((c) => Boolean(state.favMap[c.code]));
    } else if (state.sortBy === 'incart') {
      const codes = new Set(state.cart.map((i) => i.code));
      list = list.filter((c) => codes.has(c.code));
    }

    state.matchDeltaMap = {};
    if (state.colorMatchHex) {
      const targetRgb = hexToRgb255(state.colorMatchHex);
      const scored = list.map((c) => {
        if (!c._rgb) c._rgb = hexToRgb255(c.hex);
        const de = Math.sqrt(perceptualDistSq(targetRgb, c._rgb)) / 7.65;
        state.matchDeltaMap[c.code] = de;
        return { c, de };
      });
      scored.sort((a, b) => a.de - b.de);
      list = scored.slice(0, 12).map((x) => x.c);
    } else if (state.catalogSort === 'hue') {
      list = list.slice().sort((a, b) => {
        if (!a._rgb) a._rgb = hexToRgb255(a.hex);
        if (!b._rgb) b._rgb = hexToRgb255(b.hex);
        if (typeof a._hueKey !== 'number') a._hueKey = rgbToHueSortKey(a._rgb);
        if (typeof b._hueKey !== 'number') b._hueKey = rgbToHueSortKey(b._rgb);
        return a._hueKey - b._hueKey;
      });
    } else if (state.catalogSort === 'lightDesc') {
      list = list.slice().sort((a, b) => {
        const la = Number.isFinite(Number(a.light)) ? Number(a.light) : 50;
        const lb = Number.isFinite(Number(b.light)) ? Number(b.light) : 50;
        return lb - la;
      });
    } else if (state.catalogSort === 'lightAsc') {
      list = list.slice().sort((a, b) => {
        const la = Number.isFinite(Number(a.light)) ? Number(a.light) : 50;
        const lb = Number.isFinite(Number(b.light)) ? Number(b.light) : 50;
        return la - lb;
      });
    } else if (state.catalogSort === 'priceAsc') {
      list = list.slice().sort((a, b) => Number(a.price100g || 11.5) - Number(b.price100g || 11.5));
    }

    state.filteredColors = list;

    const countEl = document.getElementById('filterCountLabel');
    if (countEl) countEl.textContent = state.colorMatchHex ? `Top ${list.length}` : `${list.length} 色`;

    const batchBtn = document.getElementById('btnBatchAddMatched');
    if (batchBtn) {
      const isFavBatch = state.sortBy === 'fav' && list.length > 0 && list.length <= 40;
      const isMatchBatch = Boolean(state.colorMatchHex && list.length > 0);
      const isSearchBatch = Boolean(rawQ && list.length > 0 && (isMulti || list.length <= 24));
      const showBatch = isFavBatch || isMatchBatch || isSearchBatch;
      batchBtn.hidden = !showBatch;
      if (showBatch) {
        if (isFavBatch) batchBtn.textContent = `+ 收藏全加购 (${list.length}色)`;
        else if (isMatchBatch) batchBtn.textContent = `+ 匹配全加购 (${list.length}色)`;
        else batchBtn.textContent = `+ 批量加购 (${list.length}色)`;
      }
    }

    renderGroupsBar();
    renderCardsGrid();
    syncPathMarqueeItems();
  }

  // =========================================================================
  // Inspira UI SVG Path Marquee Integration (Hover Slowdown + Drag Control)
  // =========================================================================
  function getMarqueeRibbonColors() {
    const pool = state.filteredColors && state.filteredColors.length ? state.filteredColors : state.allColors;
    if (!pool.length) return [];
    const targetCount = 24;
    let picked = [];

    if (pool.length <= targetCount) {
      picked = pool.slice();
    } else {
      // Sort by chromatic hue for a breathtaking continuous gemstone rainbow along Inspira's SVG ribbon
      const chromatic = pool.slice().sort((a, b) => {
        if (!a._rgb) a._rgb = hexToRgb255(a.hex);
        if (!b._rgb) b._rgb = hexToRgb255(b.hex);
        if (typeof a._hueKey !== 'number') a._hueKey = rgbToHueSortKey(a._rgb);
        if (typeof b._hueKey !== 'number') b._hueKey = rgbToHueSortKey(b._rgb);
        return a._hueKey - b._hueKey;
      });
      const step = chromatic.length / targetCount;
      const shift = ((marqueeWindowOffset % chromatic.length) + chromatic.length) % chromatic.length;
      const seen = new Set();
      for (let i = 0; i < targetCount; i++) {
        const idx = Math.floor((shift + i * step) % chromatic.length);
        const col = chromatic[idx];
        if (col && !seen.has(col.code)) {
          seen.add(col.code);
          picked.push(col);
        }
      }
    }

    // Ensure currently focused diamond stays represented on the active ribbon when it belongs to pool
    if (state.featuredColor && pool.some((c) => c.code === state.featuredColor.code)) {
      if (!picked.some((c) => c.code === state.featuredColor.code)) {
        picked[Math.floor(picked.length / 2)] = state.featuredColor;
      }
    }
    return picked;
  }

  function renderMarqueeGemHtml(color, isRepeat) {
    const svg = D3D && typeof D3D.renderDrillSvg === 'function'
      ? D3D.renderDrillSvg({
          hex: color.hex,
          shape: state.currentShape,
          finish: state.studioFinish,
          size: 58,
          omitDefs: true
        })
      : '';
    const tabAttr = isRepeat ? 'tabindex="-1"' : 'tabindex="0"';
    const price = Number(color.price100g || 11.5).toFixed(2);
    return `
      <div class="pm-gem-btn" role="button" ${tabAttr} aria-label="选择 DMC #${color.code}，单价 ¥${price}">
        <span class="pm-gem-btn__svg" aria-hidden="true">${svg}</span>
        <span class="pm-gem-badge tabular">#${color.code} · ¥${price}</span>
        <button class="pm-gem-quickadd" type="button" data-pm-quickadd="${color.code}" tabindex="-1" title="快速加购 #${color.code} (${state.quickWeight}g)" aria-label="快速加购 #${color.code}">+</button>
      </div>
    `;
  }

  function syncMarqueeAmbient(color) {
    const c = color || state.featuredColor || state.allColors[0];
    if (!c) return;
    const glow = document.getElementById('marqueeAmbientGlow');
    if (glow) glow.style.setProperty('--marquee-tint', c.hex);
    const dot = document.getElementById('marqueeActiveDot');
    if (dot) dot.style.background = c.hex;
    const codeEl = document.getElementById('marqueeActiveCode');
    if (codeEl) codeEl.textContent = `#${c.code}`;
  }

  function syncMarqueeStatusBar(pmState) {
    const statusEl = document.getElementById('marqueeStatusText');
    if (!statusEl) return;
    const s = pmState || (pathMarqueeCtrl ? pathMarqueeCtrl.getState() : null);
    if (s && s.isDragging) {
      statusEl.textContent = '拖拽循轨控制中 · 松手惯性滑行';
    } else if (marqueeHoveredColor) {
      const p = Number(marqueeHoveredColor.price100g || 11.5).toFixed(2);
      statusEl.textContent = `悬停减速中 · #${marqueeHoveredColor.code} (¥${p}/100g)`;
    } else if (s && s.userPaused) {
      statusEl.textContent = '轨道已暂停 · 仍可拖拽循轨选钻';
    } else {
      statusEl.textContent = '悬停减速 · 拖拽循轨选钻';
    }
  }

  function syncPathMarqueeItems() {
    if (!pathMarqueeCtrl) return;
    const colors = getMarqueeRibbonColors();
    pathMarqueeCtrl.setItems(colors, state.featuredColor ? state.featuredColor.code : null);
    syncMarqueeAmbient(state.featuredColor);
    syncMarqueeStatusBar();
  }

  function initPathMarquee() {
    const host = document.getElementById('diamondPathMarquee');
    if (!host || !window.InspiraPathMarquee || typeof window.InspiraPathMarquee.createPathMarquee !== 'function') return;
    pathMarqueeCtrl = window.InspiraPathMarquee.createPathMarquee(host, {
      preset: 'loop',
      baseVelocity: 6.2,
      slowdownOnHover: true,
      slowDownFactor: 0.2,
      slowDownStiffness: 400,
      draggable: true,
      dragSensitivity: 0.13,
      dragVelocityDecay: 0.96,
      dragAwareDirection: true,
      showPath: true,
      targetSlotCount: 24,
      renderItem: renderMarqueeGemHtml,
      onSelect(color) {
        focusColorInLoupe(color);
        showToast(`已循轨锁定 #${color.code} · 可在下方 3D 检视或直接加购`);
      },
      onQuickAdd(color, evt) {
        addItemToCart(color, state.currentShape, state.quickWeight, evt);
      },
      onHoverItem(color) {
        marqueeHoveredColor = color || null;
        if (color) syncMarqueeAmbient(color);
        else syncMarqueeAmbient(state.featuredColor);
        syncMarqueeStatusBar();
      },
      onStateChange(pmState) {
        syncMarqueeStatusBar(pmState);
      }
    });
  }

  function buildCardFooterHtml(c, inCartW) {
    if (inCartW) {
      return `
        <div class="card-inline-stepper">
          <button class="card-step-mini" data-action="card-minus" data-code="${c.code}" type="button" aria-label="#${c.code} 减少100g">-100g</button>
          <span class="card-step-qty tabular">${inCartW}g</span>
          <button class="card-step-mini card-step-mini--plus" data-action="card-plus" data-code="${c.code}" type="button" aria-label="#${c.code} 增加100g">+100g</button>
        </div>
      `;
    }
    return `
      <button class="card-weight-pill tabular" data-action="focus" data-code="${c.code}" type="button">${state.quickWeight}g</button>
      <button class="btn-add-cart" data-action="add" data-code="${c.code}" type="button">+ 加购</button>
    `;
  }

  function syncGridDensityUi(nextDensity) {
    const allowed = ['comfort', 'compact', 'list'];
    state.gridDensity = allowed.includes(nextDensity) ? nextDensity : 'comfort';
    const grid = document.getElementById('cardsGrid');
    if (grid) {
      grid.classList.toggle('cards-grid--compact', state.gridDensity === 'compact');
      grid.classList.toggle('cards-grid--list', state.gridDensity === 'list');
    }
    document.querySelectorAll('#gridDensitySwitch .density-btn').forEach((btn) => {
      const on = btn.dataset.density === state.gridDensity;
      btn.classList.toggle('density-btn--active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    persistState();
  }

  function renderCardsGrid() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    const list = state.filteredColors;
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-grid-state">
          <p>当前筛选条件下未匹配到 DMC 色号。</p>
          <button class="empty-reset-btn" id="btnResetEmptyFilter" type="button">重置全部筛选</button>
        </div>`;
      return;
    }
    const activeCode = state.featuredColor ? state.featuredColor.code : '';
    const compareCode = state.loupeViewMode === 'compare' && state.compareColor ? state.compareColor.code : '';
    grid.innerHTML = list
      .map((c) => {
        const key = `${c.code}_${state.currentShape}`;
        const inCartW = state.cartMap[key] || 0;
        const isFav = Boolean(state.favMap[c.code]);
        const isFocused = c.code === activeCode;
        const isCompared = c.code === compareCode && !isFocused;
        const svg = getDrillSvgCached({
          hex: c.hex,
          shape: state.currentShape,
          rotX: 5,
          rotY: -6,
          finish: state.studioFinish,
          size: 120
        });
        const wellTone = Number(c.light) >= 85 ? 'drill-well--deep' : '';
        const lightPct = Number.isFinite(Number(c.light)) ? Math.round(Number(c.light)) : 50;
        const priceTxt = Number(c.price100g || 11.5).toFixed(2);
        return `
          <article class="gradient-card ${isFocused ? 'gradient-card--focused' : ''} ${isCompared ? 'gradient-card--compared' : ''}" data-code="${c.code}" tabindex="0">
            <div class="gradient-card__header">
              <div class="gradient-card__code-row">
                <span class="swatch-dot" style="background:${c.hex}"></span>
                <strong class="gradient-card__code tabular">#${c.code}</strong>
                <span class="gradient-card__meta-list tabular">
                  <span>${String(c.hex || '').toUpperCase()}</span>
                  <span>明度 ${lightPct}%</span>
                  <span>¥${priceTxt}/100g</span>
                </span>
              </div>
              <div class="gradient-card__badges">
                ${state.colorMatchHex && Number.isFinite(state.matchDeltaMap[c.code]) ? `<span class="card-badge--de tabular">ΔE ${state.matchDeltaMap[c.code].toFixed(1)}</span>` : ''}
                ${inCartW ? `<span class="card-badge--in-cart tabular">${inCartW}g</span>` : ''}
                <button class="card-fav-btn ${isFav ? 'card-fav-btn--active' : ''}" data-action="fav" data-code="${c.code}" aria-pressed="${isFav}" type="button" aria-label="收藏 #${c.code}">
                  ${iconHtml(isFav ? 'starFilled' : 'star', 14)}
                </button>
              </div>
            </div>
            <div class="gradient-card__stage">
              <div class="drill-well drill-well--${state.currentShape} ${wellTone}">
                ${svg}
              </div>
            </div>
            <div class="gradient-card__footer">
              ${buildCardFooterHtml(c, inCartW)}
            </div>
          </article>
        `;
      })
      .join('');
  }

  // Zero-Reflow In-Place Focused & Compared Card Sync (avoids destroying 445 cards on click)
  function syncFocusedCardInPlace(nextCode) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    const focusCode = nextCode || (state.featuredColor ? state.featuredColor.code : '');
    const compareCode = state.loupeViewMode === 'compare' && state.compareColor ? state.compareColor.code : '';
    grid.querySelectorAll('.gradient-card--focused').forEach((el) => {
      if (el.dataset.code !== focusCode) el.classList.remove('gradient-card--focused');
    });
    grid.querySelectorAll('.gradient-card--compared').forEach((el) => {
      if (el.dataset.code !== compareCode) el.classList.remove('gradient-card--compared');
    });
    if (focusCode) {
      const nextCard = grid.querySelector(`.gradient-card[data-code="${CSS.escape(focusCode)}"]`);
      if (nextCard) nextCard.classList.add('gradient-card--focused');
    }
    if (compareCode && compareCode !== focusCode) {
      const cmpCard = grid.querySelector(`.gradient-card[data-code="${CSS.escape(compareCode)}"]`);
      if (cmpCard) cmpCard.classList.add('gradient-card--compared');
    }
  }

  function setCompareColor(color) {
    if (!color) return;
    if (state.featuredColor && color.code === state.featuredColor.code) {
      showToast(`#${color.code} 已是当前左侧主色`);
      return;
    }
    state.compareColor = color;
    state.loupeViewMode = 'compare';
    document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
      const on = b.dataset.view === 'compare';
      b.classList.toggle('studio-hud-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderLoupeHeaderAndControls();
    syncFocusedCardInPlace();
    showToast(`右侧对比色已设为 #${color.code}`);
  }

  // In-place targeted card cart/fav state update
  function patchSingleCardInPlace(code) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    const card = grid.querySelector(`.gradient-card[data-code="${CSS.escape(code)}"]`);
    const c = state.allColors.find((x) => x.code === code);
    if (!card || !c) return;
    const key = `${c.code}_${state.currentShape}`;
    const inCartW = state.cartMap[key] || 0;
    const isFav = Boolean(state.favMap[c.code]);

    const badges = card.querySelector('.gradient-card__badges');
    if (badges) {
      badges.innerHTML = `
        ${state.colorMatchHex && Number.isFinite(state.matchDeltaMap[c.code]) ? `<span class="card-badge--de tabular">ΔE ${state.matchDeltaMap[c.code].toFixed(1)}</span>` : ''}
        ${inCartW ? `<span class="card-badge--in-cart tabular">${inCartW}g</span>` : ''}
        <button class="card-fav-btn ${isFav ? 'card-fav-btn--active' : ''}" data-action="fav" data-code="${c.code}" aria-pressed="${isFav}" type="button" aria-label="收藏 #${c.code}">
          ${iconHtml(isFav ? 'starFilled' : 'star', 14)}
        </button>
      `;
    }
    const footer = card.querySelector('.gradient-card__footer');
    if (footer) {
      footer.innerHTML = buildCardFooterHtml(c, inCartW);
    }
  }

  // Bespoke Multi-Color SVG Weight Spectrum Bar
  function renderSpectrumSvg(svgId, width, customItems) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const list = Array.isArray(customItems) ? customItems : state.cart;
    const totalW = list.reduce((s, i) => s + i.weightGrams, 0);
    if (!list.length || totalW <= 0) {
      svg.innerHTML = `<rect x="0" y="0" width="${width}" height="10" fill="#dde2ea"><title>暂无克重占比</title></rect>`;
      return;
    }
    let cursorX = 0;
    const rects = list
      .map((item, idx) => {
        const pct = item.weightGrams / totalW;
        const segW = idx === list.length - 1 ? Math.max(0, width - cursorX) : width * pct;
        const x = cursorX;
        cursorX += segW;
        const stroke = Number(item.light) >= 82 ? 'rgba(20,23,28,0.22)' : 'rgba(255,255,255,0.22)';
        const pctLabel = Math.round(pct * 100);
        return `<rect x="${x.toFixed(2)}" y="0" width="${Math.max(1.5, segW).toFixed(2)}" height="10" fill="${item.hex}" stroke="${stroke}" stroke-width="0.6"><title>#${item.code} (${item.shape === 'round' ? '圆钻' : '方钻'}) · ${item.weightGrams}g (${pctLabel}%)</title></rect>`;
      })
      .join('');
    svg.innerHTML = rects;
  }

  function renderSchemesStrip() {
    const strip = document.getElementById('cartSchemesStrip');
    const listEl = document.getElementById('cartSchemesList');
    if (!strip || !listEl) return;
    strip.hidden = state.schemes.length === 0;
    if (state.schemes.length === 0) {
      listEl.innerHTML = '';
      return;
    }
    listEl.innerHTML = state.schemes
      .map((sc) => {
        const safeId = escapeHtml(sc.id);
        const safeName = escapeHtml(sc.name);
        const items = Array.isArray(sc.items) ? sc.items : [];
        const dots = items
          .slice(0, 4)
          .map((i) => {
            const col = i && state.allColors.find((c) => c.code === i.code);
            return `<span class="scheme-chip__dot" style="background:${col ? col.hex : '#888'}"></span>`;
          })
          .join('');
        return `
          <div class="scheme-chip">
            <button class="scheme-chip__load" data-scheme-load="${safeId}" type="button" title="载入方案 ${safeName}">
              <span class="scheme-chip__dots" aria-hidden="true">${dots}</span>
              <span>${safeName}</span>
            </button>
            <button class="scheme-chip__del" data-scheme-del="${safeId}" type="button" aria-label="删除方案 ${safeName}" title="删除方案">×</button>
          </div>`;
      })
      .join('');
  }

  function saveCurrentScheme() {
    if (!state.cart.length) {
      showToast('购物车为空，无法保存方案');
      return;
    }
    const totalW = state.cart.reduce((s, i) => s + i.weightGrams, 0);
    const seq = state.schemes.length + 1;
    const entry = {
      id: `sc_${Date.now()}`,
      name: `方案#${seq} · ${state.cart.length}色 ${totalW}g`,
      items: state.cart.map((i) => ({ code: i.code, shape: i.shape, weightGrams: i.weightGrams }))
    };
    state.schemes = [entry, ...state.schemes].slice(0, 8);
    persistSchemes();
    renderSchemesStrip();
    showToast(`已保存 ${entry.name}`);
  }

  function updateCartState(nextCart, changedCodes) {
    const prevCodes = new Set(state.cart.map((i) => i.code));
    state.cart = nextCart.map((item) => buildCartItem(item, item.shape, item.weightGrams)).filter(Boolean);
    const map = {};
    let totalW = 0;
    let totalP = 0;
    let roundCnt = 0;
    let sqCnt = 0;
    let totalBeads = 0;

    state.cart.forEach((item) => {
      map[item.key] = item.weightGrams;
      totalW += item.weightGrams;
      totalP += Number(item.subtotal);
      totalBeads += item.beads;
      if (item.shape === 'round') roundCnt += 1;
      else sqCnt += 1;
    });
    state.cartMap = map;

    const badge = document.getElementById('cartBadge');
    const pill = document.getElementById('cartDockWeightPill');
    const briefLine = document.getElementById('cartDockBriefLine');
    const drawerTitle = document.getElementById('cartDrawerTitle');
    const drawerStrip = document.getElementById('cartBriefStrip');
    const drawerTotal = document.getElementById('cartDrawerTotal');

    const totalPStr = `¥${totalP.toFixed(2)}`;
    const beadsText = formatBeads(totalBeads);
    if (badge) badge.textContent = String(state.cart.length);
    updateCartOdometer(totalPStr);
    if (pill) pill.textContent = `${state.cart.length}色 · ${totalW}g`;
    if (briefLine) {
      briefLine.textContent =
        state.cart.length > 0 ? `圆钻${roundCnt} / 方钻${sqCnt} · 约${beadsText}颗` : '单款最低 100g 起购';
    }
    if (drawerTitle) drawerTitle.textContent = `购物车 (${state.cart.length}色 · ${totalW}g)`;
    if (drawerStrip) drawerStrip.textContent = `圆钻${roundCnt} / 方钻${sqCnt} · 共 ${totalW}g · 约 ${beadsText} 颗 · 单款100g起`;
    if (drawerTotal) drawerTotal.textContent = totalPStr;

    renderSpectrumSvg('cartSpectrumSvg', 520);
    renderCartDrawerList();
    renderGroupsBar();
    persistState();
    if (state.matrixPattern === 'cart' && (state.loupeViewMode === 'matrix' || state.studioViewMode === 'matrix')) {
      renderLoupeHeaderAndControls();
      if (state.studioOpen) renderStudio();
    }

    if (state.sortBy === 'incart') {
      applyFilters();
    } else if (Array.isArray(changedCodes) && changedCodes.length > 0) {
      changedCodes.forEach((code) => patchSingleCardInPlace(code));
    } else {
      const allTouched = new Set([...prevCodes, ...state.cart.map((i) => i.code)]);
      allTouched.forEach((code) => patchSingleCardInPlace(code));
    }
  }

  function renderCartDrawerList() {
    const container = document.getElementById('cartListContainer');
    if (!container) return;
    if (state.cart.length === 0) {
      container.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--hub-text-muted);font-size:13px;">购物车为空，选择任意色号 100g 起购。</div>`;
      return;
    }
    container.innerHTML = state.cart
      .map((item) => {
        const svg = getDrillSvgCached({
          hex: item.hex,
          shape: item.shape,
          rotX: 16,
          rotY: -18,
          finish: state.studioFinish,
          size: 72
        });
        return `
          <div class="cart-item">
            <button class="cart-item__well" data-cart-action="inspect" data-code="${item.code}" type="button" aria-label="检视 #${item.code}">
              ${svg}
            </button>
            <div class="cart-item__meta">
              <strong class="cart-item__code tabular">#${item.code}</strong>
              <button class="cart-item__shape-tag" data-cart-action="flip" data-key="${item.key}" type="button" title="切换圆钻/方钻">
                ${iconHtml(item.shape === 'round' ? 'round' : 'square', 11)}
                <span>${item.shape === 'round' ? '圆钻' : '方钻'}</span>
                ${iconHtml('swap', 11)}
              </button>
            </div>
            <div class="cart-item__controls">
              <button class="cart-step-btn" data-cart-action="minus" data-key="${item.key}" type="button">-100g</button>
              <span class="cart-step-val tabular">${item.weightGrams}g</span>
              <button class="cart-step-btn" data-cart-action="plus" data-key="${item.key}" type="button">+100g</button>
            </div>
            <div class="cart-item__right">
              <span class="cart-item__subtotal tabular">¥${item.subtotal}</span>
              <button class="cart-step-btn cart-step-btn--icon" data-cart-action="del" data-key="${item.key}" type="button" aria-label="移除 #${item.code}">${iconHtml('close', 12)}</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Compositor-Only rAF Flying Gem Physics (zero layout thrash, skips under reduced-motion)
  function triggerFlyingGem(color, shape, weightGrams, srcEvent) {
    const dock = document.getElementById('cartDock');
    const pulseDock = () => {
      if (!dock) return;
      dock.classList.remove('cart-dock--pulse');
      void dock.offsetWidth;
      dock.classList.add('cart-dock--pulse');
      clearTimeout(dock._pulseTimer);
      dock._pulseTimer = setTimeout(() => dock.classList.remove('cart-dock--pulse'), 220);
    };
    if (isReducedMotion()) {
      pulseDock();
      return;
    }
    const layer = document.getElementById('flyingGemLayer');
    if (!layer || !D3D || !dock) return;
    const dockRect = dock.getBoundingClientRect();
    const startX = srcEvent && typeof srcEvent.clientX === 'number' && srcEvent.clientX > 0 ? srcEvent.clientX : window.innerWidth * 0.5;
    const startY = srcEvent && typeof srcEvent.clientY === 'number' && srcEvent.clientY > 0 ? srcEvent.clientY : window.innerHeight * 0.45;
    const targetX = dockRect.left + 32;
    const targetY = dockRect.top + dockRect.height * 0.5;

    const el = document.createElement('div');
    el.className = 'flying-gem-3d';
    el.style.left = '0px';
    el.style.top = '0px';
    el.innerHTML = `${getDrillSvgCached({
      hex: color.hex,
      shape,
      rotX: 14,
      rotY: -18,
      finish: state.studioFinish,
      size: 64
    })}<span class="flying-gem-3d__badge tabular">+${weightGrams}g</span>`;
    layer.appendChild(el);

    const startTime = performance.now();
    const duration = 320;
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const x = startX + (targetX - startX) * ease;
      const y = startY + (targetY - startY) * ease - Math.sin(t * Math.PI) * 64;
      const scale = 1 - 0.52 * ease;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.opacity = String((1 - 0.25 * ease).toFixed(3));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.remove();
        pulseDock();
      }
    }
    requestAnimationFrame(step);
  }

  function addItemToCart(color, shape, weightGrams, srcEvent, silent) {
    if (!color) return;
    const w = clampWeight(weightGrams);
    const sh = shape === 'square' ? 'square' : 'round';
    const key = `${color.code}_${sh}`;
    const idx = state.cart.findIndex((i) => i.key === key);
    const next = state.cart.slice();
    if (idx >= 0) {
      next[idx] = buildCartItem(color, sh, next[idx].weightGrams + w);
    } else {
      next.unshift(buildCartItem(color, sh, w));
    }
    updateCartState(next, [color.code]);
    if (!silent) {
      triggerFlyingGem(color, sh, w, srcEvent);
      showToast(`已加购 #${color.code} · +${w}g`);
    }
  }

  function adjustCartWeight(color, shape, deltaGrams) {
    if (!color) return;
    const sh = shape === 'square' ? 'square' : 'round';
    const key = `${color.code}_${sh}`;
    const idx = state.cart.findIndex((i) => i.key === key);
    if (idx < 0) return;
    const cur = state.cart[idx];
    const nextW = cur.weightGrams + deltaGrams;
    if (nextW < MIN_WEIGHT) {
      showToast('单款最低 100g 起购');
      return;
    }
    const next = state.cart.slice();
    next[idx] = buildCartItem(cur, sh, nextW);
    updateCartState(next, [color.code]);
  }

  function focusColorInLoupe(color) {
    if (!color) return;
    if (state.featuredColor && state.featuredColor.code !== color.code) {
      state.recentCodes = [state.featuredColor.code, ...state.recentCodes.filter((k) => k !== state.featuredColor.code)].slice(0, 6);
    }
    state.featuredColor = color;
    state.studioBoardBg = Number(color.light) <= 22 ? '#f5f2eb' : '#181b26';
    persistState();
    renderLoupeHeaderAndControls();
    syncFocusedCardInPlace(color.code);
    syncMarqueeAmbient(color);
    if (pathMarqueeCtrl) pathMarqueeCtrl.setActiveCode(color.code);
  }

  function stepFeaturedColor(delta) {
    const pool = state.filteredColors.length ? state.filteredColors : state.allColors;
    if (!pool.length) return;
    const curCode = state.featuredColor ? state.featuredColor.code : '';
    const idx = pool.findIndex((c) => c.code === curCode);
    const nextIdx = idx >= 0 ? (idx + delta + pool.length) % pool.length : 0;
    focusColorInLoupe(pool[nextIdx]);
  }

  function openStudio(color) {
    if (!color) return;
    const wasOpen = state.studioOpen;
    const shape = wasOpen ? state.studioShape : state.currentShape;
    const weight = clampWeight(wasOpen ? state.studioWeight : state.loupeWeight);
    state.featuredColor = color;
    state.studioColor = color;
    state.studioShape = shape;
    state.studioWeight = weight;
    state.studioOpen = true;
    if (!wasOpen) {
      state.studioLightFx = state.loupeLightFx || 'none';
    }
    state.studioBoardBg = Number(color.light) <= 22 ? '#f5f2eb' : '#181b26';
    if (studioCtrl) {
      studioCtrl.setPaused(false);
      studioCtrl.setLightFx(state.studioLightFx);
    }

    const wasTop = modalStack.length > 0 && modalStack[modalStack.length - 1].id === 'studioModalMask';
    if (!wasOpen) {
      pushModalLayer('studioModalMask', 'btnCloseStudio');
      invalidateCanvasMetrics();
    } else if (!wasTop) {
      pushModalLayer('studioModalMask', 'btnCloseStudio');
    }
    renderLoupeHeaderAndControls();
    syncFocusedCardInPlace(color.code);
    renderStudio();
  }

  function closeStudio() {
    state.studioOpen = false;
    state.studioAutoSpin = false;
    state.studioSweeping = false;
    if (studioCtrl) {
      studioCtrl.setAutoSpin(false);
      studioCtrl.setLightFx('none');
      if (typeof studioCtrl.cancelSweep === 'function') studioCtrl.cancelSweep();
      studioCtrl.setPaused(true);
    }
    const spinBtn = document.getElementById('btnStudioAutoSpin');
    const sweepBtn = document.getElementById('btnStudioSweep');
    spinBtn?.classList.remove('studio-stage__spin--active');
    spinBtn?.setAttribute('aria-pressed', 'false');
    sweepBtn?.classList.remove('studio-stage__spin--active');
    sweepBtn?.setAttribute('aria-pressed', 'false');
    popModalLayer('studioModalMask');
  }

  function drawRoundedRectCompat(ctx, x, y, w, h, r) {
    if (D3D && typeof D3D.roundRectPath === 'function') {
      D3D.roundRectPath(ctx, x, y, w, h, r);
      return;
    }
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }

  function exportStudioSwatchCardPng(color) {
    const c = color || state.studioColor || state.featuredColor || state.allColors[0];
    if (!c || !D3D) return;
    const W = 1200;
    const H = 800;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    // Alabaster canvas backdrop
    ctx.fillStyle = '#f6f7f9';
    ctx.fillRect(0, 0, W, H);

    // Outer museum card frame
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(20, 23, 28, 0.14)';
    ctx.lineWidth = 2;
    drawRoundedRectCompat(ctx, 40, 40, W - 80, H - 80, 28);
    ctx.fill();
    ctx.stroke();

    // Left Obsidian Optical Chamber
    const stageX = 72;
    const stageY = 72;
    const stageW = 560;
    const stageH = 656;
    ctx.fillStyle = state.studioBoardBg === '#f5f2eb' ? '#f3efe6' : state.studioBoardBg === '#ffffff' ? '#ffffff' : '#111317';
    drawRoundedRectCompat(ctx, stageX, stageY, stageW, stageH, 20);
    ctx.fill();
    if (state.studioBoardBg !== '#181b26') {
      ctx.strokeStyle = 'rgba(20, 23, 28, 0.14)';
      ctx.stroke();
    }

    // Render live 3D diamond into chamber using active controller angle & safe clamped zoom
    const gemCanvas = document.createElement('canvas');
    gemCanvas.width = 520;
    gemCanvas.height = 520;
    const gCtx = gemCanvas.getContext('2d');
    const activeCtrl = state.studioOpen ? studioCtrl : loupeCtrl;
    const f = activeCtrl ? activeCtrl.getState() : { rotX: 8, rotY: -10, zoom: 1.05 };
    const safeZoom = Math.max(0.95, Math.min(1.22, Number(f.zoom) || 1.05));
    D3D.renderDrillToCanvas(gCtx, 520, 520, {
      hex: c.hex,
      shape: state.studioShape || state.currentShape,
      finish: state.studioFinish,
      rotX: f.rotX,
      rotY: f.rotY,
      zoom: safeZoom,
      showShadow: true
    });
    ctx.drawImage(gemCanvas, stageX + 20, stageY + 68);

    // Right Editorial Spec Panel
    const rx = 676;
    ctx.fillStyle = '#5d6574';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText('DMC 445 · OPTICAL ATELIER SWATCH', rx, 120);

    // Color dot + DMC code
    ctx.fillStyle = c.hex;
    ctx.beginPath();
    ctx.arc(rx + 22, 186, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 23, 28, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#14171c';
    ctx.font = '700 64px "JetBrains Mono", monospace';
    ctx.fillText(`#${c.code}`, rx + 62, 208);

    ctx.fillStyle = '#525866';
    ctx.font = '500 24px "JetBrains Mono", monospace';
    const shapeTxt = (state.studioShape || state.currentShape) === 'square' ? '方钻 · 25切面 (2.5mm)' : '圆钻 · 26切面 (2.8mm)';
    const finishTxt = FINISH_LABELS[state.studioFinish] || state.studioFinish;
    ctx.fillText(`${String(c.hex || '').toUpperCase()}  ·  ${shapeTxt}`, rx, 264);
    ctx.fillStyle = '#2454e8';
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.fillText(`光学工艺：${finishTxt}`, rx, 308);

    // Telemetry boxes
    const lightVal = Number.isFinite(Number(c.light)) ? Math.round(Number(c.light)) : 50;
    const priceVal = Number(c.price100g || 11.5).toFixed(2);
    const beadsTxt = (state.studioShape || state.currentShape) === 'square' ? '1.92万颗' : '1.65万颗';
    const specs = [
      ['相对明度', `${lightVal}%`],
      ['参考单价 / 100g', `¥${priceVal}`],
      ['百克约颗数', beadsTxt],
      ['起购规格', '100g / 袋']
    ];
    specs.forEach(([label, val], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = rx + col * 228;
      const by = 356 + row * 106;
      ctx.fillStyle = '#f6f7f9';
      ctx.strokeStyle = 'rgba(20, 23, 28, 0.10)';
      ctx.lineWidth = 1.5;
      drawRoundedRectCompat(ctx, bx, by, 212, 88, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5d6574';
      ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.fillText(label, bx + 18, by + 32);
      ctx.fillStyle = '#14171c';
      ctx.font = '600 26px "JetBrains Mono", monospace';
      ctx.fillText(val, bx + 18, by + 68);
    });

    // Nearest Substitute Neighbors
    ctx.fillStyle = '#5d6574';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.fillText('感知临近替补色号 (PERCEPTUAL SUBSTITUTES)', rx, 612);

    const neighbors = findNearestNeighbors(c, 3);
    neighbors.forEach((n, idx) => {
      const nx = rx + idx * 148;
      const ny = 634;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(20, 23, 28, 0.16)';
      ctx.lineWidth = 1.5;
      drawRoundedRectCompat(ctx, nx, ny, 136, 48, 24);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = n.hex;
      ctx.beginPath();
      ctx.arc(nx + 24, ny + 24, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 23, 28, 0.2)';
      ctx.stroke();
      ctx.fillStyle = '#14171c';
      ctx.font = '600 20px "JetBrains Mono", monospace';
      ctx.fillText(`#${n.code}`, nx + 44, ny + 31);
    });

    const dataUrl = off.toDataURL('image/png');
    const filename = `dmc-${c.code}-${state.studioShape || state.currentShape}-${state.studioFinish}.png`;
    state.swatchCardDataUrl = dataUrl;
    state.swatchCardFilename = filename;

    const img = document.getElementById('swatchCardPreviewImg');
    const titleEl = document.getElementById('swatchCardModalTitle');
    if (img) img.src = dataUrl;
    if (titleEl) titleEl.textContent = `DMC #${c.code} 3D 光学高清色卡 (1200×800)`;
    pushModalLayer('swatchCardModalMask', 'btnCloseSwatchCard');
    showToast(`已生成 #${c.code} 高清 3D 色卡`);
  }

  function closeSwatchCardModal() {
    popModalLayer('swatchCardModalMask');
  }

  function stepStudioColor(delta) {
    const pool = state.filteredColors.length ? state.filteredColors : state.allColors;
    if (!pool.length) return;
    const idx = pool.findIndex((c) => c.code === (state.studioColor && state.studioColor.code));
    const next = pool[(idx >= 0 ? idx + delta + pool.length : 0) % pool.length];
    openStudio(next);
  }

  function renderStudio() {
    const c = state.studioColor;
    if (!c) return;
    const dot = document.getElementById('studioHeaderDot');
    const title = document.getElementById('studioModalTitle');
    const hexEl = document.getElementById('studioModalHex');
    if (dot) dot.style.background = c.hex;
    if (title) title.textContent = `#${c.code}`;
    if (hexEl) hexEl.textContent = String(c.hex || '').toUpperCase();

    const studioStageEl = document.getElementById('studioStage');
    if (studioStageEl) {
      studioStageEl.classList.toggle('studio-stage--ivory', state.studioBoardBg === '#f5f2eb');
      studioStageEl.classList.toggle('studio-stage--white', state.studioBoardBg === '#ffffff');
    }
    document.querySelectorAll('#studioViewModePills .studio-hud-pill').forEach((b) => {
      const on = b.dataset.mode === state.studioViewMode;
      b.classList.toggle('studio-hud-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#studioBgDots .studio-bg-dot').forEach((btn) => {
      const on = btn.dataset.bg === state.studioBoardBg;
      btn.classList.toggle('studio-bg-dot--active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const symbolBtn = document.getElementById('btnStudioSymbolMode');
    if (symbolBtn) {
      symbolBtn.hidden = state.studioViewMode !== 'matrix';
      symbolBtn.classList.toggle('studio-stage__spin--active', state.studioSymbolMode);
      symbolBtn.setAttribute('aria-pressed', String(state.studioSymbolMode));
    }

    document.querySelectorAll('#studioFinishPills .studio-hud-pill').forEach((b) => {
      const on = b.dataset.finish === state.studioFinish;
      b.classList.toggle('studio-hud-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#studioLightFxPills .studio-hud-pill').forEach((b) => {
      const on = b.dataset.fx === state.studioLightFx;
      b.classList.toggle('studio-hud-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });

    const sCmpStrip = document.getElementById('studioCompareStrip');
    const sCmpLabel = document.getElementById('studioCompareLabel');
    if (sCmpStrip) {
      const showCmp = state.studioViewMode === 'compare';
      sCmpStrip.hidden = !showCmp;
      if (showCmp) {
        const cmp = state.compareColor && state.compareColor.code !== c.code ? state.compareColor : findNearestNeighbors(c, 1)[0] || c;
        state.compareColor = cmp;
        const delta = Math.sqrt(perceptualDistSq(hexToRgb255(c.hex), hexToRgb255(cmp.hex))) / 7.65;
        if (sCmpLabel) sCmpLabel.textContent = `#${c.code} vs #${cmp.code} · ΔE ${delta.toFixed(1)}`;
      }
    }

    const sMatStrip = document.getElementById('studioMatrixStrip');
    const sMatDots = document.getElementById('studioMatrixDots');
    if (sMatStrip) {
      const showMat = state.studioViewMode === 'matrix';
      sMatStrip.hidden = !showMat;
      if (showMat) {
        document.querySelectorAll('#studioMatrixPatternPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.mpat === state.matrixPattern;
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (sMatDots) {
          const { legendColors } = buildMatrixHexList(c, state.matrixPattern);
          sMatDots.innerHTML = legendColors
            .map((lc) => `<span class="matrix-dot" style="background:${lc.hex}" title="#${lc.code}"></span>`)
            .join('');
        }
      }
    }

    const sRound = document.getElementById('btnStudioShapeRound');
    const sSquare = document.getElementById('btnStudioShapeSquare');
    if (sRound) {
      sRound.classList.toggle('studio-shape-option--active', state.studioShape === 'round');
      sRound.setAttribute('aria-pressed', String(state.studioShape === 'round'));
    }
    if (sSquare) {
      sSquare.classList.toggle('studio-shape-option--active', state.studioShape === 'square');
      sSquare.setAttribute('aria-pressed', String(state.studioShape === 'square'));
    }

    document.querySelectorAll('#studioWeightPresets .studio-weight-pill').forEach((btn) => {
      const on = Number(btn.dataset.weight) === state.studioWeight;
      btn.classList.toggle('studio-weight-pill--active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const inputW = document.getElementById('inputStudioWeight');
    if (inputW) inputW.value = String(state.studioWeight);

    const totalPrice = ((Number(c.price100g || 11.5) * state.studioWeight) / 100).toFixed(2);
    const priceEl = document.getElementById('studioTotalPrice');
    const labelEl = document.getElementById('studioWeightLabel');
    const addBtn = document.getElementById('btnConfirmStudioAdd');
    if (priceEl) priceEl.textContent = `¥${totalPrice}`;
    if (labelEl) labelEl.textContent = `${state.studioWeight}g`;
    if (addBtn) addBtn.textContent = `+ ${state.studioWeight}g 加购`;

    if (studioCtrl) studioCtrl.repaint();
  }

  function syncShapeUi(nextShape) {
    const shape = nextShape === 'square' ? 'square' : 'round';
    state.currentShape = shape;
    state.studioShape = shape;
    const rBtn = document.getElementById('btnShapeRound');
    const sBtn = document.getElementById('btnShapeSquare');
    if (rBtn) {
      rBtn.setAttribute('aria-selected', String(shape === 'round'));
      rBtn.tabIndex = shape === 'round' ? 0 : -1;
    }
    if (sBtn) {
      sBtn.setAttribute('aria-selected', String(shape === 'square'));
      sBtn.tabIndex = shape === 'square' ? 0 : -1;
    }
    syncShapePill(true);
    persistState();
    renderLoupeHeaderAndControls();
    renderCardsGrid();
    syncPathMarqueeItems();
    if (state.studioOpen) renderStudio();
  }

  function syncFinishUi(nextFinish) {
    state.studioFinish = nextFinish || 'resin';
    persistState();
    document.querySelectorAll('#heroFinishPills .hero-finish-pill').forEach((b) => {
      const on = b.dataset.finish === state.studioFinish;
      b.classList.toggle('hero-finish-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#studioFinishPills .studio-hud-pill').forEach((b) => {
      const on = b.dataset.finish === state.studioFinish;
      b.classList.toggle('studio-hud-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderLoupeHeaderAndControls();
    renderCardsGrid();
    syncPathMarqueeItems();
    renderCartDrawerList();
    if (state.studioOpen) renderStudio();
  }

  // =========================================================================
  // HUB-UI v4.0 ⌘K Command Palette (inert + Tab trap + aria-activedescendant)
  // =========================================================================
  function buildCmdkItems(rawQuery) {
    const q = (rawQuery || '').trim().toLowerCase().replace(/^#/, '');
    const actions = [
      { id: 'act-round', label: '切换默认钻型：圆钻 (26切面)', meta: '快捷键 R', run: () => syncShapeUi('round') },
      { id: 'act-square', label: '切换默认钻型：方钻 (25切面)', meta: '快捷键 S', run: () => syncShapeUi('square') },
      { id: 'act-ab', label: '切换光学工艺：AB 极光镀膜', meta: '工艺', run: () => syncFinishUi('ab') },
      { id: 'act-chameleon', label: '切换光学工艺：炫彩真空电镀', meta: '工艺', run: () => syncFinishUi('chameleon') },
      { id: 'act-resin', label: '切换光学工艺：普通高透树脂', meta: '工艺', run: () => syncFinishUi('resin') },
      { id: 'act-studio', label: '打开当前色号全屏 3D 检视', meta: '3D 工作室', run: () => openStudio(state.featuredColor || state.allColors[0]) },
      { id: 'act-export-png', label: '生成当前色号高清 3D 色卡 PNG 预览', meta: 'PNG 色卡', run: () => exportStudioSwatchCardPng(state.featuredColor || state.allColors[0]) },
      { id: 'act-density-compact', label: '切换色卡视图：紧凑 7 列速览模式', meta: '视图密度', run: () => syncGridDensityUi('compact') },
      { id: 'act-density-list', label: '切换色卡视图：规格清单行视图', meta: '视图密度', run: () => syncGridDensityUi('list') },
      { id: 'act-bom', label: '批量导入配钻清单 (BOM 文本/表格)', meta: 'BOM 导入', run: () => openBomModal() },
      { id: 'act-photo', label: '图片画稿自动配钻 (上传画稿量化 DMC 445)', meta: '图片配钻', run: () => openPhotoModal() },
      { id: 'act-calc', label: '打开画布尺寸算钻器 (cm → 颗数 / 克重)', meta: '快捷键 G', run: () => openCalcModal() },
      { id: 'act-colormatch', label: '取色配钻：按自定义 RGB/Hex 匹配最接近 DMC', meta: 'ΔE 取色', run: () => activateColorMatch(document.getElementById('inputColorMatch')?.value || '#ff6a3d') },
      { id: 'act-rainbow', label: '切换色号排序：色相彩虹连续光谱', meta: '彩虹序', run: () => {
        state.catalogSort = 'hue';
        clearColorMatch();
        const sel = document.getElementById('catalogSortSelect');
        if (sel) sel.value = 'hue';
        applyFilters();
      } },
      { id: 'act-compare', label: '开启双色并排 3D 光学对比模式', meta: '双色对比', run: () => {
        state.loupeViewMode = 'compare';
        document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.view === 'compare';
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderLoupeHeaderAndControls();
        syncFocusedCardInPlace();
      } },
      { id: 'act-matrix-grad', label: '开启 5×5 临近渐变 3D 阵盘拼贴', meta: '混色阵盘', run: () => {
        state.loupeViewMode = 'matrix';
        state.matrixPattern = 'gradient';
        document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.view === 'matrix';
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderLoupeHeaderAndControls();
      } },
      { id: 'act-matrix-cart', label: '开启 5×5 购物车混色 3D 阵盘拼贴', meta: '配色预览', run: () => {
        state.loupeViewMode = 'matrix';
        state.matrixPattern = 'cart';
        document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.view === 'matrix';
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderLoupeHeaderAndControls();
      } },
      { id: 'act-cart', label: `打开配钻购物车 (${state.cart.length} 色)`, meta: '购物车', run: () => openCartDrawer() },
      { id: 'act-shortcuts', label: '打开光学工作台快捷键速查表', meta: '快捷键 ?', run: () => openShortcuts() },
      { id: 'act-random', label: '随机抽取一颗 DMC 钻石检视', meta: '灵感', run: () => {
        const next = state.allColors[Math.floor(Math.random() * state.allColors.length)];
        if (state.studioOpen) openStudio(next);
        else focusColorInLoupe(next);
      } }
    ];

    if (!q) return actions;

    const colorMatches = state.allColors
      .filter((c) => c.code.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q))
      .slice(0, 12)
      .map((c) => ({
        id: `col-${c.code}`,
        label: `检视 DMC #${c.code}`,
        dot: c.hex,
        meta: `${c.hex.toUpperCase()} · ¥${Number(c.price100g || 11.5).toFixed(2)}/100g`,
        run: () => {
          if (state.studioOpen) {
            openStudio(c);
          } else {
            focusColorInLoupe(c);
            const card = document.querySelector(`.gradient-card[data-code="${CSS.escape(c.code)}"]`);
            if (card) card.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' });
          }
        }
      }));

    const actionMatches = actions.filter((a) => `${a.label} ${a.meta}`.toLowerCase().includes(q));
    return [...colorMatches, ...actionMatches];
  }

  function renderCmdkList() {
    const listEl = document.getElementById('cmdkListbox');
    const countEl = document.getElementById('cmdkMatchCount');
    const inputEl = document.getElementById('cmdkInput');
    if (!listEl) return;

    const items = state.cmdkItems;
    if (countEl) countEl.textContent = `${items.length} 项匹配`;

    if (items.length === 0) {
      listEl.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--hub-text-muted);font-size:13px;">未找到匹配的 DMC 色号或指令。</div>`;
      inputEl?.removeAttribute('aria-activedescendant');
      return;
    }

    state.cmdkIndex = Math.max(0, Math.min(state.cmdkIndex, items.length - 1));
    listEl.innerHTML = items
      .map((item, idx) => {
        const selected = idx === state.cmdkIndex;
        const dotHtml = item.dot ? `<span class="swatch-dot" style="background:${item.dot}"></span>` : '';
        return `
          <button
            type="button"
            class="cmdk-option"
            id="cmdk-opt-${item.id}"
            role="option"
            tabindex="-1"
            aria-selected="${selected}"
            data-cmdk-idx="${idx}"
          >
            <span class="cmdk-option__left">${dotHtml}<span>${item.label}</span></span>
            <span class="cmdk-option__meta tabular">${item.meta}</span>
          </button>
        `;
      })
      .join('');

    const activeOpt = listEl.querySelector(`[data-cmdk-idx="${state.cmdkIndex}"]`);
    if (activeOpt && inputEl) {
      inputEl.setAttribute('aria-activedescendant', activeOpt.id);
    }
  }

  function syncCmdkActiveInPlace(nextIdx) {
    const listEl = document.getElementById('cmdkListbox');
    const inputEl = document.getElementById('cmdkInput');
    if (!listEl || !state.cmdkItems.length) return;
    state.cmdkIndex = (nextIdx + state.cmdkItems.length) % state.cmdkItems.length;
    const opts = listEl.querySelectorAll('.cmdk-option');
    opts.forEach((opt, i) => {
      const on = i === state.cmdkIndex;
      opt.setAttribute('aria-selected', String(on));
      if (on) {
        inputEl?.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function openCmdk() {
    if (state.cmdkOpen || performance.now() < suppressCmdkTriggerUntil) return;
    state.cmdkOpen = true;
    state.cmdkIndex = 0;
    const input = document.getElementById('cmdkInput');
    if (input) input.value = '';
    state.cmdkItems = buildCmdkItems('');
    renderCmdkList();
    pushModalLayer('cmdkModalMask', 'cmdkInput');
  }

  function closeCmdk(opts) {
    if (!state.cmdkOpen) return;
    state.cmdkOpen = false;
    popModalLayer('cmdkModalMask', opts);
  }

  // Smart BOM Clipboard Importer Modal
  function parseBomText(raw) {
    const lines = String(raw || '').split(/[\r\n;；]+/);
    const merged = new Map();
    const unknown = [];
    const byCode = new Map(state.allColors.map((c) => [c.code.toLowerCase(), c]));

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // Match explicit operator pairs ("310:500", "666 x 200", "310 - 500g") or "310 500g",
      // avoiding misparsing two space/comma-separated DMC codes like "310 5200" as weight!
      const linePair = trimmed.match(/^#?(?:dmc[_-]?)?([a-z0-9]+)\s*([:*x×,\t\-\s])\s*(\d+)\s*(g)?$/i);
      if (linePair) {
        const code = linePair[1].toLowerCase();
        const sep = linePair[2];
        const rawNum = linePair[3];
        const hasG = Boolean(linePair[4]);
        const isExplicitOp = /[:*x×\-]/.test(sep);
        const secondIsDmcCode = byCode.has(rawNum.toLowerCase());
        if (isExplicitOp || hasG || !secondIsDmcCode) {
          const w = clampWeight(Number(rawNum));
          const col = byCode.get(code);
          if (col) merged.set(col.code, (merged.get(col.code) || 0) + w);
          else unknown.push(linePair[1]);
          return;
        }
      }
      const tokens = parseSearchTokens(trimmed);
      tokens.forEach((tk) => {
        const col = byCode.get(tk.code);
        if (col) merged.set(col.code, (merged.get(col.code) || 0) + (tk.weight || state.quickWeight));
        else unknown.push(tk.code);
      });
    });

    const matched = Array.from(merged.entries()).map(([code, weightGrams]) => {
      const col = byCode.get(code.toLowerCase());
      return buildCartItem(col, state.currentShape, weightGrams);
    });
    return { matched, unknown };
  }

  function renderBomPreview() {
    const ta = document.getElementById('bomTextarea');
    const warnEl = document.getElementById('bomWarn');
    const listEl = document.getElementById('bomPreviewList');
    const lblEl = document.getElementById('bomSummaryLabel');
    const valEl = document.getElementById('bomSummaryVal');
    const commitBtn = document.getElementById('btnBomCommit');
    if (!ta || !listEl) return;

    const { matched, unknown } = parseBomText(ta.value);
    state.bomParsed = matched;

    if (warnEl) {
      warnEl.hidden = unknown.length === 0;
      if (unknown.length > 0) {
        warnEl.textContent = `未识别色号 (${unknown.length})：${unknown.slice(0, 8).join(', ')}`;
      }
    }

    if (matched.length === 0) {
      listEl.innerHTML = '';
      if (lblEl) lblEl.textContent = '等待输入配钻清单';
      if (valEl) valEl.textContent = '¥0.00';
      if (commitBtn) commitBtn.disabled = true;
      return;
    }

    const totalW = matched.reduce((s, i) => s + i.weightGrams, 0);
    const totalP = matched.reduce((s, i) => s + Number(i.subtotal), 0).toFixed(2);
    listEl.innerHTML = matched
      .map((item) => {
        const svg = getDrillSvgCached({ hex: item.hex, shape: item.shape, rotX: 14, rotY: -16, finish: state.studioFinish, size: 48 });
        return `
          <div class="bom-row">
            <span class="bom-row__left">
              <span class="bom-row__well">${svg}</span>
              <strong>#${item.code}</strong>
              <span style="color:var(--hub-text-muted)">${item.shape === 'round' ? '圆钻' : '方钻'} · 约${item.beadsText}颗</span>
            </span>
            <span>${item.weightGrams}g · ¥${item.subtotal}</span>
          </div>`;
      })
      .join('');

    if (lblEl) lblEl.textContent = `已匹配 ${matched.length} 色 · 共 ${totalW}g`;
    if (valEl) valEl.textContent = `¥${totalP}`;
    if (commitBtn) commitBtn.disabled = false;
  }

  // Client-Side Image / Artwork DMC 445 Pixel Quantizer
  function paintSampleArtwork(canvas, kind) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (kind === 'botanical') {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#eef4ea');
      bg.addColorStop(1, '#c8dec2');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2d5a3c';
      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.68, 34, 20, -0.5, 0, Math.PI * 2);
      ctx.ellipse(w * 0.72, h * 0.62, 36, 20, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5f8d65';
      ctx.beginPath();
      ctx.ellipse(w * 0.50, h * 0.74, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d95b7a';
      ctx.beginPath();
      ctx.arc(w * 0.44, h * 0.38, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a2b6';
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.34, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6d56b';
      ctx.beginPath();
      ctx.arc(w * 0.44, h * 0.38, 6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind === 'porcelain') {
      ctx.fillStyle = '#f8f9fb';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b3d87';
      ctx.fillRect(0, 0, w, 16);
      ctx.fillRect(0, h - 16, w, 16);
      ctx.fillStyle = '#3b6cc7';
      ctx.beginPath();
      ctx.arc(w * 0.34, h * 0.5, 22, 0, Math.PI * 2);
      ctx.arc(w * 0.68, h * 0.5, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8db4e8';
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.48, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.34, h * 0.5, 8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Default: sunset
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0, '#2a2b5f');
    sky.addColorStop(0.5, '#c94c5b');
    sky.addColorStop(1, '#f4a259');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.65);
    ctx.fillStyle = '#ffe394';
    ctx.beginPath();
    ctx.arc(w * 0.52, h * 0.52, 16, 0, Math.PI * 2);
    ctx.fill();
    const sea = ctx.createLinearGradient(0, h * 0.65, 0, h);
    sea.addColorStop(0, '#3e4c7c');
    sea.addColorStop(1, '#19223c');
    ctx.fillStyle = sea;
    ctx.fillRect(0, h * 0.65, w, h * 0.35);
    ctx.fillStyle = '#f28b50';
    ctx.fillRect(w * 0.36, h * 0.68, w * 0.32, 6);
  }

  function quantizeCanvasToDmc445(canvas, label) {
    if (!canvas || !state.allColors.length) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bucketCache = new Map();
    const counts = new Map();
    let totalSamples = 0;

    for (let i = 0; i < img.length; i += 8) {
      const a = img[i + 3];
      if (a < 120) continue;
      const r = img[i];
      const g = img[i + 1];
      const b = img[i + 2];
      const bKey = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let matchedCode = bucketCache.get(bKey);
      if (!matchedCode) {
        let bestDist = Infinity;
        let bestCode = state.allColors[0].code;
        const rgb = [r, g, b];
        for (let k = 0; k < state.allColors.length; k++) {
          const cand = state.allColors[k];
          if (!cand._rgb) cand._rgb = hexToRgb255(cand.hex);
          const d = perceptualDistSq(rgb, cand._rgb);
          if (d < bestDist) {
            bestDist = d;
            bestCode = cand.code;
          }
        }
        matchedCode = bestCode;
        bucketCache.set(bKey, matchedCode);
      }
      counts.set(matchedCode, (counts.get(matchedCode) || 0) + 1);
      totalSamples += 1;
    }

    if (totalSamples === 0) {
      state.photoPalette = [];
      state.photoLabel = label || '画稿配钻';
      renderPhotoPaletteResults();
      showToast('未检测到不透明像素，请更换画稿图片');
      return;
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topSum = sorted.reduce((s, [, cnt]) => s + cnt, 0) || 1;
    const byCode = new Map(state.allColors.map((c) => [c.code, c]));

    const items = sorted
      .map(([code, cnt]) => {
        const col = byCode.get(code);
        if (!col) return null;
        const share = cnt / topSum;
        const weightGrams = Math.max(MIN_WEIGHT, Math.round((share * 800) / 100) * 100);
        const item = buildCartItem(col, state.currentShape, weightGrams);
        item.pct = Math.max(1, Math.round((cnt / Math.max(1, totalSamples)) * 100));
        return item;
      })
      .filter(Boolean);

    state.photoPalette = items;
    state.photoLabel = label || '画稿配钻';
    renderPhotoPaletteResults();
  }

  function renderPhotoPaletteResults() {
    const items = state.photoPalette;
    const listEl = document.getElementById('photoPaletteList');
    const lblEl = document.getElementById('photoSummaryLabel');
    const valEl = document.getElementById('photoSummaryVal');
    const commitBtn = document.getElementById('btnPhotoCommitCart');
    const saveBtn = document.getElementById('btnPhotoSaveScheme');
    renderSpectrumSvg('photoSpectrumSvg', 520, items);

    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '';
      if (lblEl) lblEl.textContent = '选择图片或示例画稿开始量化';
      if (valEl) valEl.textContent = '¥0.00';
      if (commitBtn) commitBtn.disabled = true;
      if (saveBtn) saveBtn.disabled = true;
      return;
    }

    const totalW = items.reduce((s, i) => s + i.weightGrams, 0);
    const totalP = items.reduce((s, i) => s + Number(i.subtotal), 0).toFixed(2);
    listEl.innerHTML = items
      .map((item) => {
        const svg = getDrillSvgCached({ hex: item.hex, shape: state.currentShape, rotX: 14, rotY: -16, finish: state.studioFinish, size: 48 });
        return `
          <button class="photo-row" data-photo-code="${item.code}" type="button" title="点击在左侧放大镜检视 #${item.code}">
            <span class="bom-row__left">
              <span class="bom-row__well">${svg}</span>
              <strong>#${item.code}</strong>
              <span class="photo-row__pct">占比 ${item.pct}%</span>
              <span class="photo-row__hex">${item.hex.toUpperCase()}</span>
            </span>
            <span class="photo-row__right">${item.weightGrams}g · ¥${item.subtotal}</span>
          </button>`;
      })
      .join('');

    if (lblEl) lblEl.textContent = `${state.photoLabel} · 提取 ${items.length} 色 · 共 ${totalW}g`;
    if (valEl) valEl.textContent = `¥${totalP}`;
    if (commitBtn) commitBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
  }

  function openPhotoModal() {
    pushModalLayer('photoModalMask', 'btnClosePhotoModal');
    if (!state.photoPalette.length) {
      const canvas = document.getElementById('photoPreviewCanvas');
      paintSampleArtwork(canvas, 'sunset');
      quantizeCanvasToDmc445(canvas, '日落海面');
      document.querySelectorAll('#photoSampleBar .photo-sample-btn').forEach((b) => {
        const on = b.dataset.sample === 'sunset';
        b.classList.toggle('photo-sample-btn--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    } else {
      state.photoPalette = state.photoPalette.map((item) => {
        const updated = buildCartItem(item, state.currentShape, item.weightGrams);
        updated.pct = item.pct;
        return updated;
      });
      renderPhotoPaletteResults();
    }
  }

  function closePhotoModal() {
    popModalLayer('photoModalMask');
  }

  function openBomModal() {
    pushModalLayer('bomModalMask', 'bomTextarea');
    renderBomPreview();
  }

  function closeBomModal() {
    popModalLayer('bomModalMask');
  }

  function renderCalcModal() {
    const c = state.featuredColor || state.allColors[0];
    if (!c) return;
    const isSq = state.currentShape === 'square';
    const pitchMm = isSq ? 2.5 : 2.8;
    const beadsPer100g = isSq ? 19200 : 16500;
    const wCm = Math.max(10, Math.min(400, Number(state.calcWidth) || 40));
    const hCm = Math.max(10, Math.min(400, Number(state.calcHeight) || 50));
    const cov = Math.max(5, Math.min(100, Number(state.calcCoverage) || 100));
    const margin = Math.max(0, Number(state.calcMargin) || 0);

    const cols = Math.round((wCm * 10) / pitchMm);
    const rows = Math.round((hCm * 10) / pitchMm);
    const neededBeads = Math.ceil(cols * rows * (cov / 100) * (1 + margin / 100));
    const recGrams = Math.max(MIN_WEIGHT, Math.ceil(neededBeads / beadsPer100g) * 100);
    state.calcRecommendedGrams = recGrams;
    const estPrice = ((Number(c.price100g || 11.5) * recGrams) / 100).toFixed(2);

    const sub = document.getElementById('calcTargetSub');
    if (sub) sub.textContent = `当前目标色：#${c.code} · ${isSq ? '方钻 (2.5mm 间距)' : '圆钻 (2.8mm 间距)'}`;
    const covVal = document.getElementById('calcCoverageVal');
    if (covVal) covVal.textContent = cov === 100 ? '100% (整幅满钻)' : `${cov}% (单色占比)`;
    const gridEl = document.getElementById('calcGridRes');
    if (gridEl) gridEl.textContent = `${cols} × ${rows} 格`;
    const beadsEl = document.getElementById('calcBeadsOut');
    if (beadsEl) beadsEl.textContent = `${formatBeads(neededBeads)} 颗`;
    const gramsEl = document.getElementById('calcGramsOut');
    if (gramsEl) gramsEl.textContent = `${recGrams}g`;
    const priceEl = document.getElementById('calcPriceOut');
    if (priceEl) priceEl.textContent = `¥${estPrice}`;
    const addBtn = document.getElementById('btnCalcAddCart');
    if (addBtn) addBtn.textContent = `+ ${recGrams}g 加购 #${c.code}`;

    document.querySelectorAll('#calcSizePresets .calc-preset-btn').forEach((btn) => {
      const match = Number(btn.dataset.w) === wCm && Number(btn.dataset.h) === hCm;
      btn.classList.toggle('calc-preset-btn--active', match);
      btn.setAttribute('aria-pressed', String(match));
    });
  }

  function openCalcModal() {
    const wIn = document.getElementById('inputCalcWidth');
    const hIn = document.getElementById('inputCalcHeight');
    state.calcWidth = Math.max(10, Math.min(400, Number(state.calcWidth) || 40));
    state.calcHeight = Math.max(10, Math.min(400, Number(state.calcHeight) || 50));
    if (wIn) wIn.value = String(state.calcWidth);
    if (hIn) hIn.value = String(state.calcHeight);
    renderCalcModal();
    pushModalLayer('calcModalMask', 'inputCalcWidth');
  }

  function closeCalcModal() {
    popModalLayer('calcModalMask');
  }

  function openShortcuts() {
    pushModalLayer('shortcutsModalMask', 'btnCloseShortcuts');
  }

  function closeShortcuts() {
    popModalLayer('shortcutsModalMask');
  }

  function openCartDrawer() {
    renderSchemesStrip();
    pushModalLayer('cartDrawerMask', 'btnCloseCartDrawer');
  }

  function closeCartDrawer(opts) {
    popModalLayer('cartDrawerMask', opts);
  }

  function getReceiptSortedItems() {
    const items = state.cart.slice();
    if (state.receiptSort === 'dmc') {
      items.sort((a, b) => {
        const na = parseInt(String(a.code), 10);
        const nb = parseInt(String(b.code), 10);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return String(a.code).localeCompare(String(b.code));
      });
    }
    return items;
  }

  function renderReceiptContent() {
    const items = getReceiptSortedItems();
    renderSpectrumSvg('receiptSpectrumSvg', 440, items);

    let rCnt = 0;
    let rW = 0;
    let rP = 0;
    let sCnt = 0;
    let sW = 0;
    let sP = 0;
    let totalBeads = 0;
    let checkedCnt = 0;
    items.forEach((i) => {
      totalBeads += i.beads;
      if (state.receiptChecked[i.key]) checkedCnt += 1;
      if (i.shape === 'round') {
        rCnt += 1;
        rW += i.weightGrams;
        rP += Number(i.subtotal);
      } else {
        sCnt += 1;
        sW += i.weightGrams;
        sP += Number(i.subtotal);
      }
    });

    const brEl = document.getElementById('receiptBreakdownStrip');
    if (brEl) {
      const parts = [];
      if (rCnt > 0) parts.push(`圆钻 ${rCnt}款 · ${rW}g (¥${rP.toFixed(2)})`);
      if (sCnt > 0) parts.push(`方钻 ${sCnt}款 · ${sW}g (¥${sP.toFixed(2)})`);
      if (checkedCnt > 0) parts.push(`已核验 ${checkedCnt}/${items.length}`);
      brEl.textContent = parts.join('  |  ') || '暂无明细';
    }

    const listEl = document.getElementById('receiptItemsList');
    if (listEl) {
      listEl.innerHTML = items
        .map((i) => {
          const checked = Boolean(state.receiptChecked[i.key]);
          return `
            <div class="receipt-item ${checked ? 'receipt-item--checked' : ''}">
              <label class="receipt-item__left">
                <input type="checkbox" class="receipt-item__check" data-rcheck="${i.key}" ${checked ? 'checked' : ''} aria-label="标记 #${i.code} 已捡货" />
                <span class="swatch-dot" style="background:${i.hex}"></span>
                <span>#${i.code}</span>
                <span class="receipt-item__meta">${i.shape === 'round' ? '圆钻' : '方钻'}<span class="receipt-item__beads"> · 约${i.beadsText}颗</span></span>
              </label>
              <span class="receipt-item__right">${i.weightGrams}g · ¥${i.subtotal}</span>
            </div>`;
        })
        .join('');
    }

    document.querySelectorAll('#receiptSortToggle .density-btn').forEach((b) => {
      const on = b.dataset.rsort === state.receiptSort;
      b.classList.toggle('density-btn--active', on);
      b.setAttribute('aria-pressed', String(on));
    });

    const totalW = items.reduce((s, i) => s + i.weightGrams, 0);
    const totalP = items.reduce((s, i) => s + Number(i.subtotal), 0).toFixed(2);
    const lbl = document.getElementById('receiptTotalLabel');
    const val = document.getElementById('receiptTotalVal');
    if (lbl) lbl.textContent = `共 ${items.length} 款 · ${totalW}g · 约${formatBeads(totalBeads)}颗`;
    if (val) val.textContent = `¥${totalP}`;
  }

  function openReceipt() {
    if (state.cart.length === 0) {
      showToast('请先加购至少 100g 钻石');
      return;
    }
    const cartMask = document.getElementById('cartDrawerMask');
    renderReceiptContent();
    if (cartMask && !cartMask.hidden) {
      replaceModalLayer('cartDrawerMask', 'receiptModalMask', 'btnCloseReceiptModal');
    } else {
      pushModalLayer('receiptModalMask', 'btnCloseReceiptModal');
    }
  }

  function closeReceipt() {
    popModalLayer('receiptModalMask');
  }

  function bindCanvasDrag(el, ctrl) {
    if (!el || !ctrl) return;
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      ctrl.pointerDown(e.clientX, e.clientY);
      if (typeof el.setPointerCapture === 'function') {
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      ctrl.pointerMove(e.clientX, e.clientY);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      ctrl.pointerUp();
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        ctrl.wheel(e.deltaY);
      },
      { passive: false }
    );
  }

  function bindEvents() {
    // Off-screen Canvas Auto-Pause via IntersectionObserver (HUB-UI M13 Law) + visibilitychange + ResizeObserver cache
    const loupeCanvas = document.getElementById('loupeCanvas3D');
    const studioCanvas = document.getElementById('studioCanvas3D');
    if (loupeCanvas && loupeCtrl && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            loupeIntersecting = Boolean(entry.isIntersecting);
            syncControllerPauseStates();
          });
        },
        { rootMargin: '120px' }
      );
      io.observe(loupeCanvas);
    }
    if (typeof ResizeObserver !== 'undefined') {
      let canvasRoRaf = null;
      const canvasRo = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const targetCanvas = entry.target.tagName === 'CANVAS' ? entry.target : entry.target.querySelector('canvas');
          if (targetCanvas) canvasMetricCache.delete(targetCanvas);
        });
        if (canvasRoRaf !== null) return;
        canvasRoRaf = requestAnimationFrame(() => {
          canvasRoRaf = null;
          paintLoupeFrame();
          if (state.studioOpen) paintStudioFrame();
        });
      });
      if (loupeCanvas) canvasRo.observe(loupeCanvas.parentElement || loupeCanvas);
      if (studioCanvas) canvasRo.observe(studioCanvas.parentElement || studioCanvas);
    }
    document.addEventListener('visibilitychange', () => {
      syncControllerPauseStates();
    });

    // Mode Switcher (Desktop Split Workbench vs 390×844 WeChat Phone Simulator)
    const setGalleryMode = () => {
      document.body.className = 'mode-gallery';
      const gBtn = document.getElementById('btnModeGallery');
      const wBtn = document.getElementById('btnModeWechat');
      gBtn?.classList.add('sim-mode-btn--active');
      gBtn?.setAttribute('aria-pressed', 'true');
      wBtn?.classList.remove('sim-mode-btn--active');
      wBtn?.setAttribute('aria-pressed', 'false');
    };
    document.getElementById('btnModeWechat')?.addEventListener('click', (e) => {
      document.body.className = 'mode-wechat';
      e.currentTarget.classList.add('sim-mode-btn--active');
      e.currentTarget.setAttribute('aria-pressed', 'true');
      const gBtn = document.getElementById('btnModeGallery');
      gBtn?.classList.remove('sim-mode-btn--active');
      gBtn?.setAttribute('aria-pressed', 'false');
      requestAnimationFrame(() => {
        invalidateCanvasMetrics();
        syncShapePill(false);
        paintLoupeFrame();
        if (pathMarqueeCtrl) pathMarqueeCtrl.refreshLayout();
      });
    });
    document.getElementById('btnModeGallery')?.addEventListener('click', () => {
      setGalleryMode();
      requestAnimationFrame(() => {
        invalidateCanvasMetrics();
        syncShapePill(false);
        paintLoupeFrame();
        if (pathMarqueeCtrl) pathMarqueeCtrl.refreshLayout();
      });
    });

    // Inspira Path Marquee Hero Controls (Curve Presets, Shuffle Batch, Guide Track, Pause)
    document.getElementById('marqueeCurvePills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-curve]');
      if (!btn || !pathMarqueeCtrl) return;
      const curve = btn.dataset.curve;
      pathMarqueeCtrl.setPreset(curve);
      document.querySelectorAll('#marqueeCurvePills .marquee-pill').forEach((p) => {
        const on = p === btn;
        p.classList.toggle('marquee-pill--active', on);
        p.setAttribute('aria-pressed', String(on));
      });
    });

    document.getElementById('btnMarqueeShuffle')?.addEventListener('click', () => {
      marqueeWindowOffset += 11;
      syncPathMarqueeItems();
      if (pathMarqueeCtrl) pathMarqueeCtrl.nudge(8);
    });

    document.getElementById('btnMarqueeShowPath')?.addEventListener('click', (e) => {
      if (!pathMarqueeCtrl) return;
      const next = !pathMarqueeCtrl.getState().showPath;
      pathMarqueeCtrl.setShowPath(next);
      e.currentTarget.classList.toggle('marquee-pill--active', next);
      e.currentTarget.setAttribute('aria-pressed', String(next));
    });

    document.getElementById('btnMarqueePause')?.addEventListener('click', (e) => {
      if (!pathMarqueeCtrl) return;
      const paused = pathMarqueeCtrl.togglePause();
      e.currentTarget.classList.toggle('marquee-pill--active', paused);
      e.currentTarget.setAttribute('aria-pressed', String(paused));
      e.currentTarget.textContent = paused ? '继续' : '暂停';
    });

    const syncStickyOffset = () => {
      const topBar = document.getElementById('topBar');
      const navShell = document.querySelector('.nav-shell');
      if (!topBar || !navShell) return;
      const offset = Math.round(topBar.offsetHeight + navShell.offsetHeight + 12);
      document.documentElement.style.setProperty('--sticky-offset', `${offset}px`);
    };
    syncStickyOffset();
    if (typeof ResizeObserver !== 'undefined') {
      let stickyRoRaf = null;
      const stickyRo = new ResizeObserver(() => {
        if (stickyRoRaf !== null) return;
        stickyRoRaf = requestAnimationFrame(() => {
          stickyRoRaf = null;
          syncStickyOffset();
        });
      });
      const topBar = document.getElementById('topBar');
      const navShell = document.querySelector('.nav-shell');
      if (topBar) stickyRo.observe(topBar);
      if (navShell) stickyRo.observe(navShell);
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 1080 && document.body.classList.contains('mode-wechat')) {
        setGalleryMode();
      }
      syncStickyOffset();
      invalidateCanvasMetrics();
      syncShapePill(false);
      paintLoupeFrame();
      if (state.studioOpen) paintStudioFrame();
    });

    // Mobile Loupe Collapse Toggle
    document.getElementById('btnToggleMobileLoupe')?.addEventListener('click', (e) => {
      state.loupeCollapsedMobile = !state.loupeCollapsedMobile;
      const dock = document.getElementById('loupeDock');
      dock?.classList.toggle('loupe-dock--collapsed', state.loupeCollapsedMobile);
      e.currentTarget.setAttribute('aria-expanded', String(!state.loupeCollapsedMobile));
      const span = e.currentTarget.querySelector('span');
      if (span) span.textContent = state.loupeCollapsedMobile ? '展开放大镜' : '收起放大镜';
      if (!state.loupeCollapsedMobile) {
        requestAnimationFrame(() => paintLoupeFrame());
      }
    });

    // Shape Switcher (Click + Roving Arrow Keys)
    const shapeBtns = [document.getElementById('btnShapeRound'), document.getElementById('btnShapeSquare')].filter(Boolean);
    shapeBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => syncShapeUi(btn.dataset.shape));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          const next = shapeBtns[(idx + 1) % shapeBtns.length];
          syncShapeUi(next.dataset.shape);
          next.focus();
        }
      });
    });

    const shapeRow = document.getElementById('shapeSwitchRow');
    if (shapeRow && typeof ResizeObserver !== 'undefined') {
      let shapeRoRaf = null;
      new ResizeObserver(() => {
        if (shapeRoRaf !== null) return;
        shapeRoRaf = requestAnimationFrame(() => {
          shapeRoRaf = null;
          syncShapePill(false);
        });
      }).observe(shapeRow);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => syncShapePill(false));
    }

    // Quick Weight Presets
    document.getElementById('quickWeightBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-weight]');
      if (!btn) return;
      const w = clampWeight(btn.dataset.weight);
      state.quickWeight = w;
      state.loupeWeight = w;
      document.querySelectorAll('#quickWeightBar .weight-chip').forEach((c) => {
        const on = c === btn;
        c.classList.toggle('weight-chip--active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      renderLoupeHeaderAndControls();
      renderCardsGrid();
    });

    // Search & BOM Multi-Code Batch Input
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClearSearch');
    const searchKeycap = document.getElementById('searchKeycap');
    const syncSearchKeycap = () => {
      if (!searchKeycap) return;
      searchKeycap.hidden = Boolean(state.searchQuery) || document.activeElement === searchInput;
    };
    searchInput?.addEventListener('focus', syncSearchKeycap);
    searchInput?.addEventListener('blur', syncSearchKeycap);
    searchInput?.addEventListener('input', () => {
      state.searchQuery = searchInput.value || '';
      if (clearBtn) clearBtn.hidden = !state.searchQuery;
      syncSearchKeycap();
      applyFilters();
    });
    clearBtn?.addEventListener('click', () => {
      state.searchQuery = '';
      if (searchInput) searchInput.value = '';
      clearBtn.hidden = true;
      syncSearchKeycap();
      applyFilters();
    });

    document.getElementById('btnBatchAddMatched')?.addEventListener('click', (e) => {
      const pool = state.filteredColors;
      if (!pool.length) return;
      const snapshot = state.cart.slice();
      const weightByCode = {};
      state.matchedTokens.forEach((tk) => {
        if (tk.weight) weightByCode[tk.code] = tk.weight;
      });
      pool.forEach((c, idx) => {
        const w = weightByCode[c.code.toLowerCase()] || state.quickWeight;
        addItemToCart(c, state.currentShape, w, idx === 0 ? e : null, true);
      });
      showToast(`已批量加购 ${pool.length} 色`, () => updateCartState(snapshot));
    });

    document.getElementById('groupsBar')?.addEventListener('click', (e) => {
      const groupBtn = e.target.closest('[data-group]');
      if (groupBtn) {
        state.activeGroup = groupBtn.dataset.group;
        state.sortBy = 'seq';
        applyFilters();
        return;
      }
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) {
        state.sortBy = state.sortBy === sortBtn.dataset.sort ? 'seq' : sortBtn.dataset.sort;
        applyFilters();
      }
    });

    document.getElementById('rangeJumpRow')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-range]');
      if (!btn) return;
      state.activeRange = btn.dataset.range || 'all';
      document.querySelectorAll('#rangeJumpRow .range-chip').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('range-chip--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      applyFilters();
    });

    // Smart Catalog Sort, Grid Density & Custom Hex/Eyedropper Color Matcher
    document.getElementById('gridDensitySwitch')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-density]');
      if (!btn) return;
      syncGridDensityUi(btn.dataset.density);
    });
    document.getElementById('catalogSortSelect')?.addEventListener('change', (e) => {
      state.catalogSort = e.target.value || 'seq';
      if (state.colorMatchHex) clearColorMatch();
      else applyFilters();
    });
    document.getElementById('inputColorMatch')?.addEventListener('input', (e) => {
      activateColorMatch(e.target.value);
    });
    document.getElementById('inputColorMatch')?.addEventListener('change', (e) => {
      activateColorMatch(e.target.value);
    });
    document.getElementById('inputColorMatchHex')?.addEventListener('input', (e) => {
      const norm = normalizeHexInput(e.target.value);
      if (norm) activateColorMatch(norm);
    });
    document.getElementById('btnClearColorMatch')?.addEventListener('click', clearColorMatch);

    // Loupe Stage Controls
    bindCanvasDrag(document.getElementById('hero3dViewport'), loupeCtrl);
    document.getElementById('btnLoupePrev')?.addEventListener('click', () => stepFeaturedColor(-1));
    document.getElementById('btnLoupeNext')?.addEventListener('click', () => stepFeaturedColor(1));
    document.getElementById('btnHeroRandom')?.addEventListener('click', () => {
      const pool = state.filteredColors.length ? state.filteredColors : state.allColors;
      focusColorInLoupe(pool[Math.floor(Math.random() * pool.length)]);
    });
    document.getElementById('btnHeroStudio')?.addEventListener('click', () => openStudio(state.featuredColor || state.allColors[0]));

    document.getElementById('loupeNeighborsList')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-neighbor]');
      if (!chip) return;
      const color = state.allColors.find((c) => c.code === chip.dataset.neighbor);
      if (!color) return;
      if (state.loupeViewMode === 'compare') {
        state.compareColor = color;
        renderLoupeHeaderAndControls();
        syncFocusedCardInPlace();
      } else {
        focusColorInLoupe(color);
      }
    });

    document.getElementById('loupeRecentList')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-recent]');
      if (!chip) return;
      const color = state.allColors.find((c) => c.code === chip.dataset.recent);
      if (color) focusColorInLoupe(color);
    });

    document.getElementById('btnPickCompareMode')?.addEventListener('click', (e) => {
      state.pickCompareMode = !state.pickCompareMode;
      e.currentTarget.classList.toggle('loupe-compare-swap--active', state.pickCompareMode);
      e.currentTarget.setAttribute('aria-pressed', String(state.pickCompareMode));
      showToast(state.pickCompareMode ? '已开启点选右侧：点击色库任意卡片设为对比色' : '已退出点选右侧模式');
    });

    document.getElementById('btnSwapCompare')?.addEventListener('click', () => {
      if (!state.compareColor || !state.featuredColor) return;
      const prevFeatured = state.featuredColor;
      const nextFeatured = state.compareColor;
      state.compareColor = prevFeatured;
      focusColorInLoupe(nextFeatured);
    });

    // Client-Side Image / Artwork DMC 445 Extractor Events
    document.getElementById('btnOpenPhotoModal')?.addEventListener('click', openPhotoModal);
    document.getElementById('btnClosePhotoModal')?.addEventListener('click', closePhotoModal);
    document.getElementById('photoModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'photoModalMask') closePhotoModal();
    });
    const loadPhotoFile = (file) => {
      if (!file || !file.type.startsWith('image/')) {
        showToast('请选择 PNG / JPG / WebP 图片文件');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('photoPreviewCanvas');
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          document.querySelectorAll('#photoSampleBar .photo-sample-btn').forEach((b) => {
            b.classList.remove('photo-sample-btn--active');
            b.setAttribute('aria-pressed', 'false');
          });
          quantizeCanvasToDmc445(canvas, file.name.slice(0, 14));
          if (state.photoPalette.length) showToast('已完成画稿量化匹配');
        };
        img.onerror = () => {
          showToast('图片解析失败，请更换 PNG / JPG / WebP 文件');
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    };
    document.getElementById('inputPhotoFile')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) loadPhotoFile(e.target.files[0]);
      e.target.value = '';
    });
    const dropzone = document.getElementById('photoDropzone');
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('photo-dropzone--drag');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('photo-dropzone--drag'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('photo-dropzone--drag');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadPhotoFile(e.dataTransfer.files[0]);
      }
    });
    document.getElementById('photoSampleBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sample]');
      if (!btn) return;
      const kind = btn.dataset.sample;
      const canvas = document.getElementById('photoPreviewCanvas');
      paintSampleArtwork(canvas, kind);
      document.querySelectorAll('#photoSampleBar .photo-sample-btn').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('photo-sample-btn--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      quantizeCanvasToDmc445(canvas, btn.textContent.trim());
    });
    document.getElementById('photoPaletteList')?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-photo-code]');
      if (!row) return;
      const col = state.allColors.find((c) => c.code === row.dataset.photoCode);
      if (col) {
        closePhotoModal();
        focusColorInLoupe(col);
      }
    });
    document.getElementById('btnPhotoSaveScheme')?.addEventListener('click', () => {
      if (!state.photoPalette.length) return;
      const totalW = state.photoPalette.reduce((s, i) => s + i.weightGrams, 0);
      const entry = {
        id: `sc_${Date.now()}`,
        name: `${state.photoLabel} · ${state.photoPalette.length}色 ${totalW}g`,
        items: state.photoPalette.map((i) => ({ code: i.code, shape: i.shape, weightGrams: i.weightGrams }))
      };
      state.schemes = [entry, ...state.schemes].slice(0, 8);
      persistSchemes();
      renderSchemesStrip();
      showToast(`已存为方案：${entry.name}`);
    });
    document.getElementById('btnPhotoCommitCart')?.addEventListener('click', (e) => {
      if (!state.photoPalette.length) return;
      const snapshot = state.cart.slice();
      const totalW = state.photoPalette.reduce((s, i) => s + i.weightGrams, 0);
      state.photoPalette.forEach((item, idx) => {
        const col = state.allColors.find((c) => c.code === item.code);
        if (col) addItemToCart(col, state.currentShape, item.weightGrams, idx === 0 ? e : null, true);
      });
      const cnt = state.photoPalette.length;
      closePhotoModal();
      showToast(`已导入画稿 ${cnt} 色 · 共 ${totalW}g`, () => updateCartState(snapshot));
    });

    // Smart BOM Importer Modal Events
    document.getElementById('btnOpenBomModal')?.addEventListener('click', openBomModal);
    document.getElementById('btnCloseBomModal')?.addEventListener('click', closeBomModal);
    document.getElementById('bomModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'bomModalMask') closeBomModal();
    });
    document.getElementById('bomTextarea')?.addEventListener('input', renderBomPreview);
    document.getElementById('btnBomFillSample')?.addEventListener('click', () => {
      const ta = document.getElementById('bomTextarea');
      if (ta) {
        ta.value = '310 500g\n5200:300\n#666 x 200\n798, 200';
        renderBomPreview();
      }
    });
    document.getElementById('btnBomClear')?.addEventListener('click', () => {
      const ta = document.getElementById('bomTextarea');
      if (ta) {
        ta.value = '';
        renderBomPreview();
        ta.focus();
      }
    });
    document.getElementById('btnBomCommit')?.addEventListener('click', (e) => {
      if (!state.bomParsed.length) return;
      const snapshot = state.cart.slice();
      const totalW = state.bomParsed.reduce((s, i) => s + i.weightGrams, 0);
      state.bomParsed.forEach((item, idx) => {
        const col = state.allColors.find((c) => c.code === item.code);
        if (col) addItemToCart(col, state.currentShape, item.weightGrams, idx === 0 ? e : null, true);
      });
      const cnt = state.bomParsed.length;
      closeBomModal();
      showToast(`已导入 ${cnt} 色 · 共 ${totalW}g`, () => updateCartState(snapshot));
    });

    document.getElementById('loupeViewPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      state.loupeViewMode = btn.dataset.view || 'single';
      document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('studio-hud-pill--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      renderLoupeHeaderAndControls();
      syncFocusedCardInPlace();
    });
    document.getElementById('loupeMatrixPatternPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mpat]');
      if (!btn) return;
      state.matrixPattern = btn.dataset.mpat || 'solid';
      renderLoupeHeaderAndControls();
      if (state.studioOpen) renderStudio();
    });
    document.getElementById('studioMatrixPatternPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mpat]');
      if (!btn) return;
      state.matrixPattern = btn.dataset.mpat || 'solid';
      renderLoupeHeaderAndControls();
      renderStudio();
    });
    document.getElementById('loupeBgDots')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bg]');
      if (!btn) return;
      state.studioBoardBg = btn.dataset.bg;
      renderLoupeHeaderAndControls();
    });
    document.getElementById('heroFinishPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-finish]');
      if (!btn) return;
      syncFinishUi(btn.dataset.finish);
    });
    document.getElementById('loupeLightFxPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fx]');
      if (!btn) return;
      state.loupeLightFx = btn.dataset.fx || 'none';
      document.querySelectorAll('#loupeLightFxPills .studio-hud-pill').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('studio-hud-pill--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (loupeCtrl) loupeCtrl.setLightFx(state.loupeLightFx);
    });
    document.getElementById('btnLoupeSymbol')?.addEventListener('click', () => {
      state.loupeSymbolMode = !state.loupeSymbolMode;
      renderLoupeHeaderAndControls();
    });
    document.getElementById('btnLoupeAutoSpin')?.addEventListener('click', (e) => {
      if (isReducedMotion()) {
        showToast('已启用减弱动态效果，已跳过自动旋转动画');
        return;
      }
      state.loupeAutoSpin = !state.loupeAutoSpin;
      e.currentTarget.classList.toggle('studio-stage__spin--active', state.loupeAutoSpin);
      e.currentTarget.setAttribute('aria-pressed', String(state.loupeAutoSpin));
      if (loupeCtrl) loupeCtrl.setAutoSpin(state.loupeAutoSpin);
    });
    document.getElementById('btnLoupeReset')?.addEventListener('click', () => {
      if (loupeCtrl) loupeCtrl.reset();
    });

    document.getElementById('loupeWeightBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-weight]');
      if (!btn) return;
      state.loupeWeight = clampWeight(btn.dataset.weight);
      renderLoupeHeaderAndControls();
    });
    document.getElementById('btnLoupeMinus')?.addEventListener('click', () => {
      if (state.loupeWeight <= MIN_WEIGHT) {
        showToast('单款最低 100g 起购');
        return;
      }
      state.loupeWeight = clampWeight(state.loupeWeight - STEP_WEIGHT);
      renderLoupeHeaderAndControls();
    });
    document.getElementById('btnLoupePlus')?.addEventListener('click', () => {
      state.loupeWeight = clampWeight(state.loupeWeight + STEP_WEIGHT);
      renderLoupeHeaderAndControls();
    });
    document.getElementById('inputLoupeWeight')?.addEventListener('change', (e) => {
      const raw = Number(e.target.value);
      if (raw < MIN_WEIGHT) showToast('低于 100g 已自动纠正为 100g');
      state.loupeWeight = clampWeight(raw);
      renderLoupeHeaderAndControls();
    });
    document.getElementById('btnHeroQuickAdd')?.addEventListener('click', (e) => {
      addItemToCart(state.featuredColor || state.allColors[0], state.currentShape, state.loupeWeight, e);
    });

    // Swatch Cards Grid Events (Click ANYWHERE on card focuses in Loupe; targeted in-place patch!)
    const cardsGridEl = document.getElementById('cardsGrid');
    cardsGridEl?.addEventListener('click', (e) => {
      if (e.target.closest('#btnResetEmptyFilter')) {
        state.activeGroup = 'ALL';
        state.activeRange = 'all';
        state.sortBy = 'seq';
        state.catalogSort = 'seq';
        state.colorMatchHex = null;
        state.matchDeltaMap = {};
        state.searchQuery = '';
        const sortSel = document.getElementById('catalogSortSelect');
        if (sortSel) sortSel.value = 'seq';
        syncColorMatchUi();
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.hidden = true;
        document.querySelectorAll('#rangeJumpRow .range-chip').forEach((b) => {
          const on = b.dataset.range === 'all';
          b.classList.toggle('range-chip--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        applyFilters();
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      const cardEl = e.target.closest('.gradient-card[data-code]');
      const code = actionEl ? actionEl.dataset.code : cardEl ? cardEl.dataset.code : null;
      if (!code) return;
      const color = state.allColors.find((c) => c.code === code);
      if (!color) return;

      const act = actionEl ? actionEl.dataset.action : 'focus';
      if (act === 'fav') {
        state.favMap[code] = !state.favMap[code];
        persistState();
        renderGroupsBar();
        if (state.sortBy === 'fav') applyFilters();
        else patchSingleCardInPlace(code);
      } else if (act === 'add') {
        addItemToCart(color, state.currentShape, state.quickWeight, e);
      } else if (act === 'card-plus') {
        adjustCartWeight(color, state.currentShape, STEP_WEIGHT);
      } else if (act === 'card-minus') {
        adjustCartWeight(color, state.currentShape, -STEP_WEIGHT);
      } else if (e.shiftKey || (state.loupeViewMode === 'compare' && state.pickCompareMode)) {
        setCompareColor(color);
      } else {
        focusColorInLoupe(color);
      }
    });
    cardsGridEl?.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('gradient-card')) {
        e.preventDefault();
        e.stopPropagation();
        const color = state.allColors.find((c) => c.code === e.target.dataset.code);
        if (!color) return;
        if (e.shiftKey || (state.loupeViewMode === 'compare' && state.pickCompareMode)) {
          setCompareColor(color);
        } else {
          focusColorInLoupe(color);
        }
      }
    });
    cardsGridEl?.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.gradient-card[data-code]');
      if (!card || e.target.closest('button')) return;
      const color = state.allColors.find((c) => c.code === card.dataset.code);
      if (color) openStudio(color);
    });

    // Studio Modal Events
    bindCanvasDrag(document.getElementById('studioStage'), studioCtrl);
    document.getElementById('btnStudioPrev')?.addEventListener('click', () => stepStudioColor(-1));
    document.getElementById('btnStudioNext')?.addEventListener('click', () => stepStudioColor(1));
    document.getElementById('btnStudioRandom')?.addEventListener('click', () => {
      const pool = state.filteredColors.length ? state.filteredColors : state.allColors;
      openStudio(pool[Math.floor(Math.random() * pool.length)]);
    });
    document.getElementById('btnResetStudioAngle')?.addEventListener('click', () => {
      if (studioCtrl) studioCtrl.reset();
    });
    document.getElementById('btnStudioSweep')?.addEventListener('click', (e) => {
      if (isReducedMotion()) {
        showToast('已启用减弱动态效果，已跳过自动扫光动画');
        return;
      }
      state.studioSweeping = true;
      e.currentTarget.classList.add('studio-stage__spin--active');
      e.currentTarget.setAttribute('aria-pressed', 'true');
      if (studioCtrl) studioCtrl.triggerSweep();
    });
    document.getElementById('btnStudioAutoSpin')?.addEventListener('click', (e) => {
      if (isReducedMotion()) {
        showToast('已启用减弱动态效果，已跳过自动旋转动画');
        return;
      }
      state.studioAutoSpin = !state.studioAutoSpin;
      e.currentTarget.classList.toggle('studio-stage__spin--active', state.studioAutoSpin);
      e.currentTarget.setAttribute('aria-pressed', String(state.studioAutoSpin));
      if (studioCtrl) studioCtrl.setAutoSpin(state.studioAutoSpin);
    });
    document.getElementById('btnCloseStudio')?.addEventListener('click', closeStudio);
    document.getElementById('studioModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'studioModalMask') closeStudio();
    });
    document.getElementById('studioViewModePills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      state.studioViewMode = btn.dataset.mode;
      document.querySelectorAll('#studioViewModePills .studio-hud-pill').forEach((b) => {
        b.classList.toggle('studio-hud-pill--active', b.dataset.mode === state.studioViewMode);
      });
      renderStudio();
    });
    document.getElementById('studioBgDots')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bg]');
      if (!btn) return;
      state.studioBoardBg = btn.dataset.bg;
      renderStudio();
      renderLoupeHeaderAndControls();
    });
    document.getElementById('studioLightFxPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fx]');
      if (!btn) return;
      state.studioLightFx = btn.dataset.fx || 'none';
      if (studioCtrl) studioCtrl.setLightFx(state.studioLightFx);
      renderStudio();
    });
    document.getElementById('btnStudioSwapCompare')?.addEventListener('click', () => {
      if (!state.compareColor || !state.studioColor) return;
      const prev = state.studioColor;
      const next = state.compareColor;
      state.compareColor = prev;
      openStudio(next);
    });
    document.getElementById('btnStudioExportPng')?.addEventListener('click', () => {
      exportStudioSwatchCardPng(state.studioColor || state.featuredColor);
    });
    document.getElementById('btnCloseSwatchCard')?.addEventListener('click', closeSwatchCardModal);
    document.getElementById('swatchCardModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'swatchCardModalMask') closeSwatchCardModal();
    });
    document.getElementById('btnDownloadSwatchPng')?.addEventListener('click', () => {
      if (!state.swatchCardDataUrl) return;
      const a = document.createElement('a');
      a.href = state.swatchCardDataUrl;
      a.download = state.swatchCardFilename || 'dmc-swatch-card.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('已下载高清 PNG 色卡');
    });
    document.getElementById('btnCopySwatchImg')?.addEventListener('click', async () => {
      if (!state.swatchCardDataUrl) return;
      try {
        const res = await fetch(state.swatchCardDataUrl);
        const blob = await res.blob();
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          showToast('已复制色卡图片到剪贴板');
          return;
        }
      } catch (err) {
        /* fallback */
      }
      showToast('当前浏览器不支持复制图片，请点击下载 PNG');
    });
    document.getElementById('btnStudioSymbolMode')?.addEventListener('click', () => {
      state.studioSymbolMode = !state.studioSymbolMode;
      renderStudio();
    });
    document.getElementById('studioFinishPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-finish]');
      if (!btn) return;
      syncFinishUi(btn.dataset.finish);
    });
    document.getElementById('btnStudioShapeRound')?.addEventListener('click', () => syncShapeUi('round'));
    document.getElementById('btnStudioShapeSquare')?.addEventListener('click', () => syncShapeUi('square'));
    document.getElementById('studioWeightPresets')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-weight]');
      if (!btn) return;
      state.studioWeight = clampWeight(btn.dataset.weight);
      renderStudio();
    });
    document.getElementById('btnStudioMinus')?.addEventListener('click', () => {
      if (state.studioWeight <= MIN_WEIGHT) {
        showToast('单款最低 100g 起购');
        return;
      }
      state.studioWeight = clampWeight(state.studioWeight - STEP_WEIGHT);
      renderStudio();
    });
    document.getElementById('btnStudioPlus')?.addEventListener('click', () => {
      state.studioWeight = clampWeight(state.studioWeight + STEP_WEIGHT);
      renderStudio();
    });
    document.getElementById('inputStudioWeight')?.addEventListener('change', (e) => {
      const raw = Number(e.target.value);
      if (raw < MIN_WEIGHT) showToast('低于 100g 已自动纠正为 100g');
      state.studioWeight = clampWeight(raw);
      renderStudio();
    });
    document.getElementById('btnConfirmStudioAdd')?.addEventListener('click', (e) => {
      addItemToCart(state.studioColor, state.studioShape, state.studioWeight, e);
      closeStudio();
    });

    // Cart Dock & Drawer Events
    document.getElementById('cartDockToggle')?.addEventListener('click', openCartDrawer);
    document.getElementById('btnDockOpenBrief')?.addEventListener('click', openCartDrawer);
    document.getElementById('btnCloseCartDrawer')?.addEventListener('click', closeCartDrawer);
    document.getElementById('cartDrawerMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'cartDrawerMask') closeCartDrawer();
    });
    document.getElementById('cartListContainer')?.addEventListener('click', (e) => {
      const el = e.target.closest('[data-cart-action]');
      if (!el) return;
      const act = el.dataset.cartAction;
      const key = el.dataset.key;
      const code = el.dataset.code;
      if (act === 'inspect') {
        const col = state.allColors.find((c) => c.code === code);
        if (col) {
          const anchor = getModalReturnFocusAnchor('cartDrawerMask');
          closeCartDrawer({ skipFocus: true });
          const lenBefore = modalStack.length;
          openStudio(col);
          if (modalStack.length > lenBefore) {
            const top = modalStack[modalStack.length - 1];
            if (top && top.id === 'studioModalMask' && anchor) top.returnFocus = anchor;
          } else {
            requestAnimationFrame(() => document.getElementById('btnCloseStudio')?.focus({ preventScroll: true }));
          }
        }
      } else if (act === 'plus') {
        const item = state.cart.find((i) => i.key === key);
        updateCartState(
          state.cart.map((i) => (i.key === key ? buildCartItem(i, i.shape, i.weightGrams + STEP_WEIGHT) : i)),
          item ? [item.code] : undefined
        );
      } else if (act === 'minus') {
        const target = state.cart.find((i) => i.key === key);
        if (target && target.weightGrams <= MIN_WEIGHT) {
          showToast('单款最低 100g 起购');
          return;
        }
        updateCartState(
          state.cart.map((i) => (i.key === key ? buildCartItem(i, i.shape, i.weightGrams - STEP_WEIGHT) : i)),
          target ? [target.code] : undefined
        );
      } else if (act === 'del') {
        const snapshot = state.cart.slice();
        const removed = state.cart.find((i) => i.key === key);
        updateCartState(
          state.cart.filter((i) => i.key !== key),
          removed ? [removed.code] : undefined
        );
        if (removed) {
          showToast(`已移除 #${removed.code}`, () => updateCartState(snapshot));
        }
      } else if (act === 'flip') {
        const idx = state.cart.findIndex((i) => i.key === key);
        if (idx >= 0) {
          const cur = state.cart[idx];
          const nextShape = cur.shape === 'round' ? 'square' : 'round';
          const nextKey = `${cur.code}_${nextShape}`;
          const existingIdx = state.cart.findIndex((i, k) => k !== idx && i.key === nextKey);
          const next = state.cart.slice();
          if (existingIdx >= 0) {
            next[existingIdx] = buildCartItem(next[existingIdx], nextShape, next[existingIdx].weightGrams + cur.weightGrams);
            next.splice(idx, 1);
            updateCartState(next, [cur.code]);
            showToast(`已合并 #${cur.code} ${nextShape === 'round' ? '圆钻' : '方钻'} 克重`);
          } else {
            next[idx] = buildCartItem(cur, nextShape, cur.weightGrams);
            updateCartState(next, [cur.code]);
          }
        }
      }
    });

    // Shortcuts Modal, Canvas Calculator & Saved Schemes Events
    document.getElementById('btnOpenCalc')?.addEventListener('click', openCalcModal);
    document.getElementById('btnCloseCalc')?.addEventListener('click', closeCalcModal);
    document.getElementById('calcModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'calcModalMask') closeCalcModal();
    });
    document.getElementById('calcSizePresets')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-w][data-h]');
      if (!btn) return;
      state.calcWidth = Number(btn.dataset.w) || 40;
      state.calcHeight = Number(btn.dataset.h) || 50;
      const wIn = document.getElementById('inputCalcWidth');
      const hIn = document.getElementById('inputCalcHeight');
      if (wIn) wIn.value = String(state.calcWidth);
      if (hIn) hIn.value = String(state.calcHeight);
      renderCalcModal();
    });
    const clampCalcDimInput = (el, key, fallback) => {
      const clamped = Math.max(10, Math.min(400, Number(el.value) || fallback));
      state[key] = clamped;
      el.value = String(clamped);
      renderCalcModal();
    };
    const calcWIn = document.getElementById('inputCalcWidth');
    const calcHIn = document.getElementById('inputCalcHeight');
    calcWIn?.addEventListener('input', (e) => {
      state.calcWidth = Number(e.target.value) || 40;
      renderCalcModal();
    });
    calcWIn?.addEventListener('change', (e) => clampCalcDimInput(e.target, 'calcWidth', 40));
    calcHIn?.addEventListener('input', (e) => {
      state.calcHeight = Number(e.target.value) || 50;
      renderCalcModal();
    });
    calcHIn?.addEventListener('change', (e) => clampCalcDimInput(e.target, 'calcHeight', 50));
    document.getElementById('selectCalcMargin')?.addEventListener('change', (e) => {
      state.calcMargin = Number(e.target.value) || 0;
      renderCalcModal();
    });
    document.getElementById('inputCalcCoverage')?.addEventListener('input', (e) => {
      state.calcCoverage = Number(e.target.value) || 100;
      renderCalcModal();
    });
    document.getElementById('btnCalcApplyLoupe')?.addEventListener('click', () => {
      state.loupeWeight = clampWeight(state.calcRecommendedGrams);
      closeCalcModal();
      renderLoupeHeaderAndControls();
      showToast(`放大镜克重已设为 ${state.loupeWeight}g`);
    });
    document.getElementById('btnCalcAddCart')?.addEventListener('click', (e) => {
      const c = state.featuredColor || state.allColors[0];
      if (!c) return;
      const snapshot = state.cart.slice();
      const w = clampWeight(state.calcRecommendedGrams);
      addItemToCart(c, state.currentShape, w, e, true);
      closeCalcModal();
      showToast(`已按画布估算加购 #${c.code} · ${w}g`, () => updateCartState(snapshot));
    });

    document.getElementById('btnOpenShortcuts')?.addEventListener('click', openShortcuts);
    document.getElementById('btnCloseShortcuts')?.addEventListener('click', closeShortcuts);
    document.getElementById('shortcutsModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'shortcutsModalMask') closeShortcuts();
    });
    document.getElementById('btnSaveScheme')?.addEventListener('click', saveCurrentScheme);
    document.getElementById('cartSchemesList')?.addEventListener('click', (e) => {
      const loadBtn = e.target.closest('[data-scheme-load]');
      if (loadBtn) {
        const sc = state.schemes.find((x) => x.id === loadBtn.dataset.schemeLoad);
        if (!sc) return;
        const snapshot = state.cart.slice();
        const loaded = (Array.isArray(sc.items) ? sc.items : [])
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => {
            const col = state.allColors.find((c) => c.code === entry.code);
            return col ? buildCartItem(col, entry.shape, entry.weightGrams) : null;
          })
          .filter(Boolean);
        updateCartState(loaded);
        showToast(`已载入 ${sc.name}`, () => updateCartState(snapshot));
        return;
      }
      const delBtn = e.target.closest('[data-scheme-del]');
      if (delBtn) {
        const idx = state.schemes.findIndex((x) => x.id === delBtn.dataset.schemeDel);
        if (idx < 0) return;
        const removed = state.schemes[idx];
        const prevSchemes = state.schemes.slice();
        state.schemes = state.schemes.filter((x) => x.id !== removed.id);
        persistSchemes();
        renderSchemesStrip();
        showToast(`已删除 ${removed.name}`, () => {
          state.schemes = prevSchemes;
          persistSchemes();
          renderSchemesStrip();
        });
      }
    });

    document.getElementById('btnCartBatchPlus100g')?.addEventListener('click', () => {
      if (!state.cart.length) return;
      const snapshot = state.cart.slice();
      updateCartState(state.cart.map((i) => buildCartItem(i, i.shape, i.weightGrams + STEP_WEIGHT)));
      showToast('全车每色已 +100g', () => updateCartState(snapshot));
    });
    // HUB-UI v4.0 Bonfire 700ms Hold-to-Clear-Cart Safety Detent (120ms reduced-motion)
    const clearCartBtn = document.getElementById('btnClearCart');
    const clearCartArc = document.getElementById('clearCartArc');
    if (clearCartBtn && clearCartArc) {
      const CIRC = 2 * Math.PI * 6.5;
      let holdRaf = null;
      let holdStart = 0;

      const cancelClearHold = () => {
        if (holdRaf) {
          cancelAnimationFrame(holdRaf);
          holdRaf = null;
        }
        clearCartArc.style.strokeDashoffset = String(CIRC);
      };

      const executeClearCart = () => {
        cancelClearHold();
        if (!state.cart.length) return;
        const snapshot = state.cart.slice();
        state.receiptChecked = {};
        updateCartState([]);
        showToast('已清空购物车', () => updateCartState(snapshot));
      };

      const startClearHold = () => {
        if (!state.cart.length) {
          showToast('购物车已是空的');
          return;
        }
        cancelClearHold();
        const duration = isReducedMotion() ? 120 : 700;
        holdStart = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - holdStart) / duration);
          clearCartArc.style.strokeDashoffset = String(CIRC * (1 - p));
          if (p >= 1) {
            executeClearCart();
            return;
          }
          holdRaf = requestAnimationFrame(step);
        };
        holdRaf = requestAnimationFrame(step);
      };

      clearCartBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        startClearHold();
      });
      clearCartBtn.addEventListener('pointerup', cancelClearHold);
      clearCartBtn.addEventListener('pointerleave', cancelClearHold);
      clearCartBtn.addEventListener('pointercancel', cancelClearHold);
      clearCartBtn.addEventListener('blur', cancelClearHold);
      clearCartBtn.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          startClearHold();
        }
      });
      clearCartBtn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') cancelClearHold();
      });
    }

    // Receipt Modal Events
    document.getElementById('btnDockCheckout')?.addEventListener('click', openReceipt);
    document.getElementById('btnCartCheckout')?.addEventListener('click', openReceipt);
    document.getElementById('btnCloseReceiptModal')?.addEventListener('click', closeReceipt);
    document.getElementById('receiptModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'receiptModalMask') closeReceipt();
    });
    document.getElementById('receiptSortToggle')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rsort]');
      if (!btn) return;
      state.receiptSort = btn.dataset.rsort === 'dmc' ? 'dmc' : 'cart';
      renderReceiptContent();
    });
    document.getElementById('receiptItemsList')?.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-rcheck]');
      if (!cb) return;
      state.receiptChecked[cb.dataset.rcheck] = cb.checked;
      renderReceiptContent();
    });
    let copyReceiptTimer = null;
    document.getElementById('btnCopyReceipt')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const items = getReceiptSortedItems();
      const text = items.map((i) => `#${i.code}\t${i.shape === 'round' ? '圆钻' : '方钻'}\t${i.weightGrams}g\t¥${i.subtotal}`).join('\n');
      const ok = await copyTextReliable(text);
      if (!ok) {
        showToast('复制失败，请手动选中或导出 CSV');
        return;
      }
      btn.textContent = '已复制';
      clearTimeout(copyReceiptTimer);
      copyReceiptTimer = setTimeout(() => {
        btn.textContent = '复制文本';
      }, 1600);
      showToast('已复制文本配钻清单');
    });
    let copyMdTimer = null;
    document.getElementById('btnCopyReceiptMd')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const items = getReceiptSortedItems();
      const totalW = items.reduce((s, i) => s + i.weightGrams, 0);
      const totalP = items.reduce((s, i) => s + Number(i.subtotal), 0).toFixed(2);
      const md = [
        '| DMC 色号 | 钻型 | 克重 | 约颗数 | 小计 |',
        '| --- | --- | ---: | ---: | ---: |',
        ...items.map((i) => `| #${i.code} (\`${i.hex.toUpperCase()}\`) | ${i.shape === 'round' ? '圆钻' : '方钻'} | ${i.weightGrams}g | ${i.beadsText} | ¥${i.subtotal} |`),
        `| **合计 (${items.length}款)** | — | **${totalW}g** | — | **¥${totalP}** |`
      ].join('\n');
      const ok = await copyTextReliable(md);
      if (!ok) {
        showToast('复制失败，请使用导出 CSV');
        return;
      }
      btn.textContent = '已复制 MD';
      clearTimeout(copyMdTimer);
      copyMdTimer = setTimeout(() => {
        btn.textContent = '复制 MD';
      }, 1600);
      showToast('已复制 Markdown 配钻表格');
    });
    document.getElementById('btnPrintReceipt')?.addEventListener('click', () => {
      window.print();
    });
    document.getElementById('btnExportCsv')?.addEventListener('click', () => {
      const items = getReceiptSortedItems();
      const header = 'DMC_Code,Hex,Shape,Weight_g,Estimated_Beads,Subtotal_CNY\n';
      const rows = items.map((i) => `${i.code},${i.hex},${i.shape},${i.weightGrams},${i.beads},${i.subtotal}`).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dmc-445-bom-${state.cart.length}colors.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('已导出 CSV 配钻表');
    });
    document.getElementById('btnConfirmReceiptPay')?.addEventListener('click', () => {
      state.receiptChecked = {};
      closeReceipt();
      showToast('配钻清单已提交');
    });

    // Toast Undo & Hover/Focus Pause
    const toastEl = document.getElementById('wxToast');
    document.getElementById('btnToastUndo')?.addEventListener('click', () => {
      const cb = toastUndoCb;
      closeToast();
      if (cb) cb();
    });
    toastEl?.addEventListener('mouseenter', () => clearTimeout(toastTimer));
    toastEl?.addEventListener('focusin', () => clearTimeout(toastTimer));
    toastEl?.addEventListener('mouseleave', () => {
      if (toastEl.classList.contains('wx-toast--open')) scheduleToastClose(2200);
    });

    // ⌘K Command Palette Events
    document.getElementById('btnOpenCmdk')?.addEventListener('click', openCmdk);
    document.getElementById('cmdkModalMask')?.addEventListener('click', (e) => {
      if (e.target.id === 'cmdkModalMask') closeCmdk();
    });
    const cmdkInput = document.getElementById('cmdkInput');
    cmdkInput?.addEventListener('input', () => {
      state.cmdkIndex = 0;
      state.cmdkItems = buildCmdkItems(cmdkInput.value);
      renderCmdkList();
    });
    const executeCmdkItem = (chosen) => {
      const anchor = getModalReturnFocusAnchor('cmdkModalMask');
      closeCmdk({ skipFocus: true });
      const lenBefore = modalStack.length;
      if (chosen && chosen.run) chosen.run();
      if (modalStack.length > lenBefore) {
        const top = modalStack[modalStack.length - 1];
        if (top && anchor) top.returnFocus = anchor;
      } else if (anchor && document.contains(anchor) && !anchor.closest('[hidden],[inert]')) {
        requestAnimationFrame(() => requestAnimationFrame(() => anchor.focus({ preventScroll: true })));
      } else {
        const topMask = getTopModalMask();
        if (topMask) {
          const firstFoc = topMask.querySelector('button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), [tabindex="0"]');
          requestAnimationFrame(() => firstFoc?.focus({ preventScroll: true }));
        }
      }
    };
    cmdkInput?.addEventListener('keydown', (e) => {
      if (!state.cmdkItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        syncCmdkActiveInPlace(state.cmdkIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        syncCmdkActiveInPlace(state.cmdkIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        syncCmdkActiveInPlace(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        syncCmdkActiveInPlace(state.cmdkItems.length - 1);
      } else if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        suppressCmdkTriggerUntil = performance.now() + 250;
        executeCmdkItem(state.cmdkItems[state.cmdkIndex]);
      }
    });
    const cmdkList = document.getElementById('cmdkListbox');
    cmdkList?.addEventListener('mousemove', (e) => {
      const opt = e.target.closest('[data-cmdk-idx]');
      if (!opt) return;
      const idx = Number(opt.dataset.cmdkIdx);
      if (idx !== state.cmdkIndex) syncCmdkActiveInPlace(idx);
    });
    cmdkList?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-cmdk-idx]');
      if (!opt) return;
      executeCmdkItem(state.cmdkItems[Number(opt.dataset.cmdkIdx)]);
    });

    // Global Keyboard Shortcuts, Unified Modal Escape & Universal Dialog Tab Focus Trap
    const modalCloserMap = {
      cmdkModalMask: () => closeCmdk(),
      swatchCardModalMask: () => closeSwatchCardModal(),
      shortcutsModalMask: () => closeShortcuts(),
      calcModalMask: () => closeCalcModal(),
      bomModalMask: () => closeBomModal(),
      photoModalMask: () => closePhotoModal(),
      receiptModalMask: () => closeReceipt(),
      cartDrawerMask: () => closeCartDrawer(),
      studioModalMask: () => closeStudio()
    };

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (state.cmdkOpen) closeCmdk();
        else openCmdk();
        return;
      }

      if (e.key === 'Escape') {
        if (modalStack.length > 0) {
          e.preventDefault();
          const topId = modalStack[modalStack.length - 1].id;
          const closer = modalCloserMap[topId];
          if (closer) closer();
          else popModalLayer(topId);
          return;
        }
        if (document.activeElement === searchInput || state.searchQuery) {
          state.searchQuery = '';
          if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
          }
          if (clearBtn) clearBtn.hidden = true;
          syncSearchKeycap();
          applyFilters();
          return;
        }
        if (state.colorMatchHex) {
          clearColorMatch();
        }
        return;
      }

      // Universal Tab / Shift+Tab Focus Trap for ALL open aria-modal dialogs
      if (e.key === 'Tab' && modalStack.length > 0) {
        if (state.cmdkOpen) {
          e.preventDefault();
          document.getElementById('cmdkInput')?.focus();
          return;
        }
        const topMask = getTopModalMask();
        if (topMask) {
          const focusables = Array.from(
            topMask.querySelectorAll('a[href], button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])')
          ).filter((el) => el.offsetParent !== null);
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && (document.activeElement === first || !topMask.contains(document.activeElement))) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !topMask.contains(document.activeElement))) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }

      // Allow '?' to toggle Shortcuts Modal only when it is top-of-stack or no modal is open
      const tag = (e.target && e.target.tagName) || '';
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(e.target && e.target.isContentEditable);
      if (e.key === '?' && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const topId = modalStack.length ? modalStack[modalStack.length - 1].id : null;
        if (topId === 'shortcutsModalMask') {
          e.preventDefault();
          closeShortcuts();
          return;
        }
        if (!hasOpenModal()) {
          e.preventDefault();
          openShortcuts();
          return;
        }
      }

      if (e.defaultPrevented || hasOpenModal()) return;
      if (isEditable || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInput?.focus();
        searchInput?.select?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFeaturedColor(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFeaturedColor(1);
      } else if (e.key === 'r' || e.key === 'R') {
        syncShapeUi('round');
      } else if (e.key === 's' || e.key === 'S') {
        syncShapeUi('square');
      } else if (e.key === 'a' || e.key === 'A') {
        addItemToCart(state.featuredColor || state.allColors[0], state.currentShape, state.loupeWeight, null);
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        openCalcModal();
      } else if (e.key === 'c' || e.key === 'C') {
        const nextView = state.loupeViewMode === 'compare' ? 'single' : 'compare';
        state.loupeViewMode = nextView;
        document.querySelectorAll('#loupeViewPills .studio-hud-pill').forEach((b) => {
          const on = b.dataset.view === nextView;
          b.classList.toggle('studio-hud-pill--active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderLoupeHeaderAndControls();
        syncFocusedCardInPlace();
      } else if (e.key === ' ') {
        const interactiveTarget = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('button, a, select, .gradient-card, [role="button"], [role="tab"]')
          : null;
        if (interactiveTarget) return;
        e.preventDefault();
        document.getElementById('btnLoupeAutoSpin')?.click();
      } else if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1;
        if (FINISH_KEYS[idx]) syncFinishUi(FINISH_KEYS[idx]);
      }
    });
  }

  function init() {
    hydrateIcons();
    const validCodes = new Set(state.allColors.map((c) => c.code));
    state.schemes = loadSavedSchemes();
    const saved = loadPersistedState();
    if (saved) {
      if (saved.shape === 'round' || saved.shape === 'square') {
        state.currentShape = saved.shape;
        state.studioShape = saved.shape;
      }
      if (FINISH_KEYS.includes(saved.finish)) state.studioFinish = saved.finish;
      if (['comfort', 'compact', 'list'].includes(saved.gridDensity)) state.gridDensity = saved.gridDensity;
      if (saved.favMap && typeof saved.favMap === 'object' && !Array.isArray(saved.favMap)) {
        const cleanFav = {};
        Object.keys(saved.favMap).forEach((k) => {
          if (saved.favMap[k] === true && validCodes.has(k)) cleanFav[k] = true;
        });
        state.favMap = cleanFav;
      }
      if (Array.isArray(saved.recentCodes)) {
        state.recentCodes = saved.recentCodes.filter((k) => typeof k === 'string' && validCodes.has(k)).slice(0, 6);
      }
    }

    state.featuredColor = state.allColors.find((c) => c.code === '150') || state.allColors[0];

    let initialCart = null;
    if (saved && Array.isArray(saved.cart)) {
      const dedup = new Map();
      saved.cart.forEach((entry) => {
        if (!entry || typeof entry !== 'object' || typeof entry.code !== 'string') return;
        const col = state.allColors.find((c) => c.code === entry.code);
        if (!col) return;
        const sh = entry.shape === 'square' ? 'square' : 'round';
        const k = `${col.code}_${sh}`;
        const prevW = dedup.has(k) ? dedup.get(k).weightGrams : 0;
        dedup.set(k, buildCartItem(col, sh, prevW + clampWeight(entry.weightGrams)));
      });
      initialCart = Array.from(dedup.values());
    } else {
      const c5200 = state.allColors.find((c) => c.code === '5200') || state.allColors[0];
      const c310 = state.allColors.find((c) => c.code === '310') || state.allColors[1];
      const c150 = state.allColors.find((c) => c.code === '150') || state.allColors[2];
      initialCart = [
        buildCartItem(c5200, 'round', 100),
        buildCartItem(c310, 'square', 100),
        buildCartItem(c150, 'round', 200)
      ];
    }

    // Sync finish & shape UI states from persisted storage
    document.querySelectorAll('#heroFinishPills .hero-finish-pill').forEach((b) => {
      const on = b.dataset.finish === state.studioFinish;
      b.classList.toggle('hero-finish-pill--active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const rBtn = document.getElementById('btnShapeRound');
    const sBtn = document.getElementById('btnShapeSquare');
    if (rBtn) {
      rBtn.setAttribute('aria-selected', String(state.currentShape === 'round'));
      rBtn.tabIndex = state.currentShape === 'round' ? 0 : -1;
    }
    if (sBtn) {
      sBtn.setAttribute('aria-selected', String(state.currentShape === 'square'));
      sBtn.tabIndex = state.currentShape === 'square' ? 0 : -1;
    }

    syncGridDensityUi(state.gridDensity);
    initPathMarquee();
    renderLoupeHeaderAndControls();
    applyFilters();
    updateCartState(initialCart);
    bindEvents();
    requestAnimationFrame(() => {
      syncShapePill(false);
      paintLoupeFrame();
      if (pathMarqueeCtrl) pathMarqueeCtrl.refreshLayout();
    });
  }

  init();
})();
