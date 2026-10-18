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
})();
