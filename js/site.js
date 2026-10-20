(function () {
  'use strict';

  // Old homepage anchors (#apps, #schedule, ...) now live on the projects page; send them there.
  var h = location.hash;
  if ((location.pathname === '/' || location.pathname === '/index.html') &&
      ['#apps', '#offbridge', '#schedule', '#quick-vote', '#card-games', '#mif-finance', '#spectrum-agent'].indexOf(h) !== -1) {
    location.replace('/projects/' + (h === '#apps' ? '' : h));
    return;
  }

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

  function syncThemeColor() {
    var color = current() === 'dark' ? '#141414' : '#F8FAFC';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var m = 0; m < metas.length; m++) metas[m].setAttribute('content', color);
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('esl-theme', next);
      } catch (e) {}
      updateLabel();
      syncThemeColor();
    });
  }

  if (mq && mq.addEventListener) {
    mq.addEventListener('change', updateLabel);
  }

  updateLabel();
  if (root.hasAttribute('data-theme')) syncThemeColor();

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
    var revealEls = document.querySelectorAll('.project-text, .media, .principles li, .steps-list li');
    for (i = 0; i < revealEls.length; i++) io.observe(revealEls[i]);
  }

  // Typed headline: characters appear one by one with a caret that follows the last one.
  var typedEl = document.querySelector('.typed .typed-text');
  if (typedEl && root.classList.contains('motion')) typeHeadline(typedEl);

  function typeHeadline(el) {
    var h1 = el.parentNode;
    var words = el.textContent.split(' ');
    var chars = [];
    el.textContent = '';
    for (var w = 0; w < words.length; w++) {
      if (!words[w]) continue;
      if (el.childNodes.length) el.appendChild(document.createTextNode(' '));
      var tw = document.createElement('span');
      tw.className = 'tw';
      for (var c = 0; c < words[w].length; c++) {
        var s = document.createElement('span');
        s.className = 'tc';
        s.textContent = words[w].charAt(c);
        tw.appendChild(s);
        chars.push(s);
      }
      el.appendChild(tw);
    }
    el.classList.add('split');
    if (!chars.length) return;

    var caret = document.createElement('span');
    caret.className = 'typed-caret';
    caret.setAttribute('aria-hidden', 'true');
    h1.appendChild(caret);

    var shown = -1;
    var typing = true;

    function place() {
      var idx = shown < 0 ? 0 : shown;
      var hr = h1.getBoundingClientRect();
      var r = chars[idx].getBoundingClientRect();
      var x = (shown < 0 ? r.left : r.right) - hr.left;
      var y = r.top - hr.top + (r.height - caret.offsetHeight) / 2;
      caret.style.setProperty('--cx', x.toFixed(1) + 'px');
      caret.style.setProperty('--cy', y.toFixed(1) + 'px');
    }

    function onResize() {
      if (typing) place();
    }

    function finish() {
      typing = false;
      window.removeEventListener('resize', onResize);
      caret.classList.remove('typing');
      setTimeout(function () {
        caret.classList.add('gone');
        setTimeout(function () {
          if (caret.parentNode) caret.parentNode.removeChild(caret);
        }, 600);
      }, 500);
    }

    function reveal() {
      shown++;
      chars[shown].classList.add('on');
      caret.classList.add('typing');
      place();
      if (shown < chars.length - 1) {
        setTimeout(reveal, 45);
      } else {
        finish();
      }
    }

    place();
    window.addEventListener('resize', onResize);
    setTimeout(reveal, 600);
  }

  // Scroll fill: words of p.fill light up as the paragraph scrolls through the viewport.
  var fillEl = document.querySelector('p.fill');
  if (fillEl && root.classList.contains('motion')) scrollFill(fillEl);

  function scrollFill(p) {
    var parts = p.textContent.split(/(\s+)/);
    var fw = [];
    p.textContent = '';
    for (var k = 0; k < parts.length; k++) {
      if (!parts[k]) continue;
      if (/^\s+$/.test(parts[k])) {
        p.appendChild(document.createTextNode(' '));
      } else {
        var sp = document.createElement('span');
        sp.className = 'fw';
        sp.textContent = parts[k];
        p.appendChild(sp);
        fw.push(sp);
      }
    }
    var lit = 0;
    var queued = false;

    function update() {
      queued = false;
      var vh = window.innerHeight;
      var r = p.getBoundingClientRect();
      var progress = (vh * 0.85 - r.top) / (r.height + vh * 0.45);
      progress = Math.max(0, Math.min(1, progress));
      var target = Math.ceil(progress * fw.length - 1e-6);
      var n;
      if (target === lit) return;
      if (target > lit) {
        for (n = lit; n < target; n++) fw[n].classList.add('lit');
      } else {
        for (n = target; n < lit; n++) fw[n].classList.remove('lit');
      }
      lit = target;
    }

    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
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
