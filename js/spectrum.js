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

    // Highlighter sweeps: hero on load, others when scrolled into view.
    const onLoad = Array.from(document.querySelectorAll('[data-sweep="load"]'));
    setTimeout(() => onLoad.forEach((el) => el.classList.add('swept')), reduce ? 0 : 200);

    const onScroll = Array.from(document.querySelectorAll('[data-sweep="scroll"]'));
    if ('IntersectionObserver' in window && !reduce) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('swept');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.6 });
      onScroll.forEach((el) => io.observe(el));
    } else {
      onScroll.forEach((el) => el.classList.add('swept'));
    }

    // Reveal blocks: CSS holds them at their start state (only under .motion) until they scroll into view.
    if (root.classList.contains('motion') && 'IntersectionObserver' in window) {
      const rio = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            rio.unobserve(en.target);
          }
        });
      }, { threshold: 0.35 });
      document.querySelectorAll('[data-reveal]').forEach((el) => rio.observe(el));

      // html.story-live is on while a story section covers the middle of the viewport. The segmented
      // phone screens only play while it is set, so each one replays when you arrive from outside the story.
      const storySecs = ['week', 'updates', 'due', 'checks'].map((id) => document.getElementById(id)).filter(Boolean);
      const live = new Set();
      const sio = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) live.add(en.target); else live.delete(en.target);
        });
        root.classList.toggle('story-live', live.size > 0);
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      storySecs.forEach((el) => sio.observe(el));
    }
  });
})();
