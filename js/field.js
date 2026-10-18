/* Hero field: a ring of radially pointing pills that drifts on its own and follows the cursor.
   Canvas 2D, no libraries. Particles sit on a Poisson-disk layout and are driven by simplex noise. */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas.field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lightMq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  var finePointer = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* BEGIN-PURE */

  /* 3D simplex noise (Stefan Gustavson's public-domain algorithm). Output is roughly -1..1. */
  var GRAD3 = [
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ];
  var perm = new Uint8Array(512);
  var permMod12 = new Uint8Array(512);
  (function seedNoise() {
    var p = new Uint8Array(256);
    var i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permMod12[i] = perm[i] % 12;
    }
  })();

  var F3 = 1 / 3;
  var G3 = 1 / 6;

  function snoise(xin, yin, zin) {
    var n0, n1, n2, n3;
    var s = (xin + yin + zin) * F3;
    var i = Math.floor(xin + s);
    var j = Math.floor(yin + s);
    var k = Math.floor(zin + s);
    var t = (i + j + k) * G3;
    var x0 = xin - (i - t);
    var y0 = yin - (j - t);
    var z0 = zin - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var x1 = x0 - i1 + G3;
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;
    var x2 = x0 - i2 + 2 * G3;
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;
    var x3 = x0 - 1 + 3 * G3;
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;
    var ii = i & 255;
    var jj = j & 255;
    var kk = k & 255;
    var gi, t0, t1, t2, t3;

    t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
      gi = permMod12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi] * x0 + GRAD3[gi + 1] * y0 + GRAD3[gi + 2] * z0);
    }
    t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
      gi = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi] * x1 + GRAD3[gi + 1] * y1 + GRAD3[gi + 2] * z1);
    }
    t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
      gi = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi] * x2 + GRAD3[gi + 1] * y2 + GRAD3[gi + 2] * z2);
    }
    t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
      gi = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n3 = t3 * t3 * (GRAD3[gi] * x3 + GRAD3[gi + 1] * y3 + GRAD3[gi + 2] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  }

  /* Cheap smooth 1D noise in 0..1: two sines with incommensurate frequencies. */
  function n1d(t) {
    return 0.5 + 0.3 * Math.sin(t * 1.1) + 0.2 * Math.sin(t * 1.8393 + 1.3);
  }

  function smoothstep(e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  /* Bridson Poisson-disk sampling over the rect [x0, x0 + w] x [y0, y0 + h]. */
  function poisson(x0, y0, w, h, r, tries) {
    var cell = r / Math.SQRT2;
    var gw = Math.ceil(w / cell);
    var gh = Math.ceil(h / cell);
    var cap = gw * gh + 1;
    var grid = new Int32Array(cap);
    var xs = new Float32Array(cap);
    var ys = new Float32Array(cap);
    var active = new Int32Array(cap);
    var n = 0;
    var activeN = 0;
    var r2 = r * r;
    var i;
    for (i = 0; i < cap; i++) grid[i] = -1;

    function add(px, py) {
      xs[n] = px;
      ys[n] = py;
      grid[Math.floor((py - y0) / cell) * gw + Math.floor((px - x0) / cell)] = n;
      active[activeN++] = n;
      n++;
    }

    add(x0 + Math.random() * w, y0 + Math.random() * h);

    while (activeN > 0) {
      var ai = Math.floor(Math.random() * activeN);
      var base = active[ai];
      var bx = xs[base];
      var by = ys[base];
      var found = false;
      for (var a = 0; a < tries; a++) {
        var ang = Math.random() * 6.283185307179586;
        var rad = r * (1 + Math.random());
        var nx = bx + Math.cos(ang) * rad;
        var ny = by + Math.sin(ang) * rad;
        if (nx < x0 || nx >= x0 + w || ny < y0 || ny >= y0 + h) continue;
        var gx = Math.floor((nx - x0) / cell);
        var gy = Math.floor((ny - y0) / cell);
        var ok = true;
        var cy0 = gy - 2 < 0 ? 0 : gy - 2;
        var cy1 = gy + 2 >= gh ? gh - 1 : gy + 2;
        var cx0 = gx - 2 < 0 ? 0 : gx - 2;
        var cx1 = gx + 2 >= gw ? gw - 1 : gx + 2;
        for (var cy = cy0; cy <= cy1 && ok; cy++) {
          for (var cx = cx0; cx <= cx1; cx++) {
            var gj = grid[cy * gw + cx];
            if (gj >= 0) {
              var ddx = xs[gj] - nx;
              var ddy = ys[gj] - ny;
              if (ddx * ddx + ddy * ddy < r2) { ok = false; break; }
            }
          }
        }
        if (ok) {
          if (n < cap) add(nx, ny);
          found = true;
          break;
        }
      }
      if (!found) {
        active[ai] = active[activeN - 1];
        activeN--;
      }
    }
    return { xs: xs, ys: ys, n: n };
  }

  /* END-PURE */

  /* Colours */

  var DARK = [[0x71, 0x89, 0xff], [0x30, 0x74, 0xf9], [0x00, 0x00, 0x00]];
  var LIGHT = [[0x2c, 0x64, 0xed], [0xf8, 0x42, 0x42], [0xff, 0xcf, 0x03]];
  var light = false;
  var pal = DARK;

  function readTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light') light = true;
    else if (attr === 'dark') light = false;
    else light = !!(lightMq && lightMq.matches);
    pal = light ? LIGHT : DARK;
  }

  /* State */

  var dpr = 1;
  var W = 0;
  var H = 0;
  var U = 1;
  var N = 0;
  var refX, refY, posX, posY, scl, vel, fxA, fyA;
  var ringX = 0;
  var ringY = 0;
  var T = 0;

  var ptrActive = false;
  var ptrX = 0;
  var ptrY = 0;

  var visible = true;
  var raf = 0;
  var lastTs = null;
  var resizeTimer = 0;

  function build() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    N = 0;
    if (W < 1 || H < 1) return;

    U = Math.min(H, W * 1.15) / 0.451;
    var hx = W / 2 / U;
    var hy = H / 2 / U;
    var pad = 0.04;
    var pts = poisson(-hx - pad, -hy - pad, 2 * (hx + pad), 2 * (hy + pad), finePointer ? 0.0187 : 0.025, 20);
    N = pts.n;
    refX = pts.xs;
    refY = pts.ys;
    posX = new Float32Array(N);
    posY = new Float32Array(N);
    scl = new Float32Array(N);
    vel = new Float32Array(N);
    fxA = new Float32Array(N);
    fyA = new Float32Array(N);
  }

  /* Ring wander and cursor follow. k is frame-time in 60fps frames. */
  function moveRing(k) {
    var a = (n1d(T * 0.66 + 94.234) - 0.5) * 2;
    var b = (n1d(T * 0.75 + 21.028) - 0.5) * 2;
    var tx, ty, rate;
    var over = false;
    var cx = 0;
    var cy = 0;
    if (ptrActive && U > 0) {
      var rect = canvas.getBoundingClientRect();
      if (ptrX >= rect.left && ptrX <= rect.right && ptrY >= rect.top && ptrY <= rect.bottom) {
        over = true;
        cx = (ptrX - rect.left - W / 2) / U;
        cy = -(ptrY - rect.top - H / 2) / U;
      }
    }
    if (over) {
      tx = cx * 0.875 + a * 0.1;
      ty = cy * 0.875 + b * 0.1;
      rate = 0.02 * k;
    } else {
      tx = a * 0.2;
      ty = b * 0.1;
      rate = 0.01 * k;
    }
    ringX += (tx - ringX) * rate;
    ringY += (ty - ringY) * rate;
  }

  function simulate(k) {
    var time = T * 0.5;
    var R = 0.175 + 0.03 * Math.sin(T) + 0.02 * Math.cos(3 * T);
    var w = 0.107;
    var w2 = 0.05;
    var D = 0.15;
    var decay = Math.pow(0.8, k);
    var sMix = 1 - decay;
    var Ra = R - 2 * w;
    var Rb = R - 2 * w2;
    var Rc = R + w;
    var Rd = R + w2;
    var tm35 = T * 0.35;
    for (var i = 0; i < N; i++) {
      var rx = refX[i];
      var ry = refY[i];
      var ddx = rx - ringX;
      var ddy = ry - ringY;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      var n0 = snoise(rx * 0.2 + 18.49, ry * 0.2 + 72.97, time * 0.5) * 0.005;
      var d1x = ddx + n0;
      var d1y = ddy + n0;
      var dist1 = Math.sqrt(d1x * d1x + d1y * d1y);

      var t = smoothstep(Ra, R, dist) - smoothstep(R, Rc, dist1);
      var t2 = smoothstep(Rb, R, dist) - smoothstep(R, Rd, dist1);
      var t3 = smoothstep(Rd, R, dist);
      t = t > 0 ? t * t : 0;
      t2 = t2 > 0 ? t2 * t2 * t2 : 0;
      t += t2 * 3;
      t += t3 * 0.4;
      if (t3 > 0.001) t += snoise(rx * 30 + 11.49, ry * 30 + 12.97, time * 0.5) * t3 * 0.5;
      var nS = (snoise(rx * 2 + 18.49, ry * 2 + 72.97, time * 0.5) + 1.5) * 0.5;
      t += nS * nS * 0.6;

      var dx = snoise(rx * 4 + 88.49, ry * 4 + 32.44, tm35) * 0.03 +
        snoise(rx * 20 + 18.49, ry * 20 + 72.97, time * 0.5) * 0.005;
      var dy = snoise(rx * 4 + 50.90, ry * 4 + 120.95, tm35) * 0.03 +
        snoise(rx * 20 + 50.90, ry * 20 + 120.95, time * 0.5) * 0.005;
      var cd = dist < 1 ? dist : 1;
      dx += Math.sin(rx * 20 + time * 4) * 0.02 * cd;
      dy += Math.cos(ry * 20 + time * 3) * 0.02 * cd;

      var pull = t2 > 0 ? Math.pow(t2, 0.75) * D * k : 0;
      var px = posX[i] * decay - (ringX - (rx + dx)) * pull;
      var py = posY[i] * decay - (ringY - (ry + dy)) * pull;
      posX[i] = px;
      posY[i] = py;

      var sc = scl[i];
      sc += (t - sc) * sMix;
      scl[i] = sc;

      fxA[i] = rx + dx + px * 0.25;
      fyA[i] = ry + dy + py * 0.25;
      vel[i] = vel[i] * Math.pow(0.5, k) + sc * 0.25;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (N === 0) return;
    var c1 = pal[0];
    var c2 = pal[1];
    var c3 = pal[2];
    var sizeK = W / 1280;
    sizeK = sizeK < 0.8 ? 0.8 : (sizeK > 1.4 ? 1.4 : sizeK);
    var halfW = W / 2;
    var halfH = H / 2;
    var h = 0.8;
    ctx.lineCap = 'round';
    for (var i = 0; i < N; i++) {
      var sc = scl[i];
      var alpha = smoothstep(0.1, 0.2, sc);
      if (alpha < 0.01) continue;
      var fx = fxA[i];
      var fy = fyA[i];
      var angle = Math.atan2(fy - ringY, fx - ringX) + snoise(fx * 10 + 18.49, fy * 10 + 72.97, T * 0.85) * 0.5;
      var nc = (snoise(fx * 2 + 74.66, fy * 2 + 91.56, T * 0.5) + 1) * 0.5;
      var progress = smoothstep(0, 0.75, nc * nc);
      var r, g, b, m;
      if (progress < h) {
        m = progress / h;
        r = c1[0] + (c2[0] - c1[0]) * m;
        g = c1[1] + (c2[1] - c1[1]) * m;
        b = c1[2] + (c2[2] - c1[2]) * m;
      } else {
        m = (progress - h) / (1 - h);
        r = c2[0] + (c3[0] - c2[0]) * m;
        g = c2[1] + (c3[1] - c2[1]) * m;
        b = c2[2] + (c3[2] - c2[2]) * m;
      }
      if (light) {
        var v = vel[i];
        v = v < 0 ? 0 : (v > 1 ? 1 : v);
        r *= v; g *= v; b *= v;
      }
      var L = sc * 1.7 * sizeK;
      var thick = 0.4 * L;
      var half = (L - thick) / 2;
      var sa = -angle;
      var ca = Math.cos(sa) * half;
      var sn = Math.sin(sa) * half;
      var sx = halfW + fx * U;
      var sy = halfH - fy * U;
      ctx.strokeStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + alpha.toFixed(3) + ')';
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(sx - ca, sy - sn);
      ctx.lineTo(sx + ca, sy + sn);
      ctx.stroke();
    }
  }

  /* Reduced motion: settle at T = 0 with the ring centred, then draw one frame. */
  function settleAndDraw() {
    T = 0;
    ringX = 0;
    ringY = 0;
    for (var s = 0; s < 90; s++) simulate(1);
    draw();
  }

  function frame(ts) {
    raf = 0;
    if (lastTs === null) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;
    T += dt;
    var k = dt * 60;
    moveRing(k);
    simulate(k);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    var want = !reduce && visible && !document.hidden && N > 0;
    if (want && !raf) {
      lastTs = null;
      raf = requestAnimationFrame(frame);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
    }
  }

  function rebuild() {
    build();
    if (reduce) settleAndDraw();
    sync();
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      var rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - W) >= 0.5 || Math.abs(rect.height - H) >= 0.5) rebuild();
    }, 150);
  }

  function onTheme() {
    readTheme();
    if (!raf) draw();
  }

  readTheme();
  rebuild();

  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);

  if (window.MutationObserver) {
    new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (lightMq) {
    if (lightMq.addEventListener) lightMq.addEventListener('change', onTheme);
    else if (lightMq.addListener) lightMq.addListener(onTheme);
  }

  if (!reduce) {
    if (window.IntersectionObserver) {
      visible = false;
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      }, { rootMargin: '100px 0px' }).observe(canvas);
    }
    document.addEventListener('visibilitychange', sync);

    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        ptrX = e.clientX;
        ptrY = e.clientY;
        ptrActive = true;
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', function () { ptrActive = false; });
      window.addEventListener('blur', function () { ptrActive = false; });
    }
  }
})();
