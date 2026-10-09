/* GOAL explainer v2. One master clock drives every scene, so any timestamp renders the same frame. */

const CONFIG = {
  ctaText: "Talk with your GOAL team",
  controls: true,  // false hides the control bar so the piece just plays (keys and progress segments still work)
  captions: true   // false starts with captions hidden (C still toggles them)
};

(function () {
  'use strict';

  // ---------- Easing ----------
  function backEase(c1) {
    const c3 = c1 + 1;
    return function (p) { return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  }
  const E = {
    linear: function (p) { return p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    outQuint: function (p) { return 1 - Math.pow(1 - p, 5); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    pulse: function (p) { return Math.sin(p * Math.PI); },
    back: backEase(1.5),      // snappy ease out with a slight overshoot
    backSoft: backEase(0.8)
  };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const lerp = function (a, b, p) { return a + (b - a) * p; };
  const q = function (sel, root) { return (root || document).querySelector(sel); };
  const qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------- DOM ----------
  const stageWrap = q('#stage-wrap');
  const stage = q('#stage');
  const sceneEls = qa('.scene');
  const captionEl = q('#caption');
  const segs = qa('.seg');
  const replayInline = q('#replay-inline');
  const btn = {
    prev: q('#btn-prev'), play: q('#btn-play'), playText: q('#btn-play-text'), next: q('#btn-next'),
    replay: q('#btn-replay'), captions: q('#btn-captions')
  };
  q('#cta').textContent = CONFIG.ctaText;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scale = 1;
  // Two stage designs: landscape 1920 by 1080, portrait 1080 by 1920 for phones held upright.
  let STAGE_W = 1920, STAGE_H = 1080, orient = 'landscape';

  // ---------- Track helpers ----------
  // A track is {t0, dur, ease, apply(p)}. Base CSS is the resting state; tracks are applied in order once
  // their start time has passed, so later tracks override earlier ones. On scene entry every track is
  // applied at p = 0 in reverse order, which leaves each element in its first track's start state.
  // Tracks flagged noRest (scene exits, words that hand off) are skipped when a scene is shown at rest
  // for reduced motion.
  function tr(t0, dur, ease, apply) { return { t0: t0, dur: dur, ease: ease, apply: apply }; }
  function noRest(t) { t.noRest = true; return t; }
  function loop(t0, t1, period, apply, finalPhase) {
    return { loop: true, t0: t0, t1: t1, period: period, apply: apply, finalPhase: finalPhase };
  }
  function setXf(el, x, y, s) {
    el.style.transform = 'translate(' + (x || 0).toFixed(2) + 'px,' + (y || 0).toFixed(2) + 'px)' + (s == null ? '' : ' scale(' + s.toFixed(4) + ')');
  }
  function rise(el, t0, dur, dy) {
    dur = dur || 450; dy = dy == null ? 14 : dy;
    return tr(t0, dur, E.out, function (p) { el.style.opacity = p; el.style.transform = 'translateY(' + ((1 - p) * dy).toFixed(2) + 'px)'; });
  }
  // Rise with a small overshoot: opacity eases out, position springs.
  function riseBack(el, t0, dur, dy) {
    dur = dur || 520; dy = dy == null ? 40 : dy;
    return tr(t0, dur, E.linear, function (qq) {
      el.style.opacity = E.out(Math.min(1, qq * 1.5));
      el.style.transform = 'translateY(' + ((1 - E.back(qq)) * dy).toFixed(2) + 'px)';
    });
  }
  function fadeOut(el, t0, dur, dy) {
    dur = dur || 350; dy = dy == null ? -12 : dy;
    return tr(t0, dur, E.out, function (p) { el.style.opacity = 1 - p; el.style.transform = 'translateY(' + (p * dy).toFixed(2) + 'px)'; });
  }
  function fade(el, t0, dur) {
    dur = dur || 450;
    return tr(t0, dur, E.out, function (p) { el.style.opacity = p; });
  }
  // Scale pop from `from` to 1 with overshoot.
  function pop(el, t0, dur, from) {
    from = from == null ? 0 : from;
    return tr(t0, dur || 420, E.linear, function (qq) {
      el.style.opacity = Math.min(1, qq * 3);
      el.style.transform = 'scale(' + lerp(from, 1, E.back(qq)).toFixed(4) + ')';
    });
  }
  // Quadratic arc from offset `from` to offset `to`, lifted by `lift` px at the midpoint.
  function arcPoint(from, to, lift, p) {
    const cx = (from.x + to.x) / 2, cy = (from.y + to.y) / 2 - lift;
    const u = 1 - p;
    return { x: u * u * from.x + 2 * u * p * cx + p * p * to.x, y: u * u * from.y + 2 * u * p * cy + p * p * to.y };
  }
  function count(el, t0, from, to) {
    return tr(t0, 320, E.out, function (p) {
      el.textContent = p > 0 ? String(to) : String(from);
      el.style.transform = 'scale(' + (1 + 0.1 * (1 - p)).toFixed(4) + ')';
    });
  }
  function draw(path, t0, dur) {
    dur = dur || 420;
    return tr(t0, dur, E.out, function (p) { path.style.strokeDashoffset = (1 - p).toFixed(4); });
  }
  function ripple(ring, t0, dur, s0, s1, alpha) {
    return tr(t0, dur, E.out, function (p) {
      ring.style.opacity = p <= 0 || p >= 1 ? 0 : ((1 - p) * alpha).toFixed(3);
      ring.style.transform = 'scale(' + lerp(s0, s1, p).toFixed(4) + ')';
    });
  }
  function mixBlueToGray(p) {
    // primary blue to muted gray, for clicks that never submit the form
    const a = [5, 123, 229], b = [148, 163, 184];
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * p); }).join(',') + ')';
  }
  function typeText(el, t0, dur, text) {
    return tr(t0, dur, E.linear, function (p) {
      el.textContent = text.slice(0, Math.round(p * text.length));
      el.classList.toggle('is-focus', p > 0 && p < 1);
    });
  }

  // Geometry in stage pixels (viewport rect divided by the current scale).
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left / scale, y: r.top / scale, w: r.width / scale, h: r.height / scale };
  }
  function center(el) { const r = rectOf(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  function delta(fromEl, toEl) { const a = center(fromEl), b = center(toEl); return { x: a.x - b.x, y: a.y - b.y }; }
  function pointIn(el, fx, fy) { const r = rectOf(el); return { x: r.x + r.w * fx, y: r.y + r.h * fy }; }
  function localTo(pt, parentEl) { const pr = rectOf(parentEl); return { x: pt.x - pr.x, y: pt.y - pr.y }; }
  // Pin an absolutely positioned helper (tap ripple, flying chip, cursor) to a stage point inside a parent.
  function pinAt(el, pt, parentEl) {
    const l = localTo(pt, parentEl);
    el.style.left = l.x.toFixed(2) + 'px';
    el.style.top = l.y.toFixed(2) + 'px';
  }
  function pinTo(el, targetEl, parentEl) { pinAt(el, center(targetEl), parentEl); }
  function cursorMove(cursor, t0, dur, from, to) {
    return tr(t0, dur, E.inOut, function (p) { const pt = arcPoint(from, to, 24, p); setXf(cursor, pt.x, pt.y, 1); });
  }
  function cursorPress(cursor, t0, at) {
    return tr(t0, 240, E.out, function (p) { setXf(cursor, at.x, at.y, 1 - 0.15 * E.pulse(p)); });
  }
  function tapTracks(tap, t0) {
    const dot = q('.tap-dot', tap), ring = q('.tap-ring', tap);
    return [
      tr(t0, 220, E.back, function (p) { dot.style.opacity = Math.min(1, p * 2); setXf(dot, 0, 0, 0.4 + 0.6 * p); }),
      tr(t0 + 40, 700, E.out, function (p) { ring.style.opacity = p <= 0 ? 0 : (1 - p) * 0.8; setXf(ring, 0, 0, 0.25 + 0.95 * p); }),
      tr(t0 + 900, 300, E.out, function (p) { dot.style.opacity = 1 - p; setXf(dot, 0, 0, 1 - 0.4 * p); })
    ];
  }
  // A circle of the next field's color grows from point P (scene coordinates) until it covers the frame.
  function flood(el, root, P, r0, t0, dur, nextBg) {
    const R = Math.max(Math.hypot(P.x, P.y), Math.hypot(STAGE_W - P.x, P.y), Math.hypot(P.x, STAGE_H - P.y), Math.hypot(STAGE_W - P.x, STAGE_H - P.y)) + 6;
    el.style.width = el.style.height = (2 * R).toFixed(1) + 'px';
    el.style.left = (P.x - R).toFixed(1) + 'px';
    el.style.top = (P.y - R).toFixed(1) + 'px';
    const s0 = r0 / R, base = root.getAttribute('data-bg');
    return tr(t0, dur, E.inOut, function (p) {
      el.style.opacity = p > 0 ? 1 : 0;
      el.style.transform = 'scale(' + lerp(s0, 1, p).toFixed(5) + ')';
      stage.setAttribute('data-bg', p >= 0.45 ? nextBg : base);
    });
  }
  // The oversized word: the two halves spring apart from the center, hold, then the whole word shrinks
  // into the eyebrow slot and hands off to it.
  function heroTracks(hero, eyebrowSpan, t0, morphAt, morphDur) {
    const a = q('.hw-a', hero), b = q('.hw-b', hero);
    const ra = rectOf(a), rb = rectOf(b), rh = rectOf(hero), rt = rectOf(eyebrowSpan);
    const left = Math.min(ra.x, rb.x), right = Math.max(ra.x + ra.w, rb.x + rb.w);
    const top = Math.min(ra.y, rb.y), bottom = Math.max(ra.y + ra.h, rb.y + rb.h);
    const c = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const tc = { x: rt.x + rt.w / 2, y: rt.y + rt.h / 2 };
    const s1 = rt.w / (right - left);
    hero.style.transformOrigin = (c.x - rh.x).toFixed(1) + 'px ' + (c.y - rh.y).toFixed(1) + 'px';
    const axis = orient === 'portrait' ? 'Y' : 'X';
    function slide(el, at, d) {
      return tr(at, 560, E.linear, function (qq) {
        el.style.opacity = E.out(Math.min(1, qq * 1.8));
        el.style.transform = 'translate' + axis + '(' + ((1 - E.back(qq)) * d).toFixed(2) + 'px)';
      });
    }
    return [
      noRest(tr(t0, 10, E.linear, function () { hero.style.opacity = 1; hero.style.transform = 'none'; })),
      noRest(slide(a, t0 + 60, 170)),
      noRest(slide(b, t0 + 140, -170)),
      tr(morphAt, morphDur, E.inOut, function (p) {
        hero.style.opacity = p < 0.55 ? 1 : (1 - (p - 0.55) / 0.45).toFixed(3);
        setXf(hero, (tc.x - c.x) * p, (tc.y - c.y) * p, lerp(1, s1, p));
      }),
      tr(morphAt + morphDur * 0.62, 320, E.out, function (p) {
        eyebrowSpan.style.opacity = p;
        eyebrowSpan.style.transform = 'scale(' + lerp(1.25, 1, p).toFixed(4) + ')';
      })
    ];
  }

  // ---------- Halftone ----------
  // Renders a word as a field of dots on a canvas. Dot radius follows the letter coverage and shrinks
  // across the word, like a printed halftone. Each dot is given one of `groups` targets so the word can
  // break apart into those targets.
  function makeHalftone(canvas, text, box, step) {
    const k = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(STAGE_W * k);
    canvas.height = Math.round(STAGE_H * k);
    const ctx = canvas.getContext('2d');
    const bw = Math.max(1, Math.ceil(box.w)), bh = Math.max(1, Math.ceil(box.h));
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    const oc = off.getContext('2d', { willReadFrequently: true });
    const family = ' Sora, Outfit, system-ui, sans-serif';
    oc.font = '800 100px' + family;
    if ('letterSpacing' in oc) oc.letterSpacing = '-4px';
    let m = oc.measureText(text);
    const F = Math.min(bw * 0.97 / m.width * 100, bh * 0.94 / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 100);
    oc.font = '800 ' + F.toFixed(1) + 'px' + family;
    if ('letterSpacing' in oc) oc.letterSpacing = (-0.04 * F).toFixed(1) + 'px';
    m = oc.measureText(text);
    oc.fillStyle = '#000';
    oc.textAlign = 'center';
    oc.textBaseline = 'alphabetic';
    oc.fillText(text, bw / 2, bh / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    const data = oc.getImageData(0, 0, bw, bh).data;
    const pts = [];
    for (let gy = step / 2; gy < bh; gy += step) {
      for (let gx = step / 2; gx < bw; gx += step) {
        let cov = 0, n = 0;
        for (let sy = -0.375; sy <= 0.375; sy += 0.25) {
          for (let sx = -0.375; sx <= 0.375; sx += 0.25) {
            const X = Math.round(gx + sx * step), Y = Math.round(gy + sy * step);
            if (X < 0 || Y < 0 || X >= bw || Y >= bh) { n++; continue; }
            cov += data[(Y * bw + X) * 4 + 3] / 255; n++;
          }
        }
        cov /= n;
        if (cov > 0.14) pts.push({ x: box.x + gx, y: box.y + gy, cov: cov });
      }
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    const out = [];
    pts.forEach(function (p) {
      const u = ((p.x - x0) / Math.max(1, x1 - x0)) * 0.6 + ((p.y - y0) / Math.max(1, y1 - y0)) * 0.4;
      p.r = step * 0.5 * Math.sqrt(p.cov) * (1 - 0.5 * u);
      if (p.r < 1.2) return;
      p.wave = ((p.x - x0) / Math.max(1, x1 - x0)) * 460;
      out.push(p);
    });
    return { ctx: ctx, k: k, pts: out };
  }
  function assignGroups(H, targets) {
    const order = H.pts.map(function (p, i) { return i; }).sort(function (a, b) { return H.pts[a].x - H.pts[b].x; });
    const n = order.length;
    order.forEach(function (idx, rank) {
      const p = H.pts[idx];
      const g = Math.min(targets.length - 1, Math.floor(rank / n * targets.length));
      const h = Math.abs(Math.sin(idx * 12.9898 + 78.233) * 43758.5453) % 1;   // stable per dot
      p.g = g;
      p.target = targets[g];
      p.delay = g * 30 + h * 220;
      p.lift = 40 + h * 150;
    });
  }
  function drawHalftone(H, t, cfg) {
    const ctx = H.ctx;
    ctx.setTransform(H.k, 0, 0, H.k, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    if (t <= cfg.grow0 || t >= cfg.end) return;
    ctx.fillStyle = '#057BE5';
    ctx.beginPath();
    for (let i = 0; i < H.pts.length; i++) {
      const p = H.pts[i];
      const g = clamp((t - cfg.grow0 - p.wave) / cfg.growDur, 0, 1);
      if (g <= 0) continue;
      let r = p.r * E.back(g), x = p.x, y = p.y;
      const d = clamp((t - cfg.dis0 - p.delay) / cfg.disDur, 0, 1);
      if (d >= 1) continue;
      if (d > 0) {
        const e = E.inOut(d);
        const a = arcPoint(p, p.target, p.lift, e);
        x = a.x; y = a.y; r = lerp(r, cfg.endR, e);
      }
      if (r <= 0.3) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // ---------- Scenes ----------
  const SCENES = [
    {
      id: 'intro', durationMs: 5100, bg: 'dark',
      captions: [{ at: 0, text: 'How your GOAL campaign works.' }],
      build: function (root) {
        const dot = q('#s1-dot'), mark = q('#s1-mark'), words = qa('.s1-head .w', root);
        const r1 = q('#s1-r1'), r2 = q('#s1-r2'), r3 = q('#s1-r3'), fl = q('#s1-flood');
        const tracks = [
          // One small dot on a blank frame.
          tr(150, 420, E.linear, function (qq) { dot.style.opacity = qq > 0 ? 1 : 0; dot.style.transform = 'scale(' + (0.5 * E.back(qq)).toFixed(4) + ')'; }),
          tr(650, 260, E.linear, function (qq) { dot.style.transform = 'scale(' + (0.5 + 0.13 * E.pulse(qq)).toFixed(4) + ')'; }),
          tr(1050, 260, E.linear, function (qq) { dot.style.transform = 'scale(' + (0.5 + 0.13 * E.pulse(qq)).toFixed(4) + ')'; }),
          ripple(r1, 650, 1000, 0.05, 1, 0.9),
          ripple(r2, 1050, 1000, 0.05, 1, 0.9),
          // The dot grows into the mark's center and the radar mark scales in around it.
          tr(1450, 380, E.linear, function (qq) { dot.style.transform = 'scale(' + lerp(0.5, 1, E.back(qq)).toFixed(4) + ')'; }),
          ripple(r3, 1450, 1400, 0.04, 1, 0.6),
          tr(1500, 650, E.out, function (p) { mark.style.opacity = p; mark.style.transform = 'scale(' + lerp(0.9, 1, p).toFixed(4) + ')'; })
        ];
        words.forEach(function (w, i) { tracks.push(riseBack(w, 1650 + i * 80, 540, 46)); });
        // Exit: words and mark step away, the dot stays and floods the frame blue.
        words.forEach(function (w) { tracks.push(noRest(fadeOut(w, 4350, 280, -16))); });
        tracks.push(noRest(tr(4400, 280, E.out, function (p) { mark.style.opacity = 1 - p; mark.style.transform = 'scale(' + lerp(1, 0.94, p).toFixed(4) + ')'; })));
        tracks.push(noRest(flood(fl, root, localTo(center(dot), root), 23, 4600, 500, 'blue')));
        return tracks;
      }
    },
    {
      id: 'ad', durationMs: 9550, bg: 'blue',
      captions: [
        { at: 0, text: 'Your branded ad runs in digital campaigns.' },
        { at: 2400, text: 'Your ad takes the top result on desktop and phone.' },
        { at: 5250, text: 'You pay GOAL for each click.' },
        { at: 6150, text: 'A click on either screen adds one paid click.' }
      ],
      build: function (root) {
        const eyebrow = q('#s2-eyebrow span'), beatA = q('.beat-a', root), beatB = q('.beat-b', root);
        const disc = q('#s2-disc'), num = q('#s2-num'), label = q('#s2-label'), duo = q('.duo', root);
        const hero = q('#s2-hero'), dot = q('#s2-dot'), rip = q('#s2-ripple'), discRip = q('#s2-disc-ripple'), fl = q('#s2-flood');
        const desktop = q('#s2-desktop'), phone = q('#s2-phone');
        const devices = [
          { ad: q('#s2-ad-d'), rows: qa('#s2-desktop .result'), btn: q('#s2-btn-d'), tap: q('#s2-tap-d'), fly: q('#s2-fly-d'), adAt: 2350, gap: 20 },
          { ad: q('#s2-ad-p'), rows: qa('#s2-phone .result'), btn: q('#s2-btn-p'), tap: q('#s2-tap-p'), fly: q('#s2-fly-p'), adAt: 2500, gap: 16 }
        ];
        const cursor = q('#s2-cursor');
        pinTo(discRip, disc, root);
        discRip.style.marginLeft = discRip.style.marginTop = '-92px';
        // The dot sits in the gap between the two halves of the word.
        const gapC = localTo(center(q('.hero-gap', hero)), root);
        [[dot, 48], [rip, 48]].forEach(function (d) {
          d[0].style.left = (gapC.x - d[1]).toFixed(1) + 'px';
          d[0].style.top = (gapC.y - d[1]).toFixed(1) + 'px';
        });
        const toDisc = delta(disc, dot);
        const tracks = [
          // The dot arrives, the word springs open around it.
          noRest(tr(0, 320, E.linear, function (qq) { dot.style.opacity = Math.min(1, qq * 3); setXf(dot, 0, 0, lerp(0.3, 1, E.back(qq))); }))
        ];
        tracks.push.apply(tracks, heroTracks(hero, eyebrow, 60, 1000, 480));
        tracks.push(noRest(ripple(rip, 450, 800, 1, 5.5, 0.9)));
        // The dot travels into the counter and becomes its disc.
        tracks.push(tr(1000, 560, E.inOut, function (p) {
          const pt = arcPoint({ x: 0, y: 0 }, toDisc, 60, p);
          dot.style.opacity = p < 0.85 ? 1 : (1 - (p - 0.85) / 0.15).toFixed(3);
          setXf(dot, pt.x, pt.y, lerp(1, 184 / 96, p));
        }));
        tracks.push(pop(disc, 1420, 420, 0.75), rise(label, 1540), rise(beatA, 1500));
        tracks.push(riseBack(desktop, 1250, 620, 60), riseBack(phone, 1380, 620, 60));
        devices.forEach(function (d) {
          const shift = rectOf(d.ad).h + d.gap;
          pinTo(d.tap, d.btn, duo);
          pinTo(d.fly, d.btn, root);
          d.toNum = delta(disc, d.fly);
          d.rows.forEach(function (r, i) {
            tracks.push(tr(1700 + i * 90, 450, E.out, function (p) { r.style.opacity = p; setXf(r, 0, -shift + (1 - p) * 10); }));
          });
          tracks.push(tr(d.adAt, 650, E.linear, function (qq) { d.ad.style.opacity = Math.min(1, qq * 2); setXf(d.ad, 0, -36 * (1 - E.back(qq))); }));
          d.rows.forEach(function (r) {
            tracks.push(tr(d.adAt, 650, E.inOut, function (p) { setXf(r, 0, -shift * (1 - p)); }));
          });
        });
        tracks.push(fadeOut(beatA, 4950), rise(beatB, 5250));
        // Desktop: the cursor arrives from the lower right and clicks the ad button.
        pinAt(cursor, pointIn(devices[0].btn, 0.56, 0.5), duo);
        const cFrom = { x: 230, y: 200 };
        tracks.push(tr(5350, 260, E.out, function (p) { cursor.style.opacity = p; setXf(cursor, cFrom.x, cFrom.y, 1); }));
        tracks.push(cursorMove(cursor, 5450, 700, cFrom, { x: 0, y: 0 }));
        tracks.push(cursorPress(cursor, 6150, { x: 0, y: 0 }));
        // Each click becomes a paid click that flies into the counter.
        function clickCycle(d, t0, from, to) {
          tracks.push.apply(tracks, tapTracks(d.tap, t0));
          tracks.push(tr(t0 + 250, 850, E.inOut, function (p) {
            const pt = arcPoint({ x: 0, y: 0 }, d.toNum, 150, p);
            d.fly.style.opacity = p <= 0 ? 0 : (p < 0.12 ? p / 0.12 : (p > 0.86 ? (1 - p) / 0.14 : 1));
            d.fly.style.transform = 'translate(-50%,-50%) translate(' + pt.x.toFixed(2) + 'px,' + pt.y.toFixed(2) + 'px) scale(' + (0.7 + 0.3 * Math.min(1, p * 4)).toFixed(3) + ')';
          }));
          tracks.push(count(num, t0 + 1100, from, to));
          tracks.push(tr(t0 + 1100, 380, E.out, function (p) { disc.style.transform = 'scale(' + (1 + 0.1 * E.pulse(p)).toFixed(4) + ')'; }));
          tracks.push(ripple(discRip, t0 + 1100, 700, 1, 1.9, 0.9));
        }
        clickCycle(devices[0], 6150, 0, 1);
        clickCycle(devices[1], 6950, 1, 2);
        // Exit: the white disc grows until the frame is white.
        tracks.push(noRest(tr(8950, 150, E.out, function (p) { num.style.opacity = 1 - p; })));
        tracks.push(noRest(flood(fl, root, localTo(center(disc), root), 92, 9000, 500, 'white')));
        return tracks;
      }
    },
    {
      id: 'leads', durationMs: 11900, bg: 'white',
      captions: [
        { at: 0, text: 'About 6 in 10 clicks become leads, on average.' },
        { at: 3500, text: 'Ten paid clicks travel to your form.' },
        { at: 7950, text: 'Every click is paid, lead or not.' }
      ],
      build: function (root) {
        const eb = q('.eyebrow span', root), beatA = q('.beat-a', root), beatB = q('.beat-b', root);
        const ratio = q('#s3-ratio'), num = q('#s3-num'), clicks = q('#s3-clicks'), form = q('#s3-form'), submit = q('#s3-submit');
        const groups = q('#s3-groups'), labels = qa('.group-label', groups), clickLabel = q('.group-label', clicks);
        const faces = qa('.card-face', root), cards = qa('.lead-card', root), slots = qa('.slot', root);
        const leadDots = qa('.dot.click[data-kind="lead"]', root), noneDots = qa('.dot.click[data-kind="none"]', root);
        const canvas = q('#s3-halftone'), hand = q('#s3-hand');
        const order = ['L', 'L', 'N', 'L', 'L', 'N', 'L', 'N', 'L', 'N'];
        const tracks = [rise(eb, 0), rise(beatA, 100)];

        // The hero figure: "6 IN 10" as a halftone, sized to the area the flow will use, then it breaks
        // apart into the ten paid clicks.
        const areas = [clicks, form, groups].map(rectOf), rr = rectOf(root);
        const box = {
          x: Math.min.apply(null, areas.map(function (a) { return a.x; })) - rr.x,
          y: Math.min.apply(null, areas.map(function (a) { return a.y; })) - rr.y
        };
        box.w = Math.max.apply(null, areas.map(function (a) { return a.x + a.w; })) - rr.x - box.x;
        box.h = Math.max.apply(null, areas.map(function (a) { return a.y + a.h; })) - rr.y - box.y;
        const H = makeHalftone(canvas, '6 IN 10', box, orient === 'portrait' ? 12 : 14);
        assignGroups(H, slots.map(function (s) { return localTo(center(s), root); }));
        const cfg = { grow0: 350, growDur: 420, dis0: 2200, disDur: 650, endR: 5, end: 3400 };
        tracks.push(tr(0, cfg.end, E.linear, function (p) { drawHalftone(H, p * cfg.end, cfg); }));

        // The flow layout fades in as the figure breaks apart.
        tracks.push(rise(clickLabel, 2000), fade(slots[0].parentNode, 2050, 350));
        tracks.push(rise(form, 2900, 500), rise(labels[0], 2980), rise(labels[1], 3060), rise(ratio, 3140));
        let li = 0, ni = 0, leads = 0;
        order.forEach(function (kind, k) {
          const dot = kind === 'L' ? leadDots[li++] : noneDots[ni++];
          const card = kind === 'L' ? cards[li - 1] : null;
          const face = kind === 'L' ? faces[li - 1] : null;
          const slot = slots[k];
          const fromSlot = delta(slot, dot);
          const atForm = delta(submit, dot);
          atForm.y -= 64;
          // The click dot condenses in its slot.
          tracks.push(tr(2850 + k * 30, 380, E.linear, function (qq) {
            dot.style.opacity = qq > 0 ? 1 : 0;
            setXf(dot, fromSlot.x, fromSlot.y, Math.max(0, E.back(qq)));
          }));
          const start = 3500 + k * 350;
          // Paid when clicked: the dot leaves for the form and a check stays in its slot.
          tracks.push(tr(start, 560, E.inOut, function (p) { const pt = arcPoint(fromSlot, atForm, 90, p); setXf(dot, pt.x, pt.y, 1); }));
          tracks.push(draw(q('path', slot), start + 80, 320));
          if (kind === 'L') tracks.push(tr(start + 520, 300, E.out, function (p) { setXf(submit, 0, 0, 1 + 0.05 * E.pulse(p)); }));
          const lift2 = kind === 'L' ? 60 : -170;   // leads arc up into a card, the rest dip into the gray row
          tracks.push(tr(start + 600, 480, E.out, function (p) { const pt = arcPoint(atForm, { x: 0, y: 0 }, lift2, p); setXf(dot, pt.x, pt.y, 1); }));
          const arrive = start + 1080;
          if (kind === 'L') {
            const n = ++leads;
            const lines = q('.lc-lines', card);
            tracks.push(tr(arrive - 60, 400, E.linear, function (qq) {
              face.style.opacity = Math.min(1, qq * 2.5);
              setXf(face, 0, 0, lerp(0.6, 1, E.back(qq)));
              lines.style.opacity = E.out(qq);
            }));
            tracks.push(count(num, arrive + 40, n - 1, n));
          } else {
            tracks.push(tr(arrive, 450, E.out, function (p) { dot.style.backgroundColor = p >= 1 ? '' : mixBlueToGray(p); }));
          }
          // Beat B: every receipt pulses, again and again, to say every click was paid.
          tracks.push(loop(8150 + k * 60, 11350, 1500, function (ph) {
            setXf(slot, 0, 0, 1 + 0.14 * E.pulse(Math.min(1, ph / 0.32)));
          }, 0));
        });
        tracks.push(fadeOut(beatA, 7650), rise(beatB, 7950));

        // Exit: one lead dot lifts to the center and the frame irises in on it.
        const handFrom = delta(leadDots[0], hand), C = localTo(center(hand), root);
        const R0 = Math.hypot(STAGE_W, STAGE_H) / 2 + 10;
        tracks.push(noRest(tr(11000, 420, E.linear, function (qq) {
          hand.style.opacity = qq > 0 ? 1 : 0;
          const pt = arcPoint(handFrom, { x: 0, y: 0 }, 90, E.inOut(qq));
          setXf(hand, pt.x, pt.y, lerp(28 / 48, 1, E.back(qq)));
        })));
        tracks.push(noRest(tr(11350, 520, E.inOut, function (p) {
          root.style.clipPath = 'circle(' + lerp(R0, 26, p).toFixed(1) + 'px at ' + C.x.toFixed(1) + 'px ' + C.y.toFixed(1) + 'px)';
          stage.setAttribute('data-bg', p >= 0.5 ? 'dark' : 'white');
        })));
        return tracks;
      }
    },
    {
      id: 'lead', durationMs: 15100, bg: 'dark',
      captions: [
        { at: 0, text: 'Every lead saw your ad.' },
        { at: 4600, text: 'Shoppers fill in your form on a phone or desktop.' },
        { at: 6400, text: 'Then completed your full form, often on a phone.' },
        { at: 8400, text: 'Each lead lands in your inbox.' },
        { at: 9750, text: 'Rarely, a shopper mistypes a detail or enters false info.' }
      ],
      build: function (root) {
        const eyebrow = q('#s4-eyebrow span'), beatA = q('.beat-a', root), beatB = q('.beat-b', root);
        const hero = q('#s4-hero'), dot = q('#s4-dot'), eye = q('#s4-eye'), lid = q('#s4-lid'), iris = q('#s4-iris');
        const visual = q('#s4-visual');
        const desktop = q('#s4-desktop'), phone = q('#s4-phone'), inbox = q('#s4-inbox'), duo = q('.duo', root);
        const fieldsP = qa('#s4-phone .f-input'), fieldsD = qa('#s4-desktop .f-input');
        const submitP = q('#s4-submit-p'), submitD = q('#s4-submit-d');
        const tapP = q('#s4-tap-p'), tapD = q('#s4-tap-d'), cursor = q('#s4-cursor');
        const cardP = q('#s4-card-p'), cardD = q('#s4-card-d');
        const checks = qa('.check-item', root), foot = q('#s4-foot'), under = q('#s4-under'), fl = q('#s4-flood');
        pinTo(tapP, submitP, duo);
        pinTo(tapD, submitD, duo);
        const fromP = delta(submitP, cardP), fromD = delta(submitD, cardD);
        const toVisual = delta(visual, eye), eyeScale = orient === 'portrait' ? 1.7 : 1.5;
        function lidAt(s) { lid.style.transform = 'scaleY(' + s.toFixed(4) + ')'; }
        function irisAt(x, y, s) { iris.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')'; }
        let ix = 0, iy = 0;
        const tracks = [
          // The lead dot from scene 3 opens into an eye. The dot is its iris.
          tr(0, 420, E.linear, function (qq) { dot.style.opacity = qq < 0.55 ? 1 : (1 - (qq - 0.55) / 0.45).toFixed(3); }),
          tr(60, 10, E.linear, function () { eye.style.opacity = 1; }),
          tr(60, 480, E.linear, function (qq) { lidAt(Math.max(0, E.back(qq))); }),
          tr(60, 540, E.linear, function (qq) { irisAt(0, 0, lerp(48 / 132, 1, E.back(qq))); })
        ];
        tracks.push.apply(tracks, heroTracks(hero, eyebrow, 240, 1300, 480));
        // The eye glances at each half of the word, quick ticks.
        [[700, -72, 0], [950, 72, 0], [1200, 0, 0]].forEach(function (s, i, all) {
          const from = i === 0 ? { x: 0, y: 0 } : { x: all[i - 1][1], y: all[i - 1][2] };
          tracks.push(noRest(tr(s[0], 150, E.out, function (p) { irisAt(lerp(from.x, s[1], p), lerp(from.y, s[2], p), 1); })));
        });
        // The eye moves aside for "Every lead saw your ad." and looks at it.
        tracks.push(tr(1300, 600, E.inOut, function (p) { setXf(eye, toVisual.x * p, toVisual.y * p, lerp(1, eyeScale, p)); }));
        tracks.push(rise(beatA, 1750));
        const look = orient === 'portrait' ? { x: -40, y: -46 } : { x: -86, y: -10 };
        tracks.push(tr(2350, 220, E.out, function (p) { irisAt(look.x * p, look.y * p, 1); }));
        tracks.push(tr(3150, 280, E.linear, function (qq) { lidAt(1 - 0.94 * E.pulse(qq)); }));
        tracks.push(tr(3550, 240, E.out, function (p) { irisAt(look.x * (1 - p), look.y * (1 - p), 1); }));
        tracks.push(fadeOut(beatA, 4300));
        tracks.push(tr(4300, 380, E.inOut, function (p) { lidAt(1 - p); eye.style.opacity = p < 0.8 ? 1 : ((1 - p) / 0.2).toFixed(3); }));
        // Beat B: both forms fill, each produces its own lead.
        tracks.push(rise(beatB, 4600), riseBack(desktop, 4450, 620, 60), riseBack(phone, 4550, 620, 60));
        const timesP = [[5100, 450], [5650, 500], [6250, 500], [6850, 400]];
        fieldsP.forEach(function (f, i) { tracks.push(typeText(f, timesP[i][0], timesP[i][1], f.getAttribute('data-value'))); });
        const targets = fieldsD.map(function (f) { return pointIn(f, 0.18, 0.5); }).concat([pointIn(submitD, 0.5, 0.5)]);
        pinAt(cursor, targets[0], duo);
        const rel = targets.map(function (t) { return { x: t.x - targets[0].x, y: t.y - targets[0].y }; });
        const cFrom = { x: 260, y: 220 };
        tracks.push(tr(4800, 260, E.out, function (p) { cursor.style.opacity = p; setXf(cursor, cFrom.x, cFrom.y, 1); }));
        const typeDur = [420, 450, 420, 300];
        let m = 4850;
        fieldsD.forEach(function (f, i) {
          const from = i === 0 ? cFrom : rel[i - 1];
          tracks.push(cursorMove(cursor, m, 260, from, rel[i]));
          tracks.push(cursorPress(cursor, m + 270, rel[i]));
          tracks.push(typeText(f, m + 320, typeDur[i], f.getAttribute('data-value')));
          m = m + 320 + typeDur[i] + 40;
        });
        tracks.push(cursorMove(cursor, m, 260, rel[3], rel[4]));
        tracks.push(cursorPress(cursor, m + 270, rel[4]));
        const pressD = m + 270;
        tracks.push(rise(inbox, 7300, 500));
        tracks.push(tr(7450, 260, E.out, function (p) { submitP.classList.toggle('is-pressed', p > 0 && p < 1); setXf(submitP, 0, 0, 1 - 0.03 * E.pulse(p)); }));
        tracks.push.apply(tracks, tapTracks(tapP, 7450));
        tracks.push(tr(pressD, 260, E.out, function (p) { submitD.classList.toggle('is-pressed', p > 0 && p < 1); setXf(submitD, 0, 0, 1 - 0.03 * E.pulse(p)); }));
        tracks.push.apply(tracks, tapTracks(tapD, pressD));
        function flyCard(card, from, t0) {
          tracks.push(tr(t0, 950, E.inOut, function (p) {
            const pt = arcPoint(from, { x: 0, y: 0 }, 120, p);
            card.style.opacity = Math.min(1, p * 2.5);
            setXf(card, pt.x, pt.y, 0.35 + 0.65 * p);
          }));
        }
        flyCard(cardP, fromP, 7650);
        flyCard(cardD, fromD, pressD + 200);
        checks.forEach(function (c, i) {
          const t0 = 9350 + i * 300;
          tracks.push(draw(q('path', c), t0, 450));
          tracks.push(rise(q('.check-text', c), t0 + 60, 450, 8));
        });
        // The footnote: small, muted, calm.
        tracks.push(fade(foot, 9750, 700));
        tracks.push(tr(9750, 700, E.out, function (p) { under.style.setProperty('--ul', p.toFixed(3)); }));
        // Exit: the first lead's dot floods the frame blue.
        tracks.push(noRest(flood(fl, root, localTo(center(q('.dot', cardP)), root), 14, 14550, 520, 'blue')));
        return tracks;
      }
    },
    {
      id: 'close', durationMs: 10400, bg: 'blue',
      captions: [
        { at: 0, text: 'You pay per click.' },
        { at: 650, text: 'About 6 in 10 clicks become leads.' },
        { at: 1300, text: 'Every lead sees your brand first.' },
        { at: 7100, text: 'Your brand. Your leads. Never resold.' }
      ],
      build: function (root) {
        const items = qa('.recap-item', root), tiles = qa('.tile', root), texts = qa('.recap-text', root);
        const wm = q('#s5-wordmark'), tag = q('#s5-tagline'), words = qa('.w', tag), tagDot = q('.tag-dot', tag), cta = q('#cta');
        const dot = q('#s5-dot'), mark = q('#s5-mark'), fl = q('#s5-flood'), r1 = q('#s5-r1'), r2 = q('#s5-r2');
        // P: the center of the radar mark inside the wordmark (40.25% across, half way down the image).
        const rw = rectOf(wm), rr = rectOf(root);
        const P = { x: rw.x - rr.x + rw.w * 0.4025, y: rw.y - rr.y + rw.h * 0.5 };
        const Pabs = { x: P.x + rr.x, y: P.y + rr.y };
        [dot, r1, r2].forEach(function (el) {
          const w = el === dot ? 48 : 600;
          el.style.left = (P.x - w / 2).toFixed(1) + 'px';
          el.style.top = (P.y - w / 2).toFixed(1) + 'px';
        });
        const M = rectOf(mark).w;
        mark.style.left = (P.x - 0.4925 * M).toFixed(1) + 'px';
        mark.style.top = (P.y - 0.5025 * M).toFixed(1) + 'px';
        mark.style.transformOrigin = (0.4925 * M).toFixed(1) + 'px ' + (0.5025 * M).toFixed(1) + 'px';
        wm.style.transformOrigin = (rw.w * 0.4025).toFixed(1) + 'px 50%';
        // The mark's rings span 94.25% of its image; the wordmark's O spans 26.17% of the wordmark.
        const sO = (0.2617 * rw.w) / (0.9425 * M);
        const tracks = [];
        // Recap: each line arrives with its scene's circle as a tile.
        items.forEach(function (it, i) {
          const t0 = 150 + i * 550, tile = tiles[i];
          tracks.push(pop(tile, t0, 440, 0));
          tracks.push(riseBack(texts[i], t0 + 80, 500, 24));
          if (i === 0) {
            const ring = q('.t-ring', tile), dotT = q('.t-dot', tile);
            tracks.push(tr(t0 + 120, 360, E.linear, function (qq) { dotT.style.transform = 'scale(' + Math.max(0, E.back(qq)).toFixed(4) + ')'; }));
            tracks.push(tr(t0 + 300, 600, E.out, function (p) { ring.style.opacity = p; ring.style.transform = 'scale(' + lerp(0.45, 1, p).toFixed(4) + ')'; }));
          } else if (i === 1) {
            qa('.t-pip', tile).forEach(function (pip, j) {
              const base = getComputedStyle(pip).transform;
              tracks.push(tr(t0 + 160 + j * 45, 280, E.linear, function (qq) {
                pip.style.opacity = qq > 0 ? 1 : 0;
                pip.style.transform = (base === 'none' ? '' : base + ' ') + 'scale(' + Math.max(0, E.back(qq)).toFixed(4) + ')';
              }));
            });
          } else {
            const tl = q('.t-lid', tile);
            tracks.push(tr(t0 + 1000, 280, E.linear, function (qq) { tl.style.transform = 'scaleY(' + (1 - 0.94 * E.pulse(qq)).toFixed(4) + ')'; }));
          }
        });
        // The lines step away and the tiles collapse into one dot.
        texts.forEach(function (t, i) { tracks.push(noRest(fadeOut(t, 4300 + i * 50, 300, -10))); });
        tiles.forEach(function (tile, i) {
          const c = center(tile), to = { x: Pabs.x - c.x, y: Pabs.y - c.y };
          tracks.push(noRest(tr(4420 + i * 80, 560, E.inOut, function (p) {
            const pt = arcPoint({ x: 0, y: 0 }, to, 50, p);
            tile.style.opacity = p < 0.82 ? 1 : ((1 - p) / 0.18).toFixed(3);
            setXf(tile, pt.x, pt.y, lerp(1, 48 / 132, p));
          })));
        });
        tracks.push(tr(4850, 320, E.linear, function (qq) { dot.style.opacity = qq > 0 ? 1 : 0; dot.style.transform = 'scale(' + Math.max(0, E.back(qq)).toFixed(4) + ')'; }));
        // The dot irises the frame to dark, then rings ripple out and the radar mark scales in around it.
        tracks.push(flood(fl, root, P, 24, 5050, 520, 'dark'));
        tracks.push(tr(5050, 520, E.inOut, function (p) { dot.style.boxShadow = '0 0 0 ' + (8 * (1 - p)).toFixed(2) + 'px #FFFFFF'; }));
        tracks.push(ripple(r1, 5500, 1000, 0.08, 1, 0.9), ripple(r2, 5750, 1000, 0.08, 1, 0.9));
        tracks.push(tr(5600, 560, E.out, function (p) { mark.style.opacity = p; mark.style.transform = 'scale(' + lerp(0.8, 1, p).toFixed(4) + ')'; }));
        tracks.push(tr(5750, 200, E.out, function (p) { dot.style.opacity = 1 - p; }));
        // The mark settles into the O of the wordmark.
        tracks.push(tr(6500, 620, E.inOut, function (p) { mark.style.transform = 'scale(' + lerp(1, sO, p).toFixed(4) + ')'; }));
        tracks.push(tr(6700, 450, E.out, function (p) { wm.style.opacity = p; wm.style.transform = 'scale(' + lerp(0.97, 1, p).toFixed(4) + ')'; }));
        tracks.push(tr(6950, 200, E.out, function (p) { mark.style.opacity = 1 - p; }));
        // Tagline word by word; the dot completes the sentence.
        words.forEach(function (w, i) { tracks.push(riseBack(w, 7150 + i * 70, 480, 30)); });
        tracks.push(tr(7650, 380, E.linear, function (qq) { tagDot.style.opacity = qq > 0 ? 1 : 0; tagDot.style.transform = 'scale(' + Math.max(0, E.back(qq)).toFixed(4) + ')'; }));
        tracks.push(rise(cta, 7900, 500));
        return tracks;
      },
      rest: function (root) { root.classList.add('is-rest'); }
    }
  ];

  const TOTAL = SCENES.reduce(function (s, sc) { return s + sc.durationMs; }, 0);
  const STARTS = SCENES.map(function (sc, i) { return SCENES.slice(0, i).reduce(function (s, x) { return s + x.durationMs; }, 0); });

  // ---------- Applying tracks ----------
  function applyAt(tracks, local) {
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (local < t.t0) continue;
      if (t.loop) {
        if (local >= t.t1) { t.apply(t.finalPhase, true); continue; }
        t.apply(((local - t.t0) % t.period) / t.period, true);
      } else {
        t.apply(t.ease(clamp((local - t.t0) / t.dur, 0, 1)));
      }
    }
  }
  function applyInitial(tracks) {
    for (let i = tracks.length - 1; i >= 0; i--) {
      const t = tracks[i];
      if (t.loop) t.apply(0, false); else t.apply(0);
    }
  }
  function applyRest(tracks) {
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.noRest) continue;
      if (t.loop) t.apply(t.finalPhase, true); else t.apply(1);
    }
  }
  function clearInline(root) {
    root.removeAttribute('style');
    root.classList.remove('is-rest');
    qa('[style]', root).forEach(function (el) { el.removeAttribute('style'); });
    qa('.is-focus, .is-pressed', root).forEach(function (el) { el.classList.remove('is-focus', 'is-pressed'); });
    qa('[data-value]', root).forEach(function (el) { el.textContent = el.getAttribute('data-value'); });
  }

  // ---------- Player state ----------
  let elapsed = 0, playing = false, raf = 0, last = 0, current = -1, ended = false;
  let captionShown = null;

  function setOrientation(next) {
    if (next === orient) return;
    orient = next;
    STAGE_W = next === 'portrait' ? 1080 : 1920;
    STAGE_H = next === 'portrait' ? 1920 : 1080;
    stage.setAttribute('data-orient', next);
    rebuild();
  }
  // Rebuild the active scene so every travel path is measured against the current layout.
  function rebuild() {
    if (current < 0) return;
    const i = current;
    current = -1;
    if (reduced) showRest(i); else render();
  }
  function fit() {
    const r = stageWrap.getBoundingClientRect();
    setOrientation(r.height > r.width ? 'portrait' : 'landscape');
    scale = Math.min(r.width / STAGE_W, r.height / STAGE_H) || 1;
    stage.style.setProperty('--scale', scale.toFixed(5));
  }

  function enter(i) {
    sceneEls.forEach(function (root, k) {
      if (k !== i && root.classList.contains('is-active')) {
        root.classList.remove('is-active');
        clearInline(root);
      }
    });
    current = i;
    const sc = SCENES[i], root = sceneEls[i];
    root.classList.add('is-active');
    clearInline(root);
    stage.setAttribute('data-bg', sc.bg);
    sc.tracks = sc.build(root);
    applyInitial(sc.tracks);
    stage.setAttribute('data-bg', sc.bg);
    segs.forEach(function (s, k) { if (k === i) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current'); });
    captionShown = null;
  }

  function setCaption(text) {
    if (text === captionShown) return;
    captionShown = text;
    captionEl.textContent = text;
  }

  function render() {
    const i = sceneIndexAt(elapsed);
    if (i !== current) enter(i);
    const sc = SCENES[i], local = elapsed - STARTS[i];
    applyAt(sc.tracks, local);
    let cap = sc.captions[0].text;
    for (let k = 0; k < sc.captions.length; k++) if (sc.captions[k].at <= local) cap = sc.captions[k].text;
    setCaption(cap);
    segs.forEach(function (s, k) {
      s.style.setProperty('--fill', clamp((elapsed - STARTS[k]) / SCENES[k].durationMs, 0, 1).toFixed(4));
    });
  }
  function sceneIndexAt(t) {
    for (let i = 0; i < SCENES.length; i++) if (t < STARTS[i] + SCENES[i].durationMs) return i;
    return SCENES.length - 1;
  }

  function tick(now) {
    if (!playing) return;
    const dt = clamp(now - last, 0, 100);   // rAF timestamps can trail performance.now(), never run the clock backwards
    last = now;
    elapsed += dt;
    if (elapsed >= TOTAL) { elapsed = TOTAL - 1; render(); finish(); return; }
    render();
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (reduced) return;
    if (ended) { elapsed = 0; current = -1; ended = false; replayInline.hidden = true; }
    playing = true;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    updatePlayButton();
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    updatePlayButton();
  }
  function finish() {
    playing = false; ended = true;
    cancelAnimationFrame(raf);
    replayInline.hidden = false;
    updatePlayButton();
  }
  function updatePlayButton() {
    const label = ended ? 'Replay' : (playing ? 'Pause' : 'Play');
    btn.playText.textContent = label;
    btn.play.setAttribute('aria-label', label + ' (Space)');
    q('use', btn.play).setAttribute('href', ended ? '#i-replay' : (playing ? '#i-pause' : '#i-play'));
  }
  function goto(i) {
    i = clamp(i, 0, SCENES.length - 1);
    ended = false; replayInline.hidden = true;
    elapsed = STARTS[i];
    current = -1;
    if (reduced) { showRest(i); return; }
    render();
    play();
  }
  // Reduced motion: a scene in its resting state, exits and hand offs skipped.
  function showRest(i) {
    enter(i);
    applyRest(SCENES[i].tracks);
    if (SCENES[i].rest) SCENES[i].rest(sceneEls[i]);
    stage.setAttribute('data-bg', i === SCENES.length - 1 ? 'dark' : SCENES[i].bg);
    setCaption(SCENES[i].captions[SCENES[i].captions.length - 1].text);
    segs.forEach(function (s, k) { s.style.setProperty('--fill', k <= i ? '1' : '0'); });
    btn.prev.disabled = i === 0;
    btn.next.disabled = i === SCENES.length - 1;
  }
  function replay() {
    ended = false; replayInline.hidden = true;
    elapsed = 0; current = -1;
    if (reduced) { showRest(0); return; }
    play();
  }
  function toggle() {
    if (reduced) return;
    if (playing) pause(); else play();
  }
  function step(d) { goto((current < 0 ? 0 : current) + d); }

  // ---------- Captions ----------
  let captionsOn = true;
  function setCaptions(on) {
    captionsOn = on;
    document.body.classList.toggle('captions-off', !on);
    btn.captions.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.captions.setAttribute('aria-label', 'Captions ' + (on ? 'on' : 'off') + ' (C)');
    rebuild();   // the content box grows when captions are off
  }

  // ---------- Wiring ----------
  btn.play.addEventListener('click', function () { if (ended) replay(); else toggle(); });
  btn.prev.addEventListener('click', function () { step(-1); });
  btn.next.addEventListener('click', function () { step(1); });
  btn.replay.addEventListener('click', replay);
  replayInline.addEventListener('click', replay);
  btn.captions.addEventListener('click', function () { setCaptions(!captionsOn); });
  segs.forEach(function (s) { s.addEventListener('click', function () { goto(Number(s.getAttribute('data-index'))); }); });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.key) {
      case ' ': if (tag === 'BUTTON') return; e.preventDefault(); if (ended) replay(); else toggle(); break;
      case 'ArrowLeft': e.preventDefault(); step(-1); break;
      case 'ArrowRight': e.preventDefault(); step(1); break;
      case 'r': case 'R': replay(); break;
      case 'c': case 'C': setCaptions(!captionsOn); break;
    }
  });
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) {
    // Re-measure the active scene once Sora and Outfit have loaded so paths and the halftone land exactly.
    document.fonts.ready.then(rebuild);
  }

  // ---------- Start ----------
  const params = new URLSearchParams(window.location.search);
  const showControls = params.has('controls') ? params.get('controls') !== '0' : CONFIG.controls;
  if (reduced) document.body.classList.add('reduced');
  if (!showControls) {
    document.body.classList.add('no-controls');
    if (!reduced) q('#controls').hidden = true;
  }
  const startCaptions = params.has('captions') ? params.get('captions') !== '0' : CONFIG.captions;
  if (!startCaptions) setCaptions(false);
  fit();
  if (reduced) {
    showRest(0);
  } else {
    elapsed = 0;
    render();
    play();
  }

  // Exposed for tests and frame capture only.
  window.__goal = {
    get elapsed() { return elapsed; }, get playing() { return playing; }, get current() { return current; },
    get ended() { return ended; }, get reduced() { return reduced; }, get orient() { return orient; }, total: TOTAL,
    starts: STARTS.slice(),
    scenes: SCENES.map(function (s) { return { id: s.id, durationMs: s.durationMs, captions: s.captions }; }),
    seek: function (t) { pause(); elapsed = clamp(t, 0, TOTAL - 1); current = -1; render(); },
    showRest: function (i) { pause(); showRest(i); }
  };
})();
