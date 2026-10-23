(function () {
  'use strict';

  // Project registry: the single source of truth for the Projects drawer.
  var CATEGORIES = [
    { id: 'utilities', label: 'Utilities' },
    { id: 'games', label: 'Games' },
    { id: 'finance', label: 'Finance' }
  ];
  var PLATFORMS = ['Android', 'Windows', 'Web'];
  // New projects are added here.
  var PROJECTS = [
    { name: 'OffBridge', href: 'https://offbridge.app/', external: true, category: 'utilities', platforms: ['Android', 'Windows'], source: 'open' },
    { name: 'Schedule', href: '/schedule/', category: 'utilities', platforms: ['Android'], source: 'open' },
    { name: 'Quick Vote', href: '/quick-vote/', category: 'utilities', platforms: ['Web'], source: 'open' },
    { name: 'Card Games', href: '/card-games/', category: 'games', platforms: ['Web'], source: 'open' },
    { name: 'MIF Finance', href: '/mif-finance/', category: 'finance', platforms: ['Windows', 'Android'], source: 'closed' },
    { name: 'Spectrum+', href: '/spectrum/', category: 'utilities', platforms: ['Android'], source: 'closed' }
  ];

  var STORAGE_KEY = 'esl-projects-view';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var btn = document.getElementById('menu-btn');
  if (!btn || typeof HTMLDialogElement !== 'function') return;

  var root = document.documentElement;
  var view = readView();
  var dialog;
  var groupsEl;
  var switchEl;
  var viewBtns = [];
  var closing = false;
  var closeTimer = null;
  var closeOnEnd = null;
  var pendingHash = '';
  var downOnBackdrop = false;

  function readView() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'category' || v === 'platform') return v;
    } catch (e) {}
    return 'category';
  }

  function writeView(v) {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }

  function norm(p) {
    p = p.replace(/index\.html$/, '');
    if (p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(pathD, className) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    if (className) s.setAttribute('class', className);
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', pathD);
    s.appendChild(p);
    return s;
  }

  function categoryLabel(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i].label;
    }
    return '';
  }

  function badge(source) {
    var open = source === 'open';
    return el('span', 'src-badge ' + (open ? 'src-open' : 'src-closed'), open ? 'Open source' : 'Closed source');
  }

  function buildItem(project, meta) {
    var li = el('li');
    var link;
    var name;
    if (project.soon || !project.href) {
      link = el('div', 'drawer-link is-soon');
      link.appendChild(el('span', 'drawer-name', project.name));
      link.appendChild(el('span', 'drawer-meta', 'In the works'));
      link.appendChild(badge(project.source));
      li.appendChild(link);
      return li;
    }
    link = el('a', 'drawer-link');
    link.setAttribute('href', project.href);
    name = el('span', 'drawer-name', project.name);
    if (project.external) {
      link.setAttribute('rel', 'noopener');
      name.appendChild(svg('M7 17L17 7M8 7h9v9', 'drawer-ext'));
    } else if (norm(link.pathname) === norm(location.pathname)) {
      link.setAttribute('aria-current', 'page');
    }
    link.appendChild(name);
    link.appendChild(el('span', 'drawer-meta', meta));
    link.appendChild(badge(project.source));
    li.appendChild(link);
    return li;
  }

  function buildGroup(label, items) {
    var section = el('section', 'drawer-group');
    var ul = el('ul');
    section.appendChild(el('h3', null, label));
    for (var i = 0; i < items.length; i++) ul.appendChild(items[i]);
    section.appendChild(ul);
    return section;
  }

  function renderGroups() {
    var i;
    var j;
    var p;
    var items;
    var soon = [];
    while (groupsEl.firstChild) groupsEl.removeChild(groupsEl.firstChild);

    if (view === 'category') {
      for (i = 0; i < CATEGORIES.length; i++) {
        items = [];
        for (j = 0; j < PROJECTS.length; j++) {
          p = PROJECTS[j];
          if (!p.soon && p.category === CATEGORIES[i].id) items.push(buildItem(p, p.platforms.join(' · ')));
        }
        if (items.length) groupsEl.appendChild(buildGroup(CATEGORIES[i].label, items));
      }
    } else {
      for (i = 0; i < PLATFORMS.length; i++) {
        items = [];
        for (j = 0; j < PROJECTS.length; j++) {
          p = PROJECTS[j];
          if (!p.soon && p.platforms.indexOf(PLATFORMS[i]) !== -1) items.push(buildItem(p, categoryLabel(p.category)));
        }
        if (items.length) groupsEl.appendChild(buildGroup(PLATFORMS[i], items));
      }
    }

    for (j = 0; j < PROJECTS.length; j++) {
      if (PROJECTS[j].soon) soon.push(buildItem(PROJECTS[j], ''));
    }
    if (soon.length) groupsEl.appendChild(buildGroup('Coming soon', soon));
  }

  function setView(v) {
    view = v;
    switchEl.setAttribute('data-view', v);
    for (var i = 0; i < viewBtns.length; i++) {
      viewBtns[i].setAttribute('aria-pressed', viewBtns[i].getAttribute('data-view') === v ? 'true' : 'false');
    }
    renderGroups();
  }

  function viewButton(id, label) {
    var b = el('button', null, label);
    b.type = 'button';
    b.setAttribute('data-view', id);
    b.setAttribute('aria-pressed', view === id ? 'true' : 'false');
    b.addEventListener('click', function () {
      if (view === id) return;
      writeView(id);
      setView(id);
    });
    viewBtns.push(b);
    return b;
  }

  function build() {
    dialog = el('dialog', 'drawer');
    dialog.id = 'projects-drawer';
    dialog.setAttribute('aria-labelledby', 'drawer-title');

    var head = el('div', 'drawer-head');
    var title = el('h2', null, 'Projects');
    title.id = 'drawer-title';
    var close = el('button', 'drawer-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(svg('M6 6l12 12M18 6L6 18'));
    close.addEventListener('click', closeDrawer);
    head.appendChild(title);
    head.appendChild(close);

    switchEl = el('div', 'view-switch');
    switchEl.setAttribute('role', 'group');
    switchEl.setAttribute('aria-label', 'Group projects by');
    switchEl.setAttribute('data-view', view);
    switchEl.appendChild(viewButton('category', 'Category'));
    switchEl.appendChild(viewButton('platform', 'Platform'));

    groupsEl = el('div', 'drawer-groups');

    var foot = el('div', 'drawer-foot');
    var all = el('a', 'btn btn-primary drawer-all', 'All projects');
    all.setAttribute('href', '/projects/');
    if (norm(location.pathname) === '/projects/') all.setAttribute('aria-current', 'page');
    foot.appendChild(all);

    dialog.appendChild(head);
    dialog.appendChild(switchEl);
    dialog.appendChild(groupsEl);
    dialog.appendChild(foot);
    document.body.appendChild(dialog);

    renderGroups();

    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeDrawer();
    });

    dialog.addEventListener('pointerdown', function (e) {
      downOnBackdrop = e.target === dialog && isOutside(e);
    });

    dialog.addEventListener('click', function (e) {
      var t = e.target;
      var wasDown = downOnBackdrop;
      downOnBackdrop = false;
      if (t === dialog) {
        if (wasDown && isOutside(e)) closeDrawer();
        return;
      }
      while (t && t !== dialog && t.nodeName !== 'A') t = t.parentNode;
      if (t && t.nodeName === 'A') {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0 || e.defaultPrevented) return;
        var href = t.getAttribute('href') || '';
        if (href.indexOf('#') !== -1 && norm(t.pathname) === norm(location.pathname)) {
          pendingHash = href.split('#')[1] || '';
          closeDrawer();
        }
      }
    });

    dialog.addEventListener('close', function () {
      cancelPendingClose();
      closing = false;
      dialog.classList.remove('open');
      root.classList.remove('drawer-open');
      btn.setAttribute('aria-expanded', 'false');
      var target = pendingHash ? document.getElementById(pendingHash) : null;
      pendingHash = '';
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      } else {
        btn.focus();
      }
    });
  }

  function isOutside(e) {
    var r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }

  function cancelPendingClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (closeOnEnd) {
      dialog.removeEventListener('transitionend', closeOnEnd);
      closeOnEnd = null;
    }
  }

  function openDrawer() {
    if (!dialog) build();
    cancelPendingClose();
    if (dialog.open) return;
    closing = false;
    dialog.showModal();
    root.classList.add('drawer-open');
    btn.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(function () {
      dialog.classList.add('open');
    });
  }

  function closeDrawer() {
    if (!dialog || !dialog.open || closing) return;
    closing = true;
    dialog.classList.remove('open');

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function finish() {
      cancelPendingClose();
      if (dialog.open) dialog.close();
    }

    if (reduce) {
      finish();
      return;
    }
    closeOnEnd = function (e) {
      if (e.target === dialog && e.propertyName === 'transform') finish();
    };
    dialog.addEventListener('transitionend', closeOnEnd);
    closeTimer = setTimeout(finish, 320);
  }

  // Leaving a page into the back/forward cache must not restore it with the drawer open.
  window.addEventListener('pagehide', function () {
    if (dialog && dialog.open) dialog.close();
  });

  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-controls', 'projects-drawer');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    openDrawer();
  });
})();
