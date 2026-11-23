/**
 * Inspira UI PathMarquee Engine (Pure Vanilla JS GPU-Compositor Port for DMC 445 Optical Atelier)
 * Faithful physics implementation of Inspira UI v2 PathMarquee:
 *   - Pre-sampled SVG path lookup table (512 sub-pixel samples via getPointAtLength)
 *   - 100% GPU compositor-only transform: translate3d(x, y, 0) + subtle tangent banking
 *   - Exponential spring hover slowdown (slowdownOnHover, slowDownFactor, stiffness: 400)
 *   - Pointer-capture drag scrubbing with velocity inertia (dragSensitivity, dragVelocityDecay, dragAwareDirection)
 *   - Rolling depth z-index (enableRollingZIndex) & edge-taper opacity interpolation
 *   - Responsive viewBox ResizeObserver scaling (rAF-coalesced, 0 layout loops)
 *   - Off-screen IntersectionObserver + visibilitychange + prefers-reduced-motion auto-pause
 */
(function (global) {
  'use strict';

  const PATH_PRESETS = {
    loop: {
      id: 'loop',
      label: '经典回环',
      viewBox: '0 0 996 330',
      width: 996,
      height: 330,
      closed: false,
      // Exact Inspira UI v2 PathMarquee signature loop curve
      d: 'M1 209.434C58.5872 255.935 387.926 325.938 482.583 209.434C600.905 63.8051 525.516 -43.2211 427.332 19.9613C329.149 83.1436 352.902 242.723 515.041 267.302C644.752 286.966 943.56 181.94 995 156.5'
    },
    wave: {
      id: 'wave',
      label: '丝带波浪',
      viewBox: '0 0 996 330',
      width: 996,
      height: 330,
      closed: false,
      d: 'M6 218C136 52 292 52 432 174C572 296 742 288 898 128C940 85 972 104 992 132'
    },
    infinity: {
      id: 'infinity',
      label: '无限光环',
      viewBox: '0 0 996 330',
      width: 996,
      height: 330,
      closed: true,
      d: 'M498 165C404 34 156 34 156 165C156 296 404 296 498 165C592 34 840 34 840 165C840 296 592 296 498 165Z'
    }
  };

  const SAMPLE_STEPS = 512;
  const ITEM_HALF = 37; // half of 74px medallion

  function wrap(min, max, value) {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
  }

  function createPathMarquee(container, options) {
    if (!container) return null;

    const opts = Object.assign(
      {
        preset: 'loop',
        baseVelocity: 6.5,
        direction: 'normal',
        slowdownOnHover: true,
        slowDownFactor: 0.2,
        slowDownStiffness: 400,
        draggable: true,
        dragSensitivity: 0.13,
        dragVelocityDecay: 0.96,
        dragAwareDirection: true,
        showPath: true,
        enableRollingZIndex: true,
        zIndexBase: 2,
        zIndexRange: 24,
        targetSlotCount: 24,
        renderItem: null,
        onSelect: null,
        onQuickAdd: null,
        onHoverItem: null,
        onStateChange: null
      },
      options || {}
    );

    const reducedMotionMql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const state = {
      presetKey: PATH_PRESETS[opts.preset] ? opts.preset : 'loop',
      baseOffset: 0,
      directionFactor: opts.direction === 'reverse' ? -1 : 1,
      hoverFactor: 1,
      isHovered: false,
      isDragging: false,
      dragVelocity: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      pointerDownX: 0,
      pointerDownY: 0,
      totalDragDist: 0,
      activePointerId: null,
      pointerDownNode: null,
      userPaused: false,
      externalPaused: false,
      inViewport: true,
      showPath: Boolean(opts.showPath),
      activeCode: null,
      items: [],
      itemNodes: [],
      lutX: new Float32Array(SAMPLE_STEPS + 1),
      lutY: new Float32Array(SAMPLE_STEPS + 1),
      lutAngle: new Float32Array(SAMPLE_STEPS + 1),
      lutReady: false,
      rafId: null,
      lastFrameMs: 0,
      scale: 1,
      destroyed: false
    };

    // Build DOM layers inside container
    container.innerHTML = '';
    container.classList.add('pm-root');
    if (opts.draggable) {
      container.classList.add('pm-root--draggable');
    }

    const stage = document.createElement('div');
    stage.className = 'pm-stage';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'pm-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'pmGuideGoldGrad');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');
    [
      ['0%', 'rgba(216,181,124,0.03)'],
      ['16%', 'rgba(216,181,124,0.34)'],
      ['50%', 'rgba(244,225,186,0.52)'],
      ['84%', 'rgba(216,181,124,0.34)'],
      ['100%', 'rgba(216,181,124,0.03)']
    ].forEach(([offset, color]) => {
      const stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    const glowPath = document.createElementNS(svgNS, 'path');
    glowPath.setAttribute('class', 'pm-svg__glow');
    glowPath.setAttribute('fill', 'none');

    const guidePath = document.createElementNS(svgNS, 'path');
    guidePath.setAttribute('class', 'pm-svg__guide');
    guidePath.setAttribute('fill', 'none');
    guidePath.setAttribute('stroke', 'url(#pmGuideGoldGrad)');

    svg.appendChild(glowPath);
    svg.appendChild(guidePath);

    const trackLayer = document.createElement('div');
    trackLayer.className = 'pm-track';

    stage.appendChild(svg);
    stage.appendChild(trackLayer);
    container.appendChild(stage);

    function getPreset() {
      return PATH_PRESETS[state.presetKey] || PATH_PRESETS.loop;
    }

    function isReducedMotion() {
      return Boolean(reducedMotionMql && reducedMotionMql.matches);
    }

    function emitState() {
      if (typeof opts.onStateChange === 'function') {
        opts.onStateChange({
          preset: state.presetKey,
          isHovered: state.isHovered,
          isDragging: state.isDragging,
          userPaused: state.userPaused,
          showPath: state.showPath,
          hoverFactor: state.hoverFactor
        });
      }
    }

    function buildPathLut() {
      state.lutReady = false;
      if (typeof guidePath.getTotalLength !== 'function') return;
      let totalLen = 0;
      try {
        totalLen = guidePath.getTotalLength();
      } catch {
        return;
      }
      if (!totalLen || !Number.isFinite(totalLen)) return;

      const eps = Math.max(0.5, totalLen / (SAMPLE_STEPS * 2));
      for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const dist = (i / SAMPLE_STEPS) * totalLen;
        const p = guidePath.getPointAtLength(dist);
        const pPrev = guidePath.getPointAtLength(Math.max(0, dist - eps));
        const pNext = guidePath.getPointAtLength(Math.min(totalLen, dist + eps));
        state.lutX[i] = p.x;
        state.lutY[i] = p.y;
        // Subtle jewel banking along curve tangent (capped softly so crystals gleam gracefully)
        const rad = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x);
        state.lutAngle[i] = (rad * 180) / Math.PI;
      }
      state.lutReady = true;
    }

    function samplePath(pct) {
      const clamped = Math.max(0, Math.min(100, pct));
      const f = (clamped / 100) * SAMPLE_STEPS;
      const i0 = Math.floor(f);
      const i1 = Math.min(SAMPLE_STEPS, i0 + 1);
      const t = f - i0;
      const x = state.lutX[i0] + (state.lutX[i1] - state.lutX[i0]) * t;
      const y = state.lutY[i0] + (state.lutY[i1] - state.lutY[i0]) * t;
      let a0 = state.lutAngle[i0];
      let a1 = state.lutAngle[i1];
      let da = a1 - a0;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      const angle = a0 + da * t;
      return { x, y, angle };
    }

    function syncResponsiveScale() {
      const preset = getPreset();
      const rect = container.getBoundingClientRect();
      const cw = rect.width || container.clientWidth || preset.width;
      const ch = rect.height || container.clientHeight || preset.height;
      if (cw <= 0 || ch <= 0) return;

      // Generous panoramic sweep across the velvet stage while keeping badges cleanly unclipped
      const padX = 16;
      const padY = 26;
      const availW = Math.max(120, cw - padX * 2);
      const availH = Math.max(100, ch - padY * 2);
      const scale = Math.min(availW / preset.width, availH / preset.height);
      const scaledW = preset.width * scale;
      const scaledH = preset.height * scale;
      const offsetX = (cw - scaledW) / 2;
      const offsetY = (ch - scaledH) / 2;

      state.scale = scale;
      stage.style.width = `${preset.width}px`;
      stage.style.height = `${preset.height}px`;
      stage.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    }

    function applyPresetGeometry() {
      const preset = getPreset();
      svg.setAttribute('viewBox', preset.viewBox);
      glowPath.setAttribute('d', preset.d);
      guidePath.setAttribute('d', preset.d);
      svg.style.opacity = state.showPath ? '1' : '0';
      buildPathLut();
      syncResponsiveScale();
      paintPositions();
    }

    function paintPositions() {
      const nodes = state.itemNodes;
      const count = nodes.length;
      if (!count || !state.lutReady) return;
      const preset = getPreset();

      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        const basePos = (i * 100) / count;
        const pct = wrap(0, 100, state.baseOffset + basePos);
        const pt = samplePath(pct);

        node.dataset.progress = pct.toFixed(3);
        node.style.transform = `translate3d(${(pt.x - ITEM_HALF).toFixed(2)}px, ${(pt.y - ITEM_HALF).toFixed(2)}px, 0)`;

        const svgWrap = node._svgWrap;
        if (svgWrap) {
          svgWrap.style.transform = `rotate(${(pt.angle * 0.35).toFixed(1)}deg)`;
        }

        // Smooth edge dissolve on open paths so gems enter/exit obsidian velvet seamlessly
        let edgeOpacity = 1;
        let depthScale = 1;
        if (!preset.closed) {
          if (pct < 7) {
            edgeOpacity = Math.max(0, pct / 7);
            depthScale = 0.78 + 0.22 * edgeOpacity;
          } else if (pct > 93) {
            edgeOpacity = Math.max(0, (100 - pct) / 7);
            depthScale = 0.78 + 0.22 * edgeOpacity;
          }
        }
        node.style.opacity = edgeOpacity.toFixed(3);
        node.style.setProperty('--pm-depth-scale', depthScale.toFixed(3));

        if (opts.enableRollingZIndex) {
          const isActive = state.activeCode && node.dataset.code === state.activeCode;
          const isNodeHovered = node.dataset.hovered === '1';
          if (isNodeHovered) {
            node.style.zIndex = String(opts.zIndexBase + opts.zIndexRange + 40);
          } else if (isActive) {
            node.style.zIndex = String(opts.zIndexBase + opts.zIndexRange + 20);
          } else {
            const z = Math.floor(opts.zIndexBase + (pct / 100) * opts.zIndexRange);
            node.style.zIndex = String(z);
          }
        }
      }
    }

    function shouldAnimate() {
      if (state.destroyed || state.externalPaused || !state.inViewport) return false;
      if (typeof document !== 'undefined' && document.hidden) return false;
      if (state.isDragging) return true;
      if (Math.abs(state.dragVelocity) > 0.008) return true;
      if (state.userPaused || isReducedMotion()) return false;
      return true;
    }

    function ensureRunning() {
      if (state.destroyed || state.rafId !== null) return;
      if (!shouldAnimate()) return;
      state.lastFrameMs = performance.now();
      const tick = (now) => {
        if (state.destroyed || !shouldAnimate()) {
          state.rafId = null;
          return;
        }
        const delta = Math.min(Math.max(now - state.lastFrameMs, 4), 64);
        state.lastFrameMs = now;

        // Exact Inspira UI exponential spring hover slowdown
        const targetHover = state.isHovered && opts.slowdownOnHover ? opts.slowDownFactor : 1;
        const springProgress = 1 - Math.exp((-opts.slowDownStiffness * delta) / 100000);
        state.hoverFactor += (targetHover - state.hoverFactor) * springProgress;
        container.dataset.hoverFactor = state.hoverFactor.toFixed(4);

        const autoAllowed = !state.userPaused && !isReducedMotion();
        const moveBy = autoAllowed
          ? state.directionFactor * opts.baseVelocity * (delta / 1000) * state.hoverFactor
          : 0;

        if (state.isDragging) {
          state.baseOffset += state.dragVelocity;
          state.dragVelocity *= opts.dragVelocityDecay;
        } else {
          state.baseOffset += moveBy + state.dragVelocity;
          state.dragVelocity *= opts.dragVelocityDecay;
          if (Math.abs(state.dragVelocity) < 0.005) state.dragVelocity = 0;
        }

        paintPositions();
        state.rafId = requestAnimationFrame(tick);
      };
      state.rafId = requestAnimationFrame(tick);
    }

    function stopLoop() {
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }

    function setItems(sourceColors, activeCode) {
      state.activeCode = activeCode || state.activeCode;
      const list = Array.isArray(sourceColors) ? sourceColors.filter(Boolean) : [];
      state.items = list;
      trackLayer.innerHTML = '';
      state.itemNodes = [];

      if (!list.length) return;

      // Auto-repeat like Inspira UI `repeat` ONLY when source list is shorter than targetSlotCount
      const repeatCount = list.length >= opts.targetSlotCount ? 1 : Math.max(1, Math.min(4, Math.ceil(opts.targetSlotCount / list.length)));
      const expanded = [];
      for (let r = 0; r < repeatCount; r++) {
        for (let i = 0; i < list.length; i++) {
          if (expanded.length >= opts.targetSlotCount) break;
          expanded.push({ color: list[i], isRepeat: r > 0 });
        }
        if (expanded.length >= opts.targetSlotCount) break;
      }

      const frag = document.createDocumentFragment();

      expanded.forEach(({ color, isRepeat }) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'pm-item';
        wrapper.dataset.repeat = isRepeat ? '1' : '0';
        if (!isRepeat && state.activeCode && color.code === state.activeCode) {
          wrapper.classList.add('pm-item--active');
        }
        wrapper.dataset.code = color.code;
        if (isRepeat) {
          wrapper.setAttribute('aria-hidden', 'true');
        }

        if (typeof opts.renderItem === 'function') {
          wrapper.innerHTML = opts.renderItem(color, isRepeat);
        }
        wrapper._svgWrap = wrapper.querySelector('.pm-gem-btn__svg');

        wrapper.addEventListener('pointerenter', () => {
          wrapper.dataset.hovered = '1';
          state.isHovered = true;
          container.classList.add('pm-root--hovered');
          paintPositions();
          emitState();
          if (typeof opts.onHoverItem === 'function') opts.onHoverItem(color);
        });
        wrapper.addEventListener('pointerleave', () => {
          wrapper.dataset.hovered = '0';
          const anyHovered = state.itemNodes.some((n) => n.dataset.hovered === '1');
          state.isHovered = anyHovered;
          if (!anyHovered) {
            container.classList.remove('pm-root--hovered');
            if (typeof opts.onHoverItem === 'function') opts.onHoverItem(null);
          }
          paintPositions();
          emitState();
        });

        frag.appendChild(wrapper);
        state.itemNodes.push(wrapper);
      });

      trackLayer.appendChild(frag);
      paintPositions();
      ensureRunning();
    }

    function setActiveCode(code) {
      state.activeCode = code || null;
      for (let i = 0; i < state.itemNodes.length; i++) {
        const node = state.itemNodes[i];
        const isPrimary = node.dataset.repeat !== '1';
        node.classList.toggle('pm-item--active', Boolean(isPrimary && code && node.dataset.code === code));
      }
      paintPositions();
    }

    // Pointer-capture drag + crisp click disambiguation
    function onPointerDown(e) {
      if (!opts.draggable) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('[data-pm-quickadd]')) return;

      state.isDragging = true;
      state.activePointerId = e.pointerId;
      state.lastPointerX = e.clientX;
      state.lastPointerY = e.clientY;
      state.pointerDownX = e.clientX;
      state.pointerDownY = e.clientY;
      state.totalDragDist = 0;
      state.dragVelocity = 0;
      state.pointerDownNode = e.target.closest('.pm-item');

      container.classList.add('pm-root--dragging');
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events without active pointerId
      }
      emitState();
      ensureRunning();
    }

    function onPointerMove(e) {
      if (!state.isDragging || (state.activePointerId !== null && e.pointerId !== state.activePointerId)) return;
      const dx = e.clientX - state.lastPointerX;
      const dy = e.clientY - state.lastPointerY;
      state.lastPointerX = e.clientX;
      state.lastPointerY = e.clientY;

      const stepDist = Math.hypot(dx, dy);
      state.totalDragDist += stepDist;

      // Exact Inspira UI signed Euclidean drag velocity scaled by viewport ratio
      const scaleNorm = Math.max(0.45, state.scale);
      const signedDelta = (dx >= 0 ? stepDist : -stepDist) / scaleNorm;
      const v = signedDelta * opts.dragSensitivity;
      state.dragVelocity = v;

      if (opts.dragAwareDirection && Math.abs(v) > 0.12) {
        state.directionFactor = Math.sign(v);
      }

      if (isReducedMotion()) {
        state.baseOffset += v;
        paintPositions();
      }
    }

    function onPointerUp(e) {
      if (!state.isDragging) return;
      const wasClick = state.totalDragDist <= 6;
      const clickedNode = state.pointerDownNode || e.target.closest('.pm-item');

      state.isDragging = false;
      state.pointerDownNode = null;
      container.classList.remove('pm-root--dragging');
      if (state.activePointerId !== null) {
        try {
          container.releasePointerCapture(state.activePointerId);
        } catch {
          // Ignore
        }
        state.activePointerId = null;
      }

      if (wasClick && clickedNode && clickedNode.dataset.code) {
        state.dragVelocity = 0;
        const found = state.items.find((c) => c.code === clickedNode.dataset.code);
        if (found && typeof opts.onSelect === 'function') {
          opts.onSelect(found, e);
        }
      }
      emitState();
      ensureRunning();
    }

    container.addEventListener('click', (e) => {
      const qaBtn = e.target.closest('[data-pm-quickadd]');
      if (!qaBtn) return;
      e.stopPropagation();
      const code = qaBtn.dataset.pmQuickadd;
      const found = state.items.find((c) => c.code === code);
      if (found && typeof opts.onQuickAdd === 'function') {
        opts.onQuickAdd(found, e);
      }
    });

    container.addEventListener('dblclick', (e) => {
      const node = e.target.closest('.pm-item');
      if (!node || !node.dataset.code) return;
      const found = state.items.find((c) => c.code === node.dataset.code);
      if (found && typeof opts.onQuickAdd === 'function') {
        opts.onQuickAdd(found, e);
      }
    });

    container.addEventListener('keydown', (e) => {
      const btn = e.target.closest('.pm-gem-btn');
      if (!btn) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const node = btn.closest('.pm-item');
        const found = node && state.items.find((c) => c.code === node.dataset.code);
        if (found && typeof opts.onSelect === 'function') {
          opts.onSelect(found, e);
        }
      }
    });

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    let roRaf = null;
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (roRaf !== null) return;
        roRaf = requestAnimationFrame(() => {
          roRaf = null;
          syncResponsiveScale();
        });
      });
      ro.observe(container);
    }

    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            state.inViewport = Boolean(entry.isIntersecting);
            if (state.inViewport) ensureRunning();
            else stopLoop();
          });
        },
        { rootMargin: '80px' }
      );
      io.observe(container);
    }

    function onVisibility() {
      if (document.hidden) stopLoop();
      else ensureRunning();
    }
    document.addEventListener('visibilitychange', onVisibility);

    applyPresetGeometry();
    ensureRunning();

    return {
      PRESETS: PATH_PRESETS,
      setItems,
      setActiveCode,
      setPreset(presetKey) {
        if (!PATH_PRESETS[presetKey]) return;
        state.presetKey = presetKey;
        applyPresetGeometry();
        emitState();
      },
      setShowPath(flag) {
        state.showPath = Boolean(flag);
        svg.style.opacity = state.showPath ? '1' : '0';
        emitState();
      },
      togglePause() {
        state.userPaused = !state.userPaused;
        if (state.userPaused) stopLoop();
        else ensureRunning();
        emitState();
        return state.userPaused;
      },
      setExternalPaused(flag) {
        state.externalPaused = Boolean(flag);
        if (state.externalPaused) stopLoop();
        else ensureRunning();
      },
      nudge(deltaPct) {
        state.baseOffset += Number(deltaPct) || 0;
        paintPositions();
      },
      refreshLayout() {
        syncResponsiveScale();
      },
      getState() {
        return {
          preset: state.presetKey,
          isHovered: state.isHovered,
          isDragging: state.isDragging,
          userPaused: state.userPaused,
          showPath: state.showPath,
          itemCount: state.itemNodes.length
        };
      },
      destroy() {
        state.destroyed = true;
        stopLoop();
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  global.InspiraPathMarquee = {
    PATH_PRESETS,
    createPathMarquee
  };
})(typeof window !== 'undefined' ? window : globalThis);
