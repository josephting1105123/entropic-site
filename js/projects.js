/* projects.js - /projects/ only. The top bar and the Projects drawer wear the look of
   whatever zone is under the bar: the footer (the plain shell) or a project row
   (its subsite shell, tagged with the row's data-product, plus data-band so the
   bar takes the band's --card colour). css/projects.css does the styling; this file
   only sets the tags.
   Two layouts, one bar:
   - Horizontal (html.is-hscroll, the default): the six rows are full-screen panels
     in a sticky track, followed by a clone of the first. Vertical scroll slides the
     track left; css/projects.css snaps each panel to a .hs-snap span this file
     creates. The scroll position is a panel index f (0 to n); the bar mixes panel
     floor(f) with the next one by f's fraction. Resting on the clone (OffBridge
     again) jumps instantly back to the real first panel, so the loop has no seam.
     The footer is a fixed strip there, not a scroll stop. Off when
     prefers-reduced-motion is set or the browser cannot transform.
   - Stacked (no JS, or horizontal off): the rows stack as before. p is how far the
     next zone has risen from the bottom of the viewport (0) to the bar's lower edge
     (1), over a distance no longer than the current zone is tall, rescaled when the
     page ends before the next zone reaches the bar so the bar always ends on one
     zone's colour.
   The bar follows the scroll rather than waiting for the next zone to arrive:
   - Background: scrubbed every frame. The bar's inline background-color is the colour
     of the zone under the bar mixed with the next zone's colour by p. Zone colours
     are read from a hidden probe bar that is tagged like each zone (cached, cleared
     when the theme changes).
   - Fonts, shapes and the rest: cannot animate, so they switch once, when p crosses
     50%. .is-swapping fades the bar's contents out, the tags change SWAP_MS later
     (for whichever zone is the target by then), then the contents fade back in.
   Reduced motion and the first run apply the tags at once. The drawer is tagged
   immediately when the menu button is clicked, with no fade, and is left alone
   while it is open. */
