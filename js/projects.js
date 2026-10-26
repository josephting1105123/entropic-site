/* projects.js - /projects/ only. Tags the top bar and the Projects drawer with
   the data-product of the project row currently under the bar, so css/projects.css
   can restyle them as that row's subsite shell. No row under the bar (hero, footer)
   clears both tags and the shell look returns; over a shell row the bar takes
   the band's --card colour (data-band).
   The bar changes in two phases: when the target look differs, .is-swapping fades
   the bar's contents out, the tags change 180ms later (fonts and shapes cannot
   animate, so they switch while hidden), then the contents fade back in. Reduced
   motion and the first run apply at once. The drawer is tagged immediately when the
   menu button is clicked, with no fade, and is left alone while it is open. */
(function () {
  'use strict';

  var rows = document.querySelectorAll('.apps .project');
  var bar = document.querySelector('.topbar');
  if (!rows.length || !bar) return;

  var SWAP_MS = 180;
  var ticking = false;
  var swapTimer = 0;
  var appliedKey = null;

  function pick() {
    var line = bar.getBoundingClientRect().bottom + 1;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (r.top <= line && r.bottom > line) return rows[i];
    }
    return null;
  }

  function target() {
    var row = pick();
    var product = row ? row.getAttribute('data-product') : null;
    return {
      product: product,
      band: !!row,
      key: product + '|' + (row ? 'band' : '')
    };
  }

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
    applyTarget(target());
    var done = false;
    function clear() {
      if (done) return;
      done = true;
      bar.classList.remove('is-swapping');
    }
    window.requestAnimationFrame(clear);
    window.setTimeout(clear, 50);
  }

  function update() {
    ticking = false;
    if (swapTimer) return; // the pending timer applies the latest pick when it fires
    var t = target();
    if (appliedKey === null || reduced()) {
      applyTarget(t);
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

  // Menu button: tag the drawer (and the bar) now, before the drawer slides in.
  function onMenu() {
    applyTarget(target(), true);
    cancelSwap();
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', onMenu);

  update();
})();
