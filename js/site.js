(function () {
  'use strict';

  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function current() {
    return root.getAttribute('data-theme') ||
      (mq && mq.matches ? 'light' : 'dark');
  }

  function updateLabel() {
    if (!btn) return;
    var other = current() === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', 'Switch to ' + other + ' theme');
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('esl-theme', next);
      } catch (e) {}
      updateLabel();
    });
  }

  if (mq && mq.addEventListener) {
    mq.addEventListener('change', updateLabel);
  }

  updateLabel();

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Motion. Everything below is skipped under prefers-reduced-motion.
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var i;

  // Scroll reveals: html.motion turns on the dimmed start states in CSS.
  if ('IntersectionObserver' in window) {
    root.classList.add('motion');
    var io = new IntersectionObserver(function (entries) {
      for (var n = 0; n < entries.length; n++) {
        if (entries[n].isIntersecting) {
          entries[n].target.classList.add('in');
          io.unobserve(entries[n].target);
        }
      }
    }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });
    var revealEls = document.querySelectorAll('.project-text, .media');
    for (i = 0; i < revealEls.length; i++) io.observe(revealEls[i]);
  }

  // Headline scramble: letters resolve left to right from random lowercase.
  var scr = document.querySelector('.hero .scramble');
  if (scr) {
    var finalText = scr.textContent;
    var DURATION = 1100;
    var ALPHA = 'abcdefghijklmnopqrstuvwxyz';
    var fixed = [];
    var shown = [];
    var resolveAt = [];
    var lastRoll = [];
    for (i = 0; i < finalText.length; i++) {
      var ch = finalText.charAt(i);
      fixed[i] = /[^A-Za-z0-9]/.test(ch);
      shown[i] = ch;
      resolveAt[i] = 150 + i * 24;
      lastRoll[i] = -1000;
    }
    var scrStart = null;
    var scrStep = function (now) {
      if (scrStart === null) scrStart = now;
      var elapsed = now - scrStart;
      if (elapsed >= DURATION + 150) {
        scr.textContent = finalText;
        return;
      }
      var out = '';
      for (var j = 0; j < finalText.length; j++) {
        if (fixed[j] || elapsed >= resolveAt[j]) {
          out += finalText.charAt(j);
        } else {
          if (elapsed - lastRoll[j] >= 45) {
            shown[j] = ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
            lastRoll[j] = elapsed;
          }
          out += shown[j];
        }
      }
      scr.textContent = out;
      requestAnimationFrame(scrStep);
    };
    // Start from scrambled text so the final line never flashes first.
    var initial = '';
    for (i = 0; i < finalText.length; i++) {
      initial += fixed[i] ? finalText.charAt(i) : ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
    }
    scr.textContent = initial;
    requestAnimationFrame(scrStep);
  }

  // Tilt: media blocks lean toward a fine pointer on desktop.
  var fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches;
  if (fine) {
    var medias = document.querySelectorAll('.project .media');
    for (i = 0; i < medias.length; i++) tilt(medias[i]);
  }

  function tilt(el) {
    var isOff = el.classList.contains('media-offbridge');
    var phones = isOff ? el.querySelectorAll('.shot-phone') : [];
    var tx = 0, ty = 0, cx = 0, cy = 0, px = 0, py = 0, tpx = 0, tpy = 0;
    var running = false;
    var active = false;

    function setPhones(v) {
      for (var p = 0; p < phones.length; p++) phones[p].style.transform = v;
    }

    function frame() {
      if (!active) {
        running = false;
        return;
      }
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      px += (tpx - px) * 0.12;
      py += (tpy - py) * 0.12;
      el.style.transform = 'perspective(1100px) rotateX(' + cy.toFixed(3) + 'deg) rotateY(' + cx.toFixed(3) + 'deg)';
      if (isOff && el.classList.contains('in')) {
        setPhones('translate(' + px.toFixed(2) + 'px, ' + py.toFixed(2) + 'px)');
      }
      requestAnimationFrame(frame);
    }

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      nx = Math.max(-0.5, Math.min(0.5, nx));
      ny = Math.max(-0.5, Math.min(0.5, ny));
      tx = nx * 7;
      ty = -ny * 7;
      tpx = nx * 14;
      tpy = ny * 10;
      if (!active) {
        active = true;
        el.classList.add('tilting');
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });

    el.addEventListener('pointerleave', function () {
      active = false;
      tx = ty = cx = cy = tpx = tpy = px = py = 0;
      el.classList.remove('tilting');
      el.style.transform = '';
      if (isOff) setPhones('');
    });
  }
})();