(function () {
  'use strict';

  var bar = document.querySelector('.topbar');
  if (!bar) return;

  // Zones in document order. product null = the shell look; band true = a project row.
  var zones = [];
  function addZone(el, band) {
    if (!el) return;
    var product = band ? el.getAttribute('data-product') : null;
    zones.push({
      el: el,
      product: product || null,
      band: band,
      key: (product || null) + '|' + (band ? 'band' : '')
    });
  }
  var rows = document.querySelectorAll('.apps .project');
  for (var i = 0; i < rows.length; i++) addZone(rows[i], true);
  addZone(document.querySelector('footer.footer'), false);
  if (!rows.length) return;

  // Horizontal mode. Panels are the zones minus the footer; hp is the panels as the
  // horizontal layout sees them, plus the loop clone while enabled. enable() runs at
  // the bottom of the file, once the state below it exists.
  var root = document.documentElement;
  var hs = document.getElementById('hs');
  var pin = hs ? hs.querySelector('.hs-pin') : null;
  var track = hs ? hs.querySelector('.hs-track') : null;
  var panels = [];
  for (var pz = 0; pz < zones.length; pz++) {
    if (zones[pz].el.tagName !== 'FOOTER') panels.push(zones[pz]);
  }
  var pn = panels.length;
  var hp = panels;
  var clone = null;
  var hscroll = false;
  var snaps = [];
  var step = 0;

  function wantH() {
    if (!hs || !pin || !track || !('transform' in track.style)) return false;
    if (!(window.CSS && CSS.supports && CSS.supports('height', '100svh') &&
        CSS.supports('overflow', 'clip'))) return false;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Height of one panel step, from the first snap span; each span sits k steps down.
  function layout() {
    if (!hscroll || !snaps.length) return;
    step = snaps[0].getBoundingClientRect().height;
    for (var k = 0; k < snaps.length; k++) snaps[k].style.top = (k * step) + 'px';
  }

  // Panel position, 0 to n (n = the clone): how many steps the bar's lower edge is below the top of .hs.
  function hsProgress() {
    if (!(step > 0)) return 0;
    var barBottom = bar.getBoundingClientRect().bottom;
    var v = (barBottom - hs.getBoundingClientRect().top) / step;
    return Math.max(0, Math.min(hp.length - 1, v));
  }

  function paint() {
    if (!hscroll) return;
    var f = hsProgress();
    track.style.transform = 'translate3d(' + (-f * pin.getBoundingClientRect().width) + 'px,0,0)';
  }

  function scrollTopFor(k) {
    var barBottom = bar.getBoundingClientRect().bottom;
    return window.scrollY + hs.getBoundingClientRect().top - barBottom + k * step;
  }

  function goTo(k, smooth) {
    jumpTo(scrollTopFor(k), smooth);
  }

  function jumpTo(top, smooth) {
    try {
      window.scrollTo({ top: top, left: 0, behavior: smooth ? 'smooth' : 'instant' });
    } catch (e) {
      window.scrollTo(0, top);
    }
  }

  function hashIndex() {
    var id = window.location.hash.replace(/^#/, '');
    if (!id) return -1;
    for (var k = 0; k < pn; k++) if (panels[k].el.id === id) return k;
    return -1;
  }

  function applyHash() {
    if (!hscroll) return;
    var k = hashIndex();
    if (k >= 0) goTo(k, false);
  }

  // Tab must not land on a link in a panel that is off screen.
  function onFocusIn(e) {
    if (!hscroll) return;
    var cur = Math.round(hsProgress());
    for (var k = 0; k < pn; k++) {
      if (panels[k].el.contains(e.target)) {
        if (k !== cur) goTo(k, true);
        return;
      }
    }
  }

  // Wheel and trackpad: one gesture moves one panel. Native snapping alone treats a
  // short flick as "nearest" and lands back on the same panel, so in horizontal mode
  // the wheel is taken over (touch, keyboard and the scrollbar stay with CSS snap).
  // A gesture ends after a pause or when the delta jumps up again; once it has moved
  // a panel the rest of it, trackpad momentum included, is swallowed.
  var WHEEL_GAP = 160;
  var WHEEL_STEP = 30;
  var wheelAcc = 0;
  var wheelLast = 0;
  var wheelPrev = 0;
  var wheelSpent = false;
  var wheelMoving = false;
  var waitToken = 0;

  // Hold new moves until the scroll we started reaches its target (1s at most).
  function waitFor(target) {
    var t0 = Date.now();
    var token = ++waitToken;
    wheelMoving = true;
    function poll() {
      if (token !== waitToken) return;
      if (Math.abs(window.scrollY - target) <= 1 || Date.now() - t0 > 1000) {
        wheelMoving = false;
        // A wheel step onto the clone wraps at once, without waiting for scrollend.
        if (hscroll && clone && Math.abs(target - scrollTopFor(pn)) < 1) wrapIfAtClone();
        return;
      }
      window.requestAnimationFrame(poll);
    }
    window.requestAnimationFrame(poll);
  }

  // True when the panel under the pointer can still scroll its own content that way.
  function panelScrolls(target, down) {
    for (var k = 0; k < hp.length; k++) {
      var el = hp[k].el;
      if (el.contains(target)) {
        if (el.scrollHeight <= el.clientHeight + 1) return false;
        return down ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
      }
    }
    return false;
  }

  function onWheel(e) {
    if (!hscroll || e.ctrlKey) return;
    wrapIfAtClone();
    // A modal drawer owns the wheel while it is open.
    if (root.classList.contains('drawer-open')) return;
    if (e.target.closest && e.target.closest('dialog')) return;
    var dy = e.deltaY;
    if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return;
    dy *= e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
    var down = dy > 0;
    var now = Date.now();
    var a = Math.abs(dy);
    if (panelScrolls(e.target, down)) {
      // Scrolling the panel's own content: the same gesture must not also flip
      // the panel when it reaches the edge.
      wheelLast = now;
      wheelPrev = a;
      wheelSpent = true;
      return;
    }
    // Up from the first panel is the top of the page: native handles it. Down from
    // the last real panel steps onto the clone, which wraps (see wrapIfAtClone).
    if (!down && window.scrollY <= scrollTopFor(0) + 1) return;
    e.preventDefault();

    if (now - wheelLast > WHEEL_GAP || (!wheelMoving && a > 4 && a > wheelPrev * 1.3)) {
      wheelAcc = 0;
      wheelSpent = false;
    }
    wheelLast = now;
    wheelPrev = a;
    if (wheelSpent || wheelMoving) return;

    wheelAcc += dy;
    if (Math.abs(wheelAcc) < WHEEL_STEP) return;
    wheelSpent = true;
    wheelAcc = 0;
    var k = Math.max(0, Math.min(hp.length - 1, Math.round(hsProgress()) + (down ? 1 : -1)));
    var top = scrollTopFor(k);
    if (Math.abs(window.scrollY - top) <= 1) return;
    window.scrollTo({ top: top, behavior: reduced() ? 'auto' : 'smooth' });
    waitFor(top);
  }

  // End goes to Spectrum+ (the last real panel), not to the clone at the page end.
  function onKeyDown(e) {
    if (!hscroll || e.key !== 'End') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (root.classList.contains('drawer-open')) return;
    var t = document.activeElement || document.body;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (t.closest && t.closest('dialog')) return;
    if (panelScrolls(t, true)) return;
    e.preventDefault();
    goTo(pn - 1, !reduced());
  }

  function enable() {
    if (hscroll) return;
    hscroll = true;
    root.classList.add('is-hscroll');
    // The loop: a copy of the first panel after the last, with no ids and out of
    // the tab order and the accessibility tree. It looks like OffBridge to the bar.
    var host = track.querySelector('.apps > .container');
    if (host && pn > 1) {
      clone = panels[0].el.cloneNode(true);
      clone.removeAttribute('id');
      var withIds = clone.querySelectorAll('[id]');
      for (var d = 0; d < withIds.length; d++) withIds[d].removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      var links = clone.querySelectorAll('a, button');
      for (var q = 0; q < links.length; q++) links[q].setAttribute('tabindex', '-1');
      var shown = clone.querySelectorAll('.project-text, .media');
      for (var w = 0; w < shown.length; w++) shown[w].classList.add('in');
      host.appendChild(clone);
      hp = panels.concat([{
        el: clone,
        product: panels[0].product,
        band: panels[0].band,
        key: panels[0].key
      }]);
    }
    hs.style.setProperty('--hs-n', String(hp.length));
    for (var k = 0; k < hp.length; k++) {
      var s = document.createElement('span');
      s.className = 'hs-snap';
      s.setAttribute('aria-hidden', 'true');
      hs.appendChild(s);
      snaps.push(s);
    }
    layout();
    paint();
  }

  function disable() {
    if (!hscroll) return;
    hscroll = false;
    for (var k = 0; k < snaps.length; k++) hs.removeChild(snaps[k]);
    snaps = [];
    step = 0;
    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
    clone = null;
    hp = panels;
    root.classList.remove('is-hscroll');
    hs.style.removeProperty('--hs-n');
    track.style.transform = '';
  }

  // Index of the panel under the bar (the last panel when below them all).
  function panelUnderBar() {
    var line = bar.getBoundingClientRect().bottom + 1;
    var idx = 0;
    for (var k = 0; k < pn; k++) {
      if (panels[k].el.getBoundingClientRect().top <= line) idx = k;
    }
    return idx;
  }

  // Switching layouts keeps the user on the same section.
  function onMotion() {
    var want = wantH();
    if (want && !hscroll) {
      var k = panelUnderBar();
      enable();
      goTo(k, false);
    } else if (!want && hscroll) {
      var j = Math.round(hsProgress()) % pn;
      disable();
      jumpTo(window.scrollY + panels[j].el.getBoundingClientRect().top -
        bar.getBoundingClientRect().bottom, false);
    }
    schedule();
  }

  var SWAP_MS = 120;
  var ticking = false;
  var swapTimer = 0;
  var appliedKey = null;
  var lastBg = '';
  var colourCache = {};

  var probe = document.createElement('div');
  probe.className = 'topbar';
  probe.setAttribute('data-probe', '');
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);

  function tag(el, product) {
    if (!el) return;
    if (product) {
      if (el.getAttribute('data-product') !== product) el.setAttribute('data-product', product);
    } else if (el.hasAttribute('data-product')) {
      el.removeAttribute('data-product');
    }
  }

  // Any row under the bar: the bar takes the band colour (--card) rather than the page's.
  function band(el, on) {
    if (!el || el.hasAttribute('data-band') === on) return;
    if (on) el.setAttribute('data-band', '');
    else el.removeAttribute('data-band');
  }

  // The background-color the bar would have with this zone's tags.
  function colourOf(zone) {
    var c = colourCache[zone.key];
    if (c) return c;
    tag(probe, zone.product);
    band(probe, zone.band);
    c = window.getComputedStyle(probe).backgroundColor;
    colourCache[zone.key] = c;
    return c;
  }

  var COLOUR_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/;

  function parse(s) {
    var m = COLOUR_RE.exec(String(s).replace(/^\s+|\s+$/g, ''));
    if (!m) return null;
    var a = 1;
    if (m[4] !== undefined) {
      a = m[4].charAt(m[4].length - 1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    }
    var out = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a];
    for (var k = 0; k < 4; k++) if (isNaN(out[k])) return null;
    return out;
  }

  function mix(a, b, t) {
    var ca = parse(a);
    var cb = parse(b);
    if (!ca || !cb) return t >= 0.5 ? b : a;
    var ch = [];
    for (var k = 0; k < 4; k++) ch.push(ca[k] + (cb[k] - ca[k]) * t);
    var r = Math.round(ch[0]);
    var g = Math.round(ch[1]);
    var bl = Math.round(ch[2]);
    var al = Math.max(0, Math.min(1, ch[3]));
    if (al >= 1) return 'rgb(' + r + ', ' + g + ', ' + bl + ')';
    return 'rgba(' + r + ', ' + g + ', ' + bl + ', ' + Math.round(al * 1000) / 1000 + ')';
  }

  // Where the scroll is now: the background to paint and the zone whose look the
  // bar's content should have (the next zone once it is halfway up to the bar).
  function measure() {
    return hscroll ? measureH() : measureStacked();
  }

  // Horizontal: panel floor(f) mixed with the next by f's fraction. The footer is
  // ignored; the clone shares OffBridge's key, so the loop blends Spectrum+ to OffBridge.
  function measureH() {
    var f = hsProgress();
    var last = hp.length - 1;
    var i0 = Math.min(Math.floor(f), last);
    var A = hp[i0];
    var B = i0 + 1 <= last ? hp[i0 + 1] : null;
    var t = B ? f - i0 : 0;
    return {
      bg: B ? mix(colourOf(A), colourOf(B), t) : colourOf(A),
      target: t >= 0.5 && B ? B : A
    };
  }

  function measureStacked() {
    var L = bar.getBoundingClientRect().bottom;
    var vh = window.innerHeight;
    var line = L + 1;
    var ai = -1;
    var n = zones.length;
    for (var j = 0; j < n; j++) {
      var r = zones[j].el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) {
        ai = j;
        break;
      }
    }
    if (ai < 0) {
      ai = zones[0].el.getBoundingClientRect().top > line ? 0 : n - 1;
    }
    var A = zones[ai];
    var B = ai + 1 < n ? zones[ai + 1] : null;
    var p = 0;
    if (B) {
      // Blend over a distance that fits the current zone, so a short first zone
      // does not start the page part-way blended.
      var D = Math.min(vh - L, A.el.getBoundingClientRect().height);
      var Btop = B.el.getBoundingClientRect().top;
      p = D > 0 ? 1 - (Btop - L) / D : 0;
      // B's top at maximum scroll. If it never gets up to the bar, the page would
      // end part-way blended: stay on A for the footer, rescale for a row.
      var endTop = Btop - (document.documentElement.scrollHeight - vh - window.scrollY);
      if (endTop > L) {
        if (B.el.tagName === 'FOOTER') {
          p = 0;
        } else {
          var startTop = L + D;
          p = startTop - endTop > 0 ? (startTop - Btop) / (startTop - endTop) : 0;
        }
      }
      p = Math.max(0, Math.min(1, p));
    }
    return {
      bg: B ? mix(colourOf(A), colourOf(B), p) : colourOf(A),
      target: p >= 0.5 && B ? B : A
    };
  }

  function setBg(bg) {
    if (bg === lastBg) return;
    lastBg = bg;
    bar.style.backgroundColor = bg;
  }

  // An open drawer keeps its look (no restyle behind the user's back); only the
  // menu-button click (force) tags it.
  function applyTarget(t, force) {
    var drawer = document.getElementById('projects-drawer');
    tag(bar, t.product);
    band(bar, t.band);
    if (drawer && drawer.open && !force) {
      appliedKey = t.key;
      return;
    }
    tag(drawer, t.product);
    band(drawer, t.band);
    appliedKey = t.key;
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function cancelSwap() {
    if (swapTimer) {
      window.clearTimeout(swapTimer);
      swapTimer = 0;
    }
    bar.classList.remove('is-swapping');
  }

  function swapIn() {
    swapTimer = 0;
    var m = measure();
    setBg(m.bg);
    applyTarget(m.target);
    var done = false;
    function clear() {
      if (done) return;
      done = true;
      if (!swapTimer) bar.classList.remove('is-swapping');
    }
    window.requestAnimationFrame(clear);
    window.setTimeout(clear, 50);
  }

  function update() {
    ticking = false;
    var m = measure();
    setBg(m.bg);
    if (swapTimer) return; // the pending timer applies the latest target when it fires
    var t = m.target;
    if (appliedKey === null || reduced()) {
      if (t.key !== appliedKey) applyTarget(t);
      return;
    }
    if (t.key === appliedKey) return;
    bar.classList.add('is-swapping');
    swapTimer = window.setTimeout(swapIn, SWAP_MS);
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function themeChanged() {
    colourCache = {};
    schedule();
  }

  // Menu button: tag the drawer (and the bar) now, before the drawer slides in.
  function onMenu() {
    applyTarget(measure().target, true);
    cancelSwap();
  }

  // The track is painted in the scroll event itself so it never lags the page; the
  // bar update stays on the rAF schedule.
  var initY = 0;

  // Resting on the clone: jump back to the real first panel. This runs when the scroll
  // comes to rest (scrollend, or a timer where that is missing), never mid-flight.
  // The wheel lock is released (wheelSpent stays, so the rest of the gesture is
  // still swallowed) and the track and bar are redrawn at once, so there is no flash.
  function wrapIfAtClone() {
    if (!hscroll || !clone || !(step > 0)) return;
    if (Math.abs(window.scrollY - scrollTopFor(pn)) >= 1) return;
    jumpTo(scrollTopFor(0), false);
    wheelMoving = false;
    wheelAcc = 0;
    waitToken++;
    paint();
    update();
  }

  // Without scrollend: wait for 150ms of no scrolling, and not while a finger is down.
  var hasScrollEnd = 'onscrollend' in window;
  var wrapTimer = 0;
  var touching = false;

  function armWrap() {
    if (hasScrollEnd) return;
    window.clearTimeout(wrapTimer);
    wrapTimer = window.setTimeout(function () {
      wrapTimer = 0;
      if (!touching) wrapIfAtClone();
    }, 150);
  }

  function onTouch(e) {
    touching = !!(e.touches && e.touches.length);
    if (!touching) armWrap();
  }

  function onScroll() {
    paint();
    schedule();
    armWrap();
  }

  function onResize() {
    layout();
    paint();
    schedule();
  }

  function onLoad() {
    layout();
    paint();
    if (window.scrollY === initY) applyHash();
    schedule();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onLoad);
  window.addEventListener('hashchange', applyHash);
  document.addEventListener('focusin', onFocusIn);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  if (hasScrollEnd) {
    window.addEventListener('scrollend', wrapIfAtClone);
  } else {
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchend', onTouch, { passive: true });
    window.addEventListener('touchcancel', onTouch, { passive: true });
  }

  if (window.matchMedia) {
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.addEventListener) motion.addEventListener('change', onMotion);
    else if (motion.addListener) motion.addListener(onMotion);
  }

  if (window.MutationObserver) {
    new MutationObserver(themeChanged).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  if (window.matchMedia) {
    var scheme = window.matchMedia('(prefers-color-scheme: light)');
    if (scheme.addEventListener) scheme.addEventListener('change', themeChanged);
    else if (scheme.addListener) scheme.addListener(themeChanged);
  }

  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', onMenu);

  if (wantH()) {
    enable();
    applyHash();
    initY = window.scrollY;
  }
  update();
})();
