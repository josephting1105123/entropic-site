/* ==========================================================================
   qv-phone.js - a tappable replica of the Quick Vote web app, for the phone
   on /quick-vote/.

   Every [data-qv] element gets its own independent copy of the app. The
   attribute value (join | vote | results | host) picks the screen it opens
   on. Nothing here talks to a server: the poll, the counts and the "other
   people" voting are all local and fake.

   How it fits on the page (same idea as phone.js on /schedule/):
   - The app is laid out at a true device width (DEV_W = 360px) inside .qv-dev,
     then scaled down with transform: scale(var(--k)). layout() sets --k from
     the frame's real width and --dev-h so the scaled app fills the frame.
   - segments.js moves each scene's .stage into one pinned pane, so layout()
     also re-runs when the host is shown again or its stage changes.

   CSP: no inline styles or scripts. Dynamic values go through
   element.style.setProperty (CSSOM) or classes; typed text only ever goes in
   through textContent.

   Focus: nothing here calls focus() on load, only in response to something
   the visitor did.
   ========================================================================== */
(function () {
  "use strict";

  var DEV_W = 360;
  var SVGNS = "http://www.w3.org/2000/svg";

  var QUESTION = "Who should be next year's fellowship president?";
  var OPTIONS = ["Grace Lim", "Daniel Tan", "Esther Wong", "Joshua Lee"];
  var START_COUNTS = [5, 3, 2, 1];
  var WEIGHTS = [4, 3, 2, 1];
  var WAITING = ["Jason"];
  var IN_ROOM = 14;
  var MAX_ADDED = 14;
  var JOIN_MS = 1200;
  var DOT = "·";

  var root = document.documentElement;
  var reduceQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var uid = 0;
  var apps = [];

  /* ----------------------------------------------------------------------
     1. Small DOM helpers
     ---------------------------------------------------------------------- */

  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function sv(cls, viewBox, shapes) {
    var n = document.createElementNS(SVGNS, "svg");
    n.setAttribute("viewBox", viewBox);
    n.setAttribute("aria-hidden", "true");
    n.setAttribute("focusable", "false");
    n.setAttribute("class", cls);
    for (var i = 0; i < shapes.length; i++) {
      var c = document.createElementNS(SVGNS, shapes[i][0]);
      var a = shapes[i][1];
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) c.setAttribute(k, a[k]);
      n.appendChild(c);
    }
    return n;
  }

  function iconCheck(cls) {
    return sv("qv-ic qv-ic--chk " + cls, "0 0 24 24", [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]]);
  }

  function iconSun() {
    return sv("qv-ic qv-i-sun", "0 0 24 24", [
      ["circle", { cx: "12", cy: "12", r: "4" }],
      ["path", { d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" }]
    ]);
  }

  function iconMoon() {
    return sv("qv-ic qv-i-moon", "0 0 24 24", [["path", { d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" }]]);
  }

  // The studio flask. Each app copy needs its own mask id: up to five copies
  // share the page with the page's own top bar, which already has a mask.
  var maskN = 0;
  var FLASK = "M216 104v104L128 372a32 32 0 0 0 28 48h200a32 32 0 0 0 28-48L296 208V104";

  function iconFlask() {
    var id = "qv-mark-liquid-" + (++maskN);
    var n = sv("qv-mark__svg", "76 82 360 360", [
      ["rect", { x: "0", y: "310", width: "512", height: "202", fill: "currentColor", stroke: "none", mask: "url(#" + id + ")" }],
      ["path", { d: FLASK }],
      ["path", { d: "M196 104h120" }]
    ]);
    n.setAttribute("fill", "none");
    n.setAttribute("stroke", "currentColor");
    n.setAttribute("stroke-width", "36");
    n.setAttribute("stroke-linecap", "round");
    n.setAttribute("stroke-linejoin", "round");

    var mask = document.createElementNS(SVGNS, "mask");
    mask.setAttribute("id", id);
    var fillP = document.createElementNS(SVGNS, "path");
    fillP.setAttribute("d", FLASK + "z");
    fillP.setAttribute("fill", "#fff");
    fillP.setAttribute("stroke", "none");
    var edgeP = document.createElementNS(SVGNS, "path");
    edgeP.setAttribute("d", FLASK);
    edgeP.setAttribute("stroke", "#000");
    edgeP.setAttribute("stroke-width", "60");
    mask.appendChild(fillP);
    mask.appendChild(edgeP);
    n.insertBefore(mask, n.firstChild);
    return n;
  }

  // In-app headings are plain divs with a heading role: the host page's own
  // h1/h2 rules (this app sits inside a .scene) can't reach them.
  function heading(text, cls) {
    var h = mk("div", cls, text);
    h.setAttribute("role", "heading");
    h.setAttribute("aria-level", "3");
    h.setAttribute("tabindex", "-1");
    return h;
  }

  function focusNow(node) {
    if (!node || !node.focus) return;
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  function reduced() { return !!(reduceQ && reduceQ.matches); }

  /* ----------------------------------------------------------------------
     2. Theme: the phone starts light; only its own in-app button flips it
     ---------------------------------------------------------------------- */

  function pageIsLight() { return true; }

  /* ----------------------------------------------------------------------
     3. The results bars, shared by the voter and host screens
     ---------------------------------------------------------------------- */

  function makeBars(counts, mine) {
    var list = mk("ul", "qv-rows");
    var rows = [];
    for (var i = 0; i < OPTIONS.length; i++) {
      var li = mk("li", "qv-row");
      var head = mk("div", "qv-row__h");
      var name = mk("span", "qv-row__n");
      name.appendChild(mk("span", "", OPTIONS[i]));
      if (mine === i) {
        var tag = mk("span", "qv-tag");
        tag.appendChild(iconCheck("qv-tag__ic"));
        tag.appendChild(mk("span", "qv-sr", "Your pick"));
        name.appendChild(tag);
      }
      var val = mk("span", "qv-row__v");
      head.appendChild(name);
      head.appendChild(val);
      var track = mk("div", "qv-track");
      track.setAttribute("aria-hidden", "true");
      var fill = mk("div", "qv-fill");
      track.appendChild(fill);
      li.appendChild(head);
      li.appendChild(track);
      list.appendChild(li);
      rows.push({ li: li, val: val, fill: fill });
    }

    function figures() {
      var total = 0, max = 0, i;
      for (i = 0; i < counts.length; i++) { total += counts[i]; if (counts[i] > max) max = counts[i]; }
      var out = [];
      for (i = 0; i < counts.length; i++) {
        out.push({ c: counts[i], pct: total ? Math.round(counts[i] / total * 100) : 0, lead: max > 0 && counts[i] === max });
      }
      return out;
    }

    function paint(first) {
      var f = figures(), i;
      for (i = 0; i < rows.length; i++) {
        rows[i].val.textContent = f[i].c + " " + DOT + " " + f[i].pct + "%";
        if (f[i].lead) rows[i].li.classList.add("is-lead"); else rows[i].li.classList.remove("is-lead");
        if (first) rows[i].fill.style.setProperty("--w", "0%");
      }
      if (first) {
        void list.offsetWidth; // commit the 0% so the first fill animates
        var go = function () {
          var g = figures();
          for (var j = 0; j < rows.length; j++) rows[j].fill.style.setProperty("--w", g[j].pct + "%");
        };
        if (window.requestAnimationFrame) window.requestAnimationFrame(go); else window.setTimeout(go, 16);
      } else {
        for (i = 0; i < rows.length; i++) rows[i].fill.style.setProperty("--w", f[i].pct + "%");
      }
    }

    return { el: list, update: paint };
  }

  /* ----------------------------------------------------------------------
     4. One app instance
     ---------------------------------------------------------------------- */

  function createApp(host, vp, dev, initial) {
    var n = ++uid;
    var s = {
      screen: initial,
      voterScreen: initial === "host" ? "join" : initial,
      mode: initial === "host" ? "admin" : "voter",
      pin: initial === "join" ? "4829" : "",
      name: "",
      pick: null,
      counts: START_COUNTS.slice(),
      voted: false,
      live: true,
      waiting: WAITING.slice(),
      inRoom: IN_ROOM,
      theme: null,
      joining: false
    };
    if (initial === "results") { s.voted = true; s.pick = 1; s.counts[1]++; syncRoom(); }

    var bars = null;        // the bars on screen right now, if any
    var added = 0;          // fake votes trickled in so far
    var visible = true;
    var joinTimer = null;
    var tickTimer = null;
    var roomEl = null;      // the host screen's "In the room" line, while it is showing
    var stage = host.parentNode;
    while (stage && stage.nodeType === 1 && !(stage.classList && stage.classList.contains("stage"))) stage = stage.parentNode;

    /* --- Frame: live region, top bar, scrolling page ---------------------- */

    var live = mk("div", "qv-sr");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("role", "status");

    var bar = mk("div", "qv-bar");
    var brand = mk("span", "qv-brand");
    brand.setAttribute("aria-hidden", "true");
    var mark = mk("span", "qv-mark");
    mark.appendChild(iconFlask());
    brand.appendChild(mark);
    brand.appendChild(mk("span", "qv-brand__t", "Entropic"));

    var seg = mk("div", "qv-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "View as");
    var segVoter = mk("button", "qv-seg__b", "Voter");
    var segAdmin = mk("button", "qv-seg__b", "Admin");
    segVoter.type = "button";
    segAdmin.type = "button";
    seg.appendChild(segVoter);
    seg.appendChild(segAdmin);

    var themeBtn = mk("button", "qv-theme");
    themeBtn.type = "button";
    themeBtn.appendChild(iconSun());
    themeBtn.appendChild(iconMoon());

    bar.appendChild(brand);
    bar.appendChild(seg);
    bar.appendChild(themeBtn);

    var page = mk("div", "qv-page");

    dev.appendChild(live);
    dev.appendChild(bar);
    dev.appendChild(page);

    var sayTimer = null;
    function say(msg) {
      live.textContent = "";
      if (sayTimer) window.clearTimeout(sayTimer);
      sayTimer = window.setTimeout(function () { live.textContent = msg; }, 60);
    }

    function isLight() {
      if (s.theme) return s.theme === "light";
      return pageIsLight();
    }

    function applyTheme() {
      var l = isLight();
      var fns = [dev, vp];
      for (var i = 0; i < fns.length; i++) {
        if (l) fns[i].classList.add("is-light"); else fns[i].classList.remove("is-light");
      }
      themeBtn.setAttribute("aria-label", l ? "Switch to dark theme" : "Switch to light theme");
    }

    themeBtn.addEventListener("click", function () {
      s.theme = isLight() ? "dark" : "light";
      applyTheme();
    });

    function syncSeg() {
      segVoter.setAttribute("aria-pressed", s.mode === "voter" ? "true" : "false");
      segAdmin.setAttribute("aria-pressed", s.mode === "admin" ? "true" : "false");
      if (s.mode === "voter") { segVoter.classList.add("is-on"); segAdmin.classList.remove("is-on"); }
      else { segAdmin.classList.add("is-on"); segVoter.classList.remove("is-on"); }
    }

    segVoter.addEventListener("click", function () {
      if (s.mode === "voter") return;
      show(s.voterScreen, { announce: true });
    });
    segAdmin.addEventListener("click", function () {
      if (s.mode === "admin") return;
      show("host", { announce: true });
    });

    /* --- Screens ---------------------------------------------------------- */

    function announceText(name) {
      if (name === "join") return s.joining ? "You're in the queue" : "Join a poll";
      if (name === "vote") return "Ballot";
      if (name === "results") return "Vote recorded";
      return "Host view";
    }

    // opts.announce: say the new screen out loud. opts.focus: move focus to its heading.
    function show(name, opts) {
      opts = opts || {};
      s.screen = name;
      s.mode = name === "host" ? "admin" : "voter";
      if (name !== "host") s.voterScreen = name;
      syncSeg();
      bars = null;
      roomEl = null;
      while (page.firstChild) page.removeChild(page.firstChild);

      var built = name === "join" ? buildJoin()
        : name === "vote" ? buildVote()
        : name === "results" ? buildResults()
        : buildHost();
      page.appendChild(built.node);
      page.scrollTop = 0;
      if (bars && !opts.defer) bars.update(true);
      if (bars) arm();

      if (opts.announce) say(announceText(name));
      if (opts.focus) focusNow(built.head);
    }

    function startOver() {
      if (joinTimer) { window.clearTimeout(joinTimer); joinTimer = null; }
      s.joining = false;
      s.pin = "";
      s.name = "";
      s.pick = null;
      s.voted = false;
      s.counts = START_COUNTS.slice();
      added = 0;
      show("join", { announce: true, focus: true });
      arm();
    }

    /* Join ---------------------------------------------------------------- */

    function buildWait() {
      var card = mk("div", "qv-card qv-wait");
      var head = heading("You're in the queue", "qv-h2");
      card.appendChild(head);
      card.appendChild(mk("div", "qv-text", "The host will let you in."));
      var dots = mk("div", "qv-dots");
      dots.setAttribute("aria-hidden", "true");
      for (var i = 0; i < 3; i++) dots.appendChild(mk("i", ""));
      card.appendChild(dots);
      return { node: card, head: head };
    }

    function buildJoin() {
      var node = mk("div", "qv-screen qv-pad");

      var pills = mk("div", "qv-pills");
      pills.setAttribute("aria-hidden", "true");
      pills.appendChild(mk("span", "qv-pill qv-pill--a"));
      pills.appendChild(mk("span", "qv-pill qv-pill--b"));
      pills.appendChild(mk("span", "qv-pill qv-pill--c"));
      node.appendChild(pills);
      node.appendChild(mk("div", "qv-h1", "Put it to a vote."));
      node.appendChild(mk("div", "qv-lead", "Make a poll, read out the 6-digit PIN, and everyone votes from their phone. No accounts, nothing to install."));

      if (s.joining) {
        var w = buildWait();
        node.appendChild(w.node);
        return { node: node, head: w.head };
      }

      var card = mk("form", "qv-card");
      card.setAttribute("novalidate", "");
      var head = heading("Join a poll", "qv-h2");
      card.appendChild(head);

      var pinId = "qv-pin-" + n;
      var nameId = "qv-name-" + n;

      var l1 = mk("label", "qv-label", "Poll PIN");
      l1.setAttribute("for", pinId);
      card.appendChild(l1);

      var pinBox = mk("div", "qv-pin");
      var cells = [];
      var cellRow = mk("div", "qv-cells");
      cellRow.setAttribute("aria-hidden", "true");
      for (var i = 0; i < 6; i++) {
        var c = mk("span", "qv-cell");
        cells.push(c);
        cellRow.appendChild(c);
      }
      var pinIn = mk("input", "qv-pin__in");
      pinIn.type = "text";
      pinIn.id = pinId;
      pinIn.setAttribute("inputmode", "numeric");
      pinIn.setAttribute("autocomplete", "off");
      pinIn.setAttribute("autocorrect", "off");
      pinIn.setAttribute("spellcheck", "false");
      pinIn.setAttribute("maxlength", "6");
      pinIn.setAttribute("aria-label", "Poll PIN");
      pinIn.value = s.pin;
      pinBox.appendChild(cellRow);
      pinBox.appendChild(pinIn);
      card.appendChild(pinBox);

      var l2 = mk("label", "qv-label qv-label--gap", "Your name");
      l2.setAttribute("for", nameId);
      card.appendChild(l2);

      var nameIn = mk("input", "qv-input");
      nameIn.type = "text";
      nameIn.id = nameId;
      nameIn.setAttribute("maxlength", "40");
      nameIn.setAttribute("placeholder", "The host sees this");
      nameIn.setAttribute("aria-label", "Your name");
      nameIn.setAttribute("autocomplete", "off");
      nameIn.value = s.name;
      card.appendChild(nameIn);

      var go = mk("button", "qv-btn", "Join");
      go.type = "submit";
      card.appendChild(go);

      function paintCells() {
        for (var j = 0; j < 6; j++) {
          var ch = s.pin.charAt(j);
          cells[j].textContent = ch || DOT;
          if (ch) { cells[j].classList.add("is-filled"); cells[j].classList.remove("is-empty"); }
          else { cells[j].classList.add("is-empty"); cells[j].classList.remove("is-filled"); }
        }
      }
      function ready() { return s.pin.length === 6 && s.name.replace(/\s+/g, "").length > 0; }
      function paintBtn() { go.disabled = !ready(); }

      pinIn.addEventListener("input", function () {
        var v = pinIn.value.replace(/\D/g, "").slice(0, 6);
        if (v !== pinIn.value) pinIn.value = v;
        s.pin = v;
        paintCells();
        paintBtn();
        if (v.length === 6) focusNow(nameIn);
      });
      nameIn.addEventListener("input", function () {
        s.name = nameIn.value;
        paintBtn();
      });
      card.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!ready() || s.joining) return;
        s.joining = true;
        show("join", { announce: true, focus: true });
        joinTimer = window.setTimeout(function () {
          joinTimer = null;
          if (!s.joining) return;
          s.joining = false;
          s.voterScreen = "vote";
          if (s.mode === "voter") show("vote", { announce: true, focus: page.contains(document.activeElement) });
        }, JOIN_MS);
      });

      paintCells();
      paintBtn();
      node.appendChild(card);
      return { node: node, head: head };
    }

    /* Ballot -------------------------------------------------------------- */

    function buildVote() {
      var node = mk("div", "qv-screen qv-pad");
      var card = mk("div", "qv-card");
      var head = heading(QUESTION, "qv-h2");
      card.appendChild(head);
      card.appendChild(mk("div", "qv-text", "Select one."));

      var group = mk("div", "qv-opts");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", QUESTION);
      var opts = [];
      var submit = mk("button", "qv-btn", "Submit vote");
      submit.type = "button";

      function paint() {
        for (var i = 0; i < opts.length; i++) {
          var on = s.pick === i;
          opts[i].setAttribute("aria-checked", on ? "true" : "false");
          opts[i].setAttribute("tabindex", (s.pick === null ? i === 0 : on) ? "0" : "-1");
          if (on) opts[i].classList.add("is-on"); else opts[i].classList.remove("is-on");
        }
        submit.disabled = s.pick === null;
      }
      function choose(i, andFocus) {
        s.pick = i;
        paint();
        if (andFocus) focusNow(opts[i]);
      }

      OPTIONS.forEach(function (label, i) {
        var b = mk("button", "qv-opt");
        b.type = "button";
        b.setAttribute("role", "radio");
        var ring = mk("span", "qv-ring");
        ring.appendChild(iconCheck("qv-ring__ic"));
        b.appendChild(ring);
        b.appendChild(mk("span", "qv-opt__t", label));
        b.addEventListener("click", function () { choose(i, false); });
        opts.push(b);
        group.appendChild(b);
      });

      group.addEventListener("keydown", function (e) {
        var k = e.key, d = 0;
        if (k === "ArrowDown" || k === "ArrowRight" || k === "Down" || k === "Right") d = 1;
        else if (k === "ArrowUp" || k === "ArrowLeft" || k === "Up" || k === "Left") d = -1;
        else return;
        e.preventDefault();
        var len = opts.length;
        var at = opts.indexOf(document.activeElement);
        var cur = at >= 0 ? at : (s.pick === null ? 0 : s.pick);
        choose((cur + d + len) % len, true);
      });

      submit.addEventListener("click", function () {
        if (s.pick === null) return;
        s.counts[s.pick]++;
        s.voted = true;
        syncRoom();
        show("results", { announce: true, focus: true });
      });

      card.appendChild(group);
      card.appendChild(submit);
      paint();
      node.appendChild(card);
      return { node: node, head: head };
    }

    /* Results ------------------------------------------------------------- */

    function buildResults() {
      var node = mk("div", "qv-screen qv-pad");

      var done = mk("div", "qv-card qv-center");
      var badge = mk("div", "qv-badge");
      badge.setAttribute("aria-hidden", "true");
      badge.appendChild(iconCheck("qv-badge__ic"));
      var head = heading("Vote recorded", "qv-h2");
      done.appendChild(badge);
      done.appendChild(head);
      done.appendChild(mk("div", "qv-q", QUESTION));
      node.appendChild(done);

      var card = mk("div", "qv-card");
      if (s.live) {
        card.appendChild(heading("Live results", "qv-h3"));
        bars = makeBars(s.counts, s.pick);
        card.appendChild(bars.el);
      } else {
        card.appendChild(heading("Results are hidden", "qv-h3"));
        card.appendChild(mk("div", "qv-text", "The host decides when to show them."));
      }
      node.appendChild(card);

      var again = mk("button", "qv-link qv-link--center", "Start over");
      again.type = "button";
      again.addEventListener("click", startOver);
      node.appendChild(again);
      return { node: node, head: head };
    }

    /* Host ---------------------------------------------------------------- */

    function buildHost() {
      var node = mk("div", "qv-screen qv-pad");

      var poll = mk("div", "qv-card");
      poll.appendChild(mk("div", "qv-label", "Your poll"));
      poll.appendChild(mk("div", "qv-q qv-q--left", QUESTION));
      poll.appendChild(mk("div", "qv-label qv-label--gap", "PIN"));
      poll.appendChild(mk("div", "qv-bigpin", "482 915"));
      poll.appendChild(mk("div", "qv-note", "Read this out to the room."));
      node.appendChild(poll);

      var queue = mk("div", "qv-card");
      var qhead = mk("div", "qv-card__h");
      var qtitle = heading("", "qv-h3");
      var all = mk("button", "qv-link", "Approve all");
      all.type = "button";
      qhead.appendChild(qtitle);
      qhead.appendChild(all);
      var list = mk("ul", "qv-queue");
      var empty = mk("div", "qv-text", "Nobody waiting.");
      queue.appendChild(qhead);
      queue.appendChild(list);
      queue.appendChild(empty);
      node.appendChild(queue);

      var room = mk("div", "qv-inroom");
      roomEl = room;
      node.appendChild(room);

      function paintQueue(refocus) {
        qtitle.textContent = "Waiting to join " + DOT + " " + s.waiting.length;
        room.textContent = roomText();
        all.disabled = s.waiting.length === 0;
        empty.hidden = s.waiting.length > 0;
        while (list.firstChild) list.removeChild(list.firstChild);
        s.waiting.forEach(function (who) {
          var li = mk("li", "qv-person");
          li.appendChild(mk("span", "qv-person__n", who));
          var ok = mk("button", "qv-pillbtn", "Approve");
          ok.type = "button";
          ok.setAttribute("aria-label", "Approve " + who);
          ok.addEventListener("click", function () {
            var at = s.waiting.indexOf(who);
            if (at < 0) return;
            s.waiting.splice(at, 1);
            s.inRoom++;
            paintQueue(true);
          });
          li.appendChild(ok);
          list.appendChild(li);
        });
        if (refocus) {
          var next = list.querySelector("button");
          focusNow(next || qtitle);
        }
      }
      all.addEventListener("click", function () {
        s.inRoom += s.waiting.length;
        s.waiting = [];
        paintQueue(true);
      });

      var liveCard = mk("div", "qv-card");
      var liveRow = mk("div", "qv-card__h");
      var liveId = "qv-live-" + n;
      var liveLabel = mk("span", "qv-switchlabel", "Live results");
      liveLabel.id = liveId;
      var sw = mk("button", "qv-switch");
      sw.type = "button";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-labelledby", liveId);
      sw.appendChild(mk("span", "qv-switch__knob"));
      liveRow.appendChild(liveLabel);
      liveRow.appendChild(sw);
      var helper = mk("div", "qv-note");
      function paintSwitch() {
        sw.setAttribute("aria-checked", s.live ? "true" : "false");
        if (s.live) sw.classList.add("is-on"); else sw.classList.remove("is-on");
        helper.textContent = s.live ? "Voters can see the results." : "Results are hidden from voters.";
      }
      sw.addEventListener("click", function () { s.live = !s.live; paintSwitch(); });
      liveCard.appendChild(liveRow);
      liveCard.appendChild(helper);
      node.appendChild(liveCard);

      var votes = mk("div", "qv-card");
      votes.appendChild(heading("Votes so far", "qv-h3"));
      bars = makeBars(s.counts, null);
      votes.appendChild(bars.el);
      node.appendChild(votes);

      paintQueue(false);
      paintSwitch();
      return { node: node, head: qtitle };
    }

    /* --- Other people voting ---------------------------------------------- */

    function pickWeighted() {
      var total = 0, i;
      for (i = 0; i < WEIGHTS.length; i++) total += WEIGHTS[i];
      var r = Math.random() * total;
      for (i = 0; i < WEIGHTS.length; i++) {
        r -= WEIGHTS[i];
        if (r < 0) return i;
      }
      return 0;
    }

    function roomText() { return "In the room " + DOT + " " + s.inRoom; }

    // Votes never outnumber the people in the room.
    function syncRoom() {
      var total = 0;
      for (var i = 0; i < s.counts.length; i++) total += s.counts[i];
      if (total > s.inRoom) s.inRoom = total;
    }

    function scheduleTick() {
      tickTimer = window.setTimeout(tick, 1600 + Math.floor(Math.random() * 1001));
    }

    // Starts the trickle if it is idle. An ineligible tick stops the loop
    // instead of polling, so whatever makes it eligible again calls this.
    function arm() {
      if (!tickTimer && added < MAX_ADDED) scheduleTick();
    }

    function tick() {
      tickTimer = null;
      if (added >= MAX_ADDED) return;
      var inert = stage && stage.hasAttribute && stage.hasAttribute("inert");
      if (!(bars && visible && !reduced() && !inert && !document.hidden)) return;
      s.counts[pickWeighted()]++;
      s.inRoom++;
      added++;
      bars.update(false);
      if (roomEl) roomEl.textContent = roomText();
      arm();
    }

    document.addEventListener("visibilitychange", function () { if (!document.hidden) arm(); });

    /* --- Go ----------------------------------------------------------------- */

    applyTheme();
    // The opening screen is built before the phone is in the page, so its bars
    // are filled by start(), once there is a layout for the width to animate from.
    show(initial, { announce: false, focus: false, defer: true });

    return {
      applyTheme: applyTheme,
      setVisible: function (v) { visible = v; if (v) arm(); },
      arm: arm,
      start: function () {
        if (bars) bars.update(true);
        arm();
      }
    };
  }

  /* ----------------------------------------------------------------------
     5. Mount loop
     ---------------------------------------------------------------------- */

  function mount(host) {
    if (host.getAttribute("data-live") === "1") return;
    var initial = host.getAttribute("data-qv") || "join";
    if (initial !== "join" && initial !== "vote" && initial !== "results" && initial !== "host") initial = "join";

    var vp = mk("div", "qv-vp qv");
    var dev = mk("div", "qv-dev qv");
    vp.appendChild(dev);

    var app = createApp(host, vp, dev, initial);
    apps.push(app);

    // The app fills the frame exactly: the width sets the scale, and the
    // device height follows from the frame's own shape.
    function layout() {
      var w = vp.clientWidth, h = vp.clientHeight;
      if (!w || !h) return;
      var k = w / DEV_W;
      dev.style.setProperty("--k", String(k));
      dev.style.setProperty("--dev-h", (h / k) + "px");
    }

    host.setAttribute("role", "region");
    var what = { join: "joining a poll", vote: "the ballot", results: "live results", host: "the host view" };
    host.setAttribute("aria-label", "Live demo of Quick Vote, " + what[initial] + ". Tap around.");
    host.setAttribute("data-live", "1");
    var shots = host.querySelectorAll(".qv-shot");
    for (var i = 0; i < shots.length; i++) {
      if (shots[i].parentNode) shots[i].parentNode.removeChild(shots[i]);
    }
    host.appendChild(vp);
    layout();
    if (typeof ResizeObserver === "function") new ResizeObserver(layout).observe(vp);
    else window.addEventListener("resize", layout);

    // segments.js moves the stage (and toggles is-active / inert on it) after
    // this runs, so re-measure when the host shows up again or its stage changes.
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function (entries) {
        layout();
        var e = entries[entries.length - 1];
        app.setVisible(!!e && e.intersectionRatio >= 0.3);
      }, { threshold: [0, 0.3] }).observe(host);
    }
    var stage = host.parentNode;
    while (stage && stage.nodeType === 1 && !(stage.classList && stage.classList.contains("stage"))) stage = stage.parentNode;
    if (stage && stage.nodeType === 1 && typeof MutationObserver === "function") {
      new MutationObserver(function () { layout(); app.arm(); }).observe(stage, { attributes: true, attributeFilter: ["class", "inert"] });
    }
    app.start();
  }

  function mountAll() {
    var hosts = document.querySelectorAll("[data-qv]");
    for (var i = 0; i < hosts.length; i++) {
      try { mount(hosts[i]); } catch (err) { if (window.console) console.error("qv-phone.js:", err); }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
