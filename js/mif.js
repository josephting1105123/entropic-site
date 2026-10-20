/* mif.js - MIF Finance page: lifts the dimmed start states.
   site.js adds html.motion, which dims .scene__copy, .stage and .media-offbridge
   until they carry "in". segments.js reveals .scene__copy and .stage, but not
   .media-offbridge, and it doesn't show the hero up front, so this covers all
   three as each one scrolls into view.
   Loaded with defer after site.js, so html.motion is already set when this runs.
   Under reduced motion site.js never sets html.motion and nothing is dimmed. */
(function () {
  'use strict';

  if (!document.documentElement.classList.contains('motion')) return;

  var SEL = '.scene__copy, .stage, .media-offbridge';
  var els = document.querySelectorAll(SEL);
  var i;

  // The hero never starts dimmed.
  var intro = document.getElementById('intro');
  if (intro) {
    var hero = intro.querySelectorAll(SEL);
    for (i = 0; i < hero.length; i++) hero[i].classList.add('in');
  }

  var io = new IntersectionObserver(function (entries) {
    for (var n = 0; n < entries.length; n++) {
      if (entries[n].isIntersecting) {
        entries[n].target.classList.add('in');
        io.unobserve(entries[n].target);
      }
    }
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

  for (i = 0; i < els.length; i++) {
    if (!els[i].classList.contains('in')) io.observe(els[i]);
  }
})();
