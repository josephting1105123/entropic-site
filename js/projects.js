/* projects.js - /projects/ only. Tags the top bar and the Projects drawer with
   the data-product of the project row currently under the bar, so css/projects.css
   can recolour them to that row's world. No row under the bar (hero, footer)
   clears both tags and the shell look returns; over a shell row the bar takes
   the band's --card colour (data-band). */
(function () {
  'use strict';

  var rows = document.querySelectorAll('.apps .project');
  var bar = document.querySelector('.topbar');
  if (!rows.length || !bar) return;

  var ticking = false;

  function pick() {
    var line = bar.getBoundingClientRect().bottom + 1;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (r.top <= line && r.bottom > line) return rows[i];
    }
    return null;
  }

  function tag(el, product) {
    if (!el) return;
    if (product) {
      if (el.getAttribute('data-product') !== product) el.setAttribute('data-product', product);
    } else if (el.hasAttribute('data-product')) {
      el.removeAttribute('data-product');
    }
  }

  function apply() {
    ticking = false;
    var row = pick();
    var product = row ? row.getAttribute('data-product') : null;
    var drawer = document.getElementById('projects-drawer');
    tag(bar, product);
    tag(drawer, product);
    band(bar, !!row);
    band(drawer, !!row);
  }

  // Any row under the bar: the bar takes the band colour (--card) rather than the page's.
  function band(el, on) {
    if (!el || el.hasAttribute('data-band') === on) return;
    if (on) el.setAttribute('data-band', '');
    else el.removeAttribute('data-band');
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', apply);

  apply();
})();
