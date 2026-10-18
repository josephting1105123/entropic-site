/* Entropy field: a grid of dashes that starts hot (random) and cools into a slow flow.
   The pointer stirs it, and on wide screens the logo mark stays ordered. */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas.field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lightMq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  var TWO_PI = Math.PI * 2;

  var dpr = 1;
  var W = 0;
  var H = 0;
  var N = 0;
  var X, Y, A0, SPIN, OX, OY, HEAT, DELAY, MARK;
  var bucketBuf = [];
  var bucketCount = [0, 0, 0, 0, 0, 0];

  var styles = ['', '', '', '', '', ''];
  var introElapsed = 0;
  var firstBuild = true;

  var visible = true;
  var active = false;
  var raf = 0;
  var lastTs = null;
  var lastDrawT = 0;

  var lastPointerTime = -100000;
  var hasLast = false;
  var lastPX = 0;
  var lastPY = 0;
  var lastEventTime = 0;

  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  /* Colours */

  function parseColor(str, fallback) {
    var s = (str || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    return fallback;
  }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function isLight() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'light';
    return !!(lightMq && lightMq.matches);
  }

  function readColors() {
    var cs = getComputedStyle(root);
    var light = isLight();
    var text3 = parseColor(cs.getPropertyValue('--text-3'), [144, 144, 144]);
    var accent = parseColor(cs.getPropertyValue('--accent'), [34, 197, 94]);
    styles[0] = rgba(text3, light ? 0.38 : 0.42);
    styles[1] = rgba(accent, 0.25);
    styles[2] = rgba(accent, 0.45);
    styles[3] = rgba(accent, 0.65);
    styles[4] = rgba(accent, 0.85);
    styles[5] = rgba(accent, 0.95);
  }

  /* Geometry */

  var MARK_RECTS = [[14, 12, 36, 8], [14, 28, 26, 8], [14, 44, 36, 8]];

  function build() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var sp = W < 600 ? 24 : 20;
    var cols = Math.max(1, Math.ceil(W / sp));
    var rows = Math.max(1, Math.ceil(H / sp));
    N = cols * rows;

    X = new Float32Array(N);
    Y = new Float32Array(N);
    A0 = new Float32Array(N);
    SPIN = new Float32Array(N);
    OX = new Float32Array(N);
    OY = new Float32Array(N);
    HEAT = new Float32Array(N);
    DELAY = new Float32Array(N);
    MARK = new Uint8Array(N);

    // Mark box in canvas px; only on wide screens.
    var useMark = W >= 900;
    var S = 0, mLeft = 0, mTop = 0, u = 0;
    var boxes = [];
    if (useMark) {
      S = Math.min(340, W * 0.28, H * 0.62);
      var right = (W + Math.min(W, 1120)) / 2 - 48;
      mLeft = right - S;
      mTop = (H - S) / 2;
      u = S / 48;
      for (var r = 0; r < MARK_RECTS.length; r++) {
        var q = MARK_RECTS[r];
        boxes.push([mLeft + (q[0] - 8) * u, mTop + (q[1] - 8) * u, mLeft + (q[0] - 8 + q[2]) * u, mTop + (q[1] - 8 + q[3]) * u]);
      }
    }

    var intro = firstBuild && !reduce;
    var i = 0;
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var x = (col + 0.5) * sp + (Math.random() * 2 - 1) * 0.35 * sp;
        var y = (row + 0.5) * sp + (Math.random() * 2 - 1) * 0.35 * sp;
        X[i] = x;
        Y[i] = y;
        A0[i] = Math.random() * TWO_PI;
        SPIN[i] = Math.random() * 2 - 1;
        var od = Math.random() * TWO_PI;
        var ol = Math.random() * 9;
        OX[i] = Math.cos(od) * ol;
        OY[i] = Math.sin(od) * ol;
        var inMark = 0;
        for (var b = 0; b < boxes.length; b++) {
          var bx = boxes[b];
          if (x >= bx[0] && x <= bx[2] && y >= bx[1] && y <= bx[3]) {
            inMark = 1;
            break;
          }
        }
        MARK[i] = inMark;
        HEAT[i] = intro ? 1 : 0;
        DELAY[i] = intro ? 200 + (x / W) * 900 : 0;
        i++;
      }
    }
    if (!intro) introElapsed = 100000;
    firstBuild = false;

    bucketBuf = [];
    for (var k = 0; k < 6; k++) bucketBuf.push(new Float32Array(N * 4));
  }

  /* Drawing */

  function draw(t) {
    lastDrawT = t;
    ctx.clearRect(0, 0, W, H);
    var c = bucketCount;
    c[0] = c[1] = c[2] = c[3] = c[4] = c[5] = 0;
    var spinT = t * 0.0015;
    var tx = t * 0.00012;
    var ty = t * 0.00009;

    for (var i = 0; i < N; i++) {
      var h = HEAT[i];
      var x = X[i];
      var y = Y[i];
      var inMark = MARK[i] === 1;
      var ord = inMark ? 0 : 0.55 * Math.sin(x * 0.0045 + tx) + 0.35 * Math.cos(y * 0.006 - ty);
      var angle = ord + (A0[i] + SPIN[i] * spinT - ord) * h;
      var px = x + OX[i] * h;
      var py = y + OY[i] * h;
      var half = ((inMark ? 12 : 7) + 4 * h) * 0.5;
      var dx = Math.cos(angle) * half;
      var dy = Math.sin(angle) * half;

      var b;
      if (inMark && h < 0.25) {
        b = 5;
      } else if (h < 0.08) {
        b = 0;
      } else {
        b = 1 + Math.min(3, Math.floor((h - 0.08) / 0.23));
      }
      var buf = bucketBuf[b];
      var o = c[b] * 4;
      buf[o] = px - dx;
      buf[o + 1] = py - dy;
      buf[o + 2] = px + dx;
      buf[o + 3] = py + dy;
      c[b]++;
    }

    ctx.lineCap = 'round';
    for (var bk = 0; bk < 6; bk++) {
      var n = c[bk];
      if (!n) continue;
      var arr = bucketBuf[bk];
      ctx.strokeStyle = styles[bk];
      ctx.lineWidth = bk === 5 ? 2 : 1.4;
      ctx.beginPath();
      for (var s = 0; s < n; s++) {
        var p = s * 4;
        ctx.moveTo(arr[p], arr[p + 1]);
        ctx.lineTo(arr[p + 2], arr[p + 3]);
      }
      ctx.stroke();
    }
  }

  /* Simulation */

  function disturb(px, py, energy, R, scale) {
    var r2 = R * R;
    var amp = energy * 0.9 * scale;
    for (var i = 0; i < N; i++) {
      var dx = X[i] - px;
      if (dx > R || dx < -R) continue;
      var dy = Y[i] - py;
      var d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      var f = 1 - Math.sqrt(d2) / R;
      var nh = HEAT[i] + amp * f * f;
      HEAT[i] = nh > 1 ? 1 : nh;
    }
  }

  function frame(ts) {
    raf = 0;
    if (!active) return;
    var dt = lastTs === null ? 16.67 : Math.min(50, ts - lastTs);
    if (dt < 0) dt = 16.67;
    lastTs = ts;
    var k = dt / 16.67;
    introElapsed += dt;

    // Idle ghost, so phones and still mice see something move.
    if (nowMs() - lastPointerTime > 2500) {
      var gx = W * (0.5 + 0.38 * Math.sin(ts * 0.00031));
      var gy = H * (0.5 + 0.32 * Math.sin(ts * 0.00047 + 1.3));
      disturb(gx, gy, 0.22, 120, k);
    }

    var d1 = Math.pow(0.955, k);
    var d2 = Math.pow(0.93, k);
    for (var i = 0; i < N; i++) {
      if (introElapsed < DELAY[i]) continue;
      HEAT[i] *= MARK[i] === 1 ? d2 : d1;
    }

    draw(ts);
    raf = requestAnimationFrame(frame);
  }

  function updateActive() {
    var want = !reduce && visible && !document.hidden;
    if (want && !active) {
      active = true;
      lastTs = null;
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (!want && active) {
      active = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  }

  function onPointer(e) {
    if (!active) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      hasLast = false;
      return;
    }
    var now = nowMs();
    var speed = 0;
    if (hasLast && now - lastEventTime < 200) {
      var dx = x - lastPX;
      var dy = y - lastPY;
      speed = Math.sqrt(dx * dx + dy * dy);
    }
    hasLast = true;
    lastPX = x;
    lastPY = y;
    lastEventTime = now;
    lastPointerTime = now;
    var energy = Math.min(1, speed / 40);
    if (energy > 0) disturb(x, y, energy, e.pointerType === 'touch' ? 110 : 130, 1);
  }

  /* Wiring */

  function refreshStatic() {
    readColors();
    if (reduce || !active) draw(reduce ? 0 : lastDrawT);
  }

  var resizeTimer = 0;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      var rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - W) < 0.5 && Math.abs(rect.height - H) < 0.5) return;
      build();
      if (reduce || !active) draw(reduce ? 0 : lastDrawT);
    }, 150);
  }

  readColors();
  build();
  if (reduce) draw(0);

  window.addEventListener('resize', onResize);

  if (window.MutationObserver) {
    new MutationObserver(refreshStatic).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (lightMq) {
    if (lightMq.addEventListener) lightMq.addEventListener('change', refreshStatic);
    else if (lightMq.addListener) lightMq.addListener(refreshStatic);
  }

  if (!reduce) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('visibilitychange', updateActive);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        updateActive();
      }).observe(canvas);
    }
    updateActive();
  }
})();
