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
    // On a large pointer screen each section becomes one sheet in a pile of paper: the top sheet slides off to
    // the left to show the next one lying beneath it, and going back slides it on again. The four phones of
    // pages 3-6 live in one shared floating dock instead. Leaving book mode puts the markup back exactly as it
    // was, so the long scrolling page is the fallback everywhere else.
    const GATE = matchMedia('(min-width: 1000px) and (min-height: 560px) and (hover: hover) and (pointer: fine)');
    const main = document.getElementById('content');
    const foot = document.querySelector('.sp-foot');
    const SLIDE = reduce ? 0 : 700; // how long a sheet takes to slide
    const REST = [-0.5, 0.35, -0.2, 0.45, -0.35, 0.25, -0.45, 0.3, -0.15]; // each sheet's resting tilt, in degrees
    const NAV_KEYS = ['ArrowDown', 'ArrowRight', 'PageDown', 'ArrowUp', 'ArrowLeft', 'PageUp', 'Home', 'End', ' '];
    let book = null;

    function setHooks(page, on) {
      page.el.querySelectorAll('.scene__copy, .stage, [data-reveal]').forEach((el) => el.classList.toggle('in', on));
      page.el.querySelectorAll('[data-sweep]').forEach((el) => el.classList.toggle('swept', on));
    }

    // A page that becomes current plays once its slide is past halfway; one that stops being current resets
    // after its slide has finished, so it replays when you come back.
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
      // Where each phone slot sits in the flat, untransformed layout (the dock flies to these).
      book.story.forEach((e) => { e.rect = e.slot.getBoundingClientRect(); });
      // End measuring without the sheets animating back to their poses.
      const wrap = book.wrap;
      const hadStill = wrap.classList.contains('is-still');
      if (!hadStill) wrap.classList.add('is-still');
      wrap.classList.remove('is-measuring');
      void wrap.offsetWidth;
      if (!hadStill) wrap.classList.remove('is-still');
      // Re-placing after a resize snaps the dock to its slot rather than gliding there.
      const dock = book.dock;
      const dockStill = !!dock && dock.classList.contains('is-still');
      if (dock && !dockStill) dock.classList.add('is-still');
      placeDock();
      if (dock && !dockStill) {
        void dock.offsetWidth;
        dock.classList.remove('is-still');
      }
    }

    // Park the dock over the first story page's slot: one fixed spot for pages 3-6, so the phone never shifts between them.
    function placeDock() {
      if (!book || !book.dock || !book.story.length) return;
      const a = book.story[0];
      if (!a.rect) return;
      const d = book.dock;
      d.style.setProperty('--dx', (a.rect.left + a.rect.width / 2).toFixed(1) + 'px');
      d.style.setProperty('--dy', (a.rect.top + a.rect.height / 2).toFixed(1) + 'px');
      d.style.setProperty('--dw', a.rect.width.toFixed(1) + 'px');
    }

    // The dock flies in when a story page becomes current, swaps screens between story pages, and flies out
    // when you leave them. offDelay keeps the screen lit while the phone flies out. is-shown decides which phone
    // face shows (immediately); .in plays its screen.
    function syncDock(prev, next, offDelay) {
      const b = book;
      if (!b || !b.dock) return;
      const target = b.story.find((e) => e.page === next);
      const on = !!target;
      const wasOn = b.story.some((e) => e.page === prev);
      placeDock();
      b.dock.classList.toggle('is-on', on);
      clearTimeout(b.dockTimer);
      if (on) {
        b.story.forEach((e) => {
          if (e === target) {
            e.stage.removeAttribute('aria-hidden');
            e.stage.removeAttribute('inert');
            e.stage.classList.add('is-shown');
          } else {
            e.stage.classList.remove('in');
            e.stage.classList.remove('is-shown');
            e.stage.setAttribute('aria-hidden', 'true');
            e.stage.setAttribute('inert', '');
          }
        });
        const d = wasOn ? 0 : (reduce ? 0 : 350);
        if (!d) target.stage.classList.add('in');
        else b.dockTimer = setTimeout(() => target.stage.classList.add('in'), d);
      } else {
        b.story.forEach((e) => {
          e.stage.setAttribute('aria-hidden', 'true');
          e.stage.setAttribute('inert', '');
        });
        const clear = () => b.story.forEach((e) => e.stage.classList.remove('in', 'is-shown'));
        if (!offDelay) clear(); else b.dockTimer = setTimeout(clear, offDelay);
      }
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
      // Pages that slide: off from the top of the pile going forward, or back on from the most recently slid off.
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
      book.lockUntil = performance.now() + SLIDE + span;
      book.cur = next;
      book.pages.forEach((p, k) => {
        const cur = k === next;
        p.el.classList.toggle('is-turned', k < next);
        p.el.classList.toggle('is-current', cur);
        p.el.classList.toggle('is-under', k === next + 1);
        if (cur) {
          p.el.removeAttribute('inert');
          p.el.removeAttribute('aria-hidden');
        } else {
          p.el.setAttribute('inert', '');
          p.el.setAttribute('aria-hidden', 'true');
        }
      });
      syncDock(prev, next, SLIDE + span);
      book.tabs.forEach((b, k) => {
        if (k === next) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      scheduleHooks(book.pages[prev], false, SLIDE + span);
      scheduleHooks(book.pages[next], true, reduce ? 0 : SLIDE / 2);
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
        sec.style.setProperty('--rest', REST[i % REST.length] + 'deg');
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

      // The phones of the story pages leave the paper for one shared dock; a slot keeps each one's place.
      const story = [];
      pages.forEach((p, i) => {
        const stage = p.pin.querySelector('.stage');
        if (!stage) return;
        const slot = document.createElement('div');
        slot.className = 'stage-slot';
        slot.setAttribute('aria-hidden', 'true');
        stage.replaceWith(slot);
        story.push({ page: i, stage, slot, rect: null });
      });
      let dock = null;
      if (story.length) {
        dock = document.createElement('div');
        dock.className = 'dock is-still';
        story.forEach((e) => dock.appendChild(e.stage));
        wrap.after(dock); // inside <main>, right after the pile, so the phone stays in the page's reading order
      }

      book = { wrap, pages, tabs, live, cur: -1, lockUntil: 0, armed: true, lastWheel: 0, focusable: [], dock, story, dockTimer: 0 };
      root.classList.add('is-book');

      // Start on the page named by the hash, without a slide.
      const hashId = decodeURIComponent(location.hash.slice(1));
      const start = Math.max(0, pages.findIndex((p) => p.id === hashId));
      pages.forEach((p, k) => {
        p.el.classList.toggle('is-turned', k < start);
        p.el.classList.toggle('is-current', k === start);
        p.el.classList.toggle('is-under', k === start + 1);
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
        if (book) {
          book.wrap.classList.remove('is-still');
          if (book.dock) book.dock.classList.remove('is-still');
        }
      }));
      fit();
      syncDock(-1, start, 0);
    }

    function leaveBook() {
      if (!book) return;
      const b = book;
      book = null;
      b.pages.forEach((p) => clearTimeout(p.timer));
      clearTimeout(b.dockTimer);
      b.story.forEach((e) => {
        e.slot.replaceWith(e.stage);
        e.stage.classList.remove('is-shown');
        e.stage.removeAttribute('inert');
        e.stage.removeAttribute('aria-hidden');
      });
      if (b.dock) b.dock.remove();
      main.after(foot);
      b.pages.forEach((p) => {
        while (p.pin.firstChild) p.el.insertBefore(p.pin.firstChild, p.pin);
        p.pin.remove();
        p.no.remove();
        p.el.classList.remove('page', 'is-current', 'is-turned', 'is-under');
        p.el.removeAttribute('inert');
        p.el.removeAttribute('aria-hidden');
        p.el.style.removeProperty('--pi');
        p.el.style.removeProperty('--rest');
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
