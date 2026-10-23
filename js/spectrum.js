/* Spectrum+ page: download controls, OCC demo, highlighter sweeps. Loaded synchronously in head so the js class lands before first paint. */
(function () {
  'use strict';
  var PLAY_URL = null; var APK_URL = null;
  document.documentElement.classList.add('js');

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Download controls: links once a URL is set.
    document.querySelectorAll('[data-dl]').forEach((el) => {
      const isPlay = el.dataset.dl === 'play';
      const url = isPlay ? PLAY_URL : APK_URL;
      if (!url) return;
      const a = document.createElement('a');
      a.className = el.className;
      a.href = url;
      a.innerHTML = el.innerHTML;
      a.querySelector('.lbl').textContent = isPlay ? 'Get it on Google Play' : 'Download the APK';
      el.replaceWith(a);
    });

    // Example posts demo.
    const group = document.getElementById('occ');
    const list = document.getElementById('posts');
    const need = document.getElementById('need');
    const btns = Array.from(group.querySelectorAll('[role="radio"]'));
    const posts = Array.from(list.querySelectorAll('.post'));
    const CHANGE = /moved|shifted|cancelled|replacement/i;
    const STAGGER = 70;

    function render(sel, base) {
      list.classList.add('no-tr');
      posts.forEach((p) => {
        const t = p.querySelector('.row-title');
        t.classList.remove('hl', 'hl--changed');
        t.style.transitionDelay = '';
      });
      root.classList.add('ready');
      void list.offsetWidth;
      list.classList.remove('no-tr');

      let n = 0, i = 0, pinkDone = false;
      posts.forEach((p) => {
        const t = p.querySelector('.row-title');
        const occ = p.dataset.occ;
        let state;
        if (occ === 'unclear') state = 'unclear';
        else if (occ === 'all') state = 'all';
        else state = occ.split(',').map(Number).includes(sel) ? 'explicit' : 'other';

        p.classList.toggle('is-other', state === 'other');
        p.querySelector('.sr-only').hidden = state !== 'other';
        p.querySelector('.tag').hidden = state !== 'unclear';

        if (state === 'all' || state === 'explicit') {
          let cls = 'hl';
          if (state === 'explicit' && !pinkDone && CHANGE.test(t.textContent)) {
            cls = 'hl--changed';
            pinkDone = true;
          }
          t.style.transitionDelay = (reduce ? 0 : base + i * STAGGER) + 'ms';
          t.classList.add(cls);
          i++;
          n++;
        } else if (state === 'unclear') {
          n++;
        }
      });
      need.textContent = n;
    }

    function select(i, focus) {
      btns.forEach((b, j) => {
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
      });
      if (focus) btns[i].focus();
      render(i + 1, 0);
      if (book) requestAnimationFrame(fit); // the post list changes height
    }

    btns.forEach((b, i) => b.addEventListener('click', () => select(i, false)));
    group.addEventListener('keydown', (e) => {
      const cur = btns.indexOf(document.activeElement);
      if (cur < 0) return;
      let next;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': next = (cur + 1) % btns.length; break;
        case 'ArrowLeft':
        case 'ArrowUp': next = (cur + btns.length - 1) % btns.length; break;
        case 'Home': next = 0; break;
        case 'End': next = btns.length - 1; break;
        default: return;
      }
      e.preventDefault();
      select(next, true);
    });

    render(8, reduce ? 0 : 350);

    // Highlighter sweeps: hero on load, others when scrolled into view (or, in book mode, when their page lands).
    const onLoad = Array.from(document.querySelectorAll('[data-sweep="load"]'));
    setTimeout(() => onLoad.forEach((el) => el.classList.add('swept')), reduce ? 0 : 200);

    // Scroll reveals. All start states live in CSS under .motion, so without .motion there is nothing to trigger.
    // The observers belong to the normal scrolling page: book mode stops them, because every page overlaps.
    const sweepEls = Array.from(document.querySelectorAll('[data-sweep="scroll"]'));
    let observers = [];

    function stopIO() {
      observers.forEach((o) => o.disconnect());
      observers = [];
    }

    function startIO() {
      stopIO();
      if (!('IntersectionObserver' in window) || reduce) {
        sweepEls.forEach((el) => el.classList.add('swept'));
        return;
      }
      const watch = (els, cls, threshold) => {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add(cls);
              io.unobserve(en.target);
            }
          });
        }, { threshold });
        els.forEach((el) => io.observe(el));
        observers.push(io);
      };
      watch(sweepEls, 'swept', 0.6);
      if (root.classList.contains('motion')) {
        watch(Array.from(document.querySelectorAll('.scene__copy, .stage')), 'in', 0.2);
        watch(Array.from(document.querySelectorAll('[data-reveal]')), 'in', 0.35);
      }
    }

    // --- Book mode ---------------------------------------------------------
    // On a large pointer screen each section becomes one paper page of a flip-book. Leaving book mode puts
    // the markup back exactly as it was, so the long scrolling page is the fallback everywhere else.
    const GATE = matchMedia('(min-width: 1000px) and (min-height: 560px) and (hover: hover) and (pointer: fine)');
    const main = document.getElementById('content');
    const foot = document.querySelector('.sp-foot');
    const FLIP = reduce ? 0 : 700;
    const NAV_KEYS = ['ArrowDown', 'ArrowRight', 'PageDown', 'ArrowUp', 'ArrowLeft', 'PageUp', 'Home', 'End', ' '];
    let book = null;

    function setHooks(page, on) {
      page.el.querySelectorAll('.scene__copy, .stage, [data-reveal]').forEach((el) => el.classList.toggle('in', on));
      page.el.querySelectorAll('[data-sweep]').forEach((el) => el.classList.toggle('swept', on));
    }

    // A page that becomes current plays once the flip is past halfway; one that stops being current resets
    // after its flip has finished, so it replays when you come back.
    function scheduleHooks(page, on, delay) {
      clearTimeout(page.timer);
      if (!delay) { setHooks(page, on); return; }
      page.timer = setTimeout(() => setHooks(page, on), delay);
    }

    function fit() {
      if (!book) return;
      book.wrap.classList.add('is-measuring'); // flat, transition-free layout while measuring
      book.pages.forEach((p) => {
        p.el.scrollTop = 0;
        p.pin.classList.remove('is-fit');
        p.pin.style.removeProperty('--fit');
        p.pin.style.removeProperty('--fit-y');
      });
      const sizes = book.pages.map((p) => ({ avail: p.pin.clientHeight, need: p.pin.scrollHeight }));
      book.pages.forEach((p, i) => {
        const { avail, need } = sizes[i];
        if (avail > 0 && need > avail + 1) {
          p.pin.style.setProperty('--fit', Math.max(0.7, avail / need).toFixed(3));
          p.pin.classList.add('is-fit');
        }
      });
      // Second pass: centre what is left in the page's box, so scaled content never hugs an edge
      // (and when even .7 is not enough, the overflow is split top and bottom).
      book.pages.forEach((p, i) => {
        if (!p.pin.classList.contains('is-fit')) return;
        const base = p.pin.getBoundingClientRect().top;
        let top = Infinity;
        let bottom = -Infinity;
        Array.from(p.pin.children).forEach((c) => {
          const r = c.getBoundingClientRect();
          top = Math.min(top, r.top);
          bottom = Math.max(bottom, r.bottom);
        });
        if (bottom > top) {
          const dy = (sizes[i].avail - (bottom - top)) / 2 - (top - base);
          p.pin.style.setProperty('--fit-y', dy.toFixed(1) + 'px');
        }
      });
      book.wrap.classList.remove('is-measuring');
    }

    function focusPage(i) {
      const h = book.pages[i].el.querySelector('h1, h2');
      if (!h) return;
      if (!h.hasAttribute('tabindex')) {
        h.setAttribute('tabindex', '-1');
        book.focusable.push(h);
      }
      h.focus({ preventScroll: true });
    }

    function go(i, opts) {
      if (!book) return;
      const o = opts || {};
      const n = book.pages.length;
      const next = Math.max(0, Math.min(n - 1, i));
      const prev = book.cur;
      if (next === prev) {
        if (o.focus) focusPage(next);
        return;
      }
      // Pages that flip: turn forward from the top of the stack, or back from the most recently turned.
      const ae = document.activeElement;
      const stranded = !!ae && ae !== document.body && book.pages.some((p, k) => k !== next && p.el.contains(ae));
      const changed = [];
      book.pages.forEach((p, k) => {
        if ((k < next) !== p.el.classList.contains('is-turned')) changed.push(k);
      });
      if (next < prev) changed.reverse();
      const step = reduce ? 0 : 70;
      book.pages.forEach((p) => p.el.style.setProperty('--fd', '0ms'));
      let span = 0;
      changed.forEach((k, j) => {
        const d = Math.min(j * step, 280);
        book.pages[k].el.style.setProperty('--fd', d + 'ms');
        span = Math.max(span, d);
      });
      book.lockUntil = performance.now() + FLIP + span;
      book.cur = next;
      book.pages.forEach((p, k) => {
        const cur = k === next;
        p.el.classList.toggle('is-turned', k < next);
        p.el.classList.toggle('is-current', cur);
        if (cur) {
          p.el.removeAttribute('inert');
          p.el.removeAttribute('aria-hidden');
        } else {
          p.el.setAttribute('inert', '');
          p.el.setAttribute('aria-hidden', 'true');
        }
      });
      book.tabs.forEach((b, k) => {
        if (k === next) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      scheduleHooks(book.pages[prev], false, FLIP + span);
      scheduleHooks(book.pages[next], true, reduce ? 0 : FLIP / 2);
      book.live.textContent = 'Page ' + (next + 1) + ' of ' + n + ': ' + book.pages[next].label;
      try {
        history.replaceState(null, '', next === 0 ? location.pathname + location.search : '#' + book.pages[next].id);
      } catch (e) { /* replaceState can throw in sandboxed frames */ }
      if (o.focus || stranded) focusPage(next); // inert pages drop focus, so bring it along
    }

    function enterBook() {
      if (book || !main) return;
      const secs = Array.from(main.querySelectorAll(':scope > section.scene'));
      if (!secs.length) return;
      stopIO();
      const wrap = document.createElement('div');
      wrap.className = 'book is-still';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-roledescription', 'book');
      wrap.setAttribute('aria-label', 'Spectrum+ pages');
      wrap.style.setProperty('--pn', String(secs.length));
      main.insertBefore(wrap, secs[0]);

      const pages = secs.map((sec, i) => {
        const pin = document.createElement('div');
        pin.className = 'page-in';
        while (sec.firstChild) pin.appendChild(sec.firstChild);
        sec.appendChild(pin);
        const no = document.createElement('span');
        no.className = 'fine page-no';
        no.setAttribute('aria-hidden', 'true');
        no.textContent = (i + 1) + ' / ' + secs.length;
        sec.appendChild(no);
        sec.classList.add('page');
        sec.style.setProperty('--pi', String(i));
        wrap.appendChild(sec);
        return { el: sec, pin, no, id: sec.id, label: sec.dataset.chapter || sec.id, timer: 0 };
      });
      pages[pages.length - 1].pin.appendChild(foot);

      const nav = document.createElement('nav');
      nav.className = 'book-tabs';
      nav.setAttribute('aria-label', 'Pages');
      const ol = document.createElement('ol');
      const tabs = pages.map((p, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        const num = document.createElement('span');
        num.className = 'tab-n';
        num.setAttribute('aria-hidden', 'true');
        num.textContent = String(i + 1).padStart(2, '0');
        const t = document.createElement('span');
        t.className = 'tab-t';
        t.textContent = p.label;
        b.append(num, t);
        b.addEventListener('click', () => go(i, { focus: true }));
        li.appendChild(b);
        ol.appendChild(li);
        return b;
      });
      nav.appendChild(ol);
      wrap.appendChild(nav);

      const live = document.createElement('p');
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      wrap.appendChild(live);

      book = { wrap, pages, tabs, live, cur: -1, lockUntil: 0, armed: true, lastWheel: 0, focusable: [] };
      root.classList.add('is-book');

      // Start on the page named by the hash, without a flip.
      const hashId = decodeURIComponent(location.hash.slice(1));
      const start = Math.max(0, pages.findIndex((p) => p.id === hashId));
      pages.forEach((p, k) => {
        p.el.classList.toggle('is-turned', k < start);
        p.el.classList.toggle('is-current', k === start);
        if (k !== start) {
          p.el.setAttribute('inert', '');
          p.el.setAttribute('aria-hidden', 'true');
          setHooks(p, false);
        }
      });
      book.cur = start;
      tabs[start].setAttribute('aria-current', 'page');
      scheduleHooks(pages[start], true, reduce ? 0 : 350);
      void wrap.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (book) book.wrap.classList.remove('is-still');
      }));
      fit();
    }

    function leaveBook() {
      if (!book) return;
      const b = book;
      book = null;
      b.pages.forEach((p) => clearTimeout(p.timer));
      main.after(foot);
      b.pages.forEach((p) => {
        while (p.pin.firstChild) p.el.insertBefore(p.pin.firstChild, p.pin);
        p.pin.remove();
        p.no.remove();
        p.el.classList.remove('page', 'is-current', 'is-turned');
        p.el.removeAttribute('inert');
        p.el.removeAttribute('aria-hidden');
        p.el.style.removeProperty('--pi');
        p.el.style.removeProperty('--fd');
        main.insertBefore(p.el, b.wrap);
      });
      b.focusable.forEach((h) => h.removeAttribute('tabindex'));
      b.wrap.remove();
      root.classList.remove('is-book');
      startIO();
    }

    function syncBook() {
      if (GATE.matches) enterBook(); else leaveBook();
    }

    function inField(t) {
      return t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    }

    document.addEventListener('wheel', (e) => {
      if (!book || e.ctrlKey || root.classList.contains('drawer-open') || (e.target.closest && e.target.closest('dialog'))) return;
      e.preventDefault();
      const now = performance.now();
      const gap = now - book.lastWheel;
      book.lastWheel = now;
      if (now < book.lockUntil) return;
      if (!book.armed) {
        if (gap >= 160) book.armed = true; else return;
      }
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 4) return;
      book.armed = false;
      go(book.cur + (d > 0 ? 1 : -1));
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (!book || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (NAV_KEYS.indexOf(e.key) < 0) return;
      const t = e.target;
      if (root.classList.contains('drawer-open') || (t.closest && t.closest('dialog')) || inField(t)) return;
      if (t.closest && t.closest('#occ')) return; // the radiogroup already owns the arrows
      if (e.key === ' ' && t.closest && t.closest('a, button, summary, [role="radio"]')) return;
      let next;
      switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': case 'PageDown': next = book.cur + 1; break;
        case 'ArrowUp': case 'ArrowLeft': case 'PageUp': next = book.cur - 1; break;
        case ' ': next = book.cur + (e.shiftKey ? -1 : 1); break;
        case 'Home': next = 0; break;
        default: next = book.pages.length - 1;
      }
      e.preventDefault();
      go(next, { focus: true });
    });

    // In-page links (How it works, a #hash) open the page they name.
    document.addEventListener('click', (e) => {
      if (!book || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const i = book.pages.findIndex((p) => p.id === decodeURIComponent(a.getAttribute('href').slice(1)));
      if (i < 0) return;
      e.preventDefault();
      go(i, { focus: true });
    });
    window.addEventListener('hashchange', () => {
      if (!book) return;
      const i = book.pages.findIndex((p) => p.id === decodeURIComponent(location.hash.slice(1)));
      if (i >= 0) go(i, { focus: true });
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    GATE.addEventListener('change', syncBook);

    if (GATE.matches) enterBook(); else startIO();
  });
})();
