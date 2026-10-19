/* ==========================================================================
   phone.js — a live, tappable replica of the Schedule app.

   Every [data-app] element becomes an independent app instance. The app is
   laid out at its true phone width (412 px) inside .dev and scaled to the
   frame with a transform, so it always looks like the real thing. Built with
   createElement/textContent only and styled through classes and CSSOM custom
   properties, because the CSP forbids inline styles.

   Layout of this file:
     1. data + date helpers      3. DOM helpers
     2. colour assignment        4. the app (screens, sheets, snackbar)
                                 5. mount loop
   ========================================================================== */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var DEV_W = 412;
  var HOUR_PX = 84;
  var WK_PAD = 12;          // blank space above 00:00 and below 24:00 in the week grid
  var MAX_SLOTS = 4;        // chip rows in a month cell, the last one doubling as "•••"
  var SLIDE_MS = 300;
  var SWIPE_PX = 60;

  /* ----------------------------------------------------------------------
     1. Data + date helpers
     ---------------------------------------------------------------------- */

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // The simulated clock: Monday 19 October 2026, 13:20. Weeks start on Sunday.
  var TODAY = new Date(2026, 9, 19);
  var TODAY_KEY = "2026-10-19";
  var NOW = 13 * 60 + 20;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diffDays(a, b) {
    return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
  }
  function toMin(s) { var p = s.split(":"); return +p[0] * 60 + +p[1]; }
  function hm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function hm4(m) { return pad(Math.floor(m / 60)) + pad(m % 60); }
  function dow3(d) { return DOW[d.getDay()].slice(0, 3); }
  function shortDate(d) { return dow3(d) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
  function longDate(d) { return DOW[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]; }
  function range(e) { return hm(e.s) + " – " + hm(e.e); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var EVENTS = [];
  function T(title, day, s, e, loc) {
    var k = "2026-10-" + pad(day);
    EVENTS.push({ title: title, date: k, endDate: k, s: toMin(s), e: toMin(e), loc: loc || "", allDay: false, i: EVENTS.length });
  }
  function A(title, d1, d2) {
    EVENTS.push({ title: title, date: "2026-10-" + pad(d1), endDate: "2026-10-" + pad(d2), s: 0, e: 1440, loc: "", allDay: true, i: EVENTS.length });
  }

  T("Standup", 1, "09:00", "10:00");
  T("Climbing", 3, "18:00", "19:30");
  A("Orientation week", 5, 9);
  T("Dentist", 7, "10:00", "11:00");
  T("Lunch", 15, "12:00", "13:00");
  T("Recital", 29, "19:00", "21:00");
  T("Party", 31, "20:00", "23:00");
  A("Half term", 25, 27);
  T("Choir", 18, "16:00", "17:30");
  A("Term starts", 19, 19);
  T("Standup", 19, "09:00", "10:00");
  T("Design review", 19, "13:00", "14:30", "Studio 2");
  T("Budget call", 19, "14:00", "15:00");
  T("Climbing", 19, "18:00", "19:30", "The Arch");
  T("Lecture", 20, "10:00", "12:00");
  T("Clinic", 21, "09:00", "10:30");
  T("Gym", 21, "17:00", "18:00");
  T("Lab", 22, "14:00", "16:00");
  T("Standup", 22, "15:00", "16:00");
  T("Lunch", 23, "12:00", "13:00");
  T("Orientation", 24, "11:00", "14:00");
  T("Dinner", 24, "19:00", "20:30");

  var BDAYS = [
    { name: "Hannah", age: 30, md: "10-19" },
    { name: "Sam", age: 41, md: "10-27" }
  ];

  function makeTasks() {
    return [
      { id: 1, title: "Renew parking permit", date: "2026-10-09", time: "09:00", done: false },
      { id: 2, title: "Submit the report", date: TODAY_KEY, time: "17:00", done: false },
      { id: 3, title: "Call the bank", date: TODAY_KEY, time: "", done: false },
      { id: 4, title: "Book the van", date: TODAY_KEY, time: "08:30", done: true }
    ];
  }

  // All-day first, then by start time; the index breaks ties so the order is
  // the same in every engine (Array.sort was not always stable).
  function byOrder(a, b) {
    return (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) || a.s - b.s || a.i - b.i;
  }
  function eventsOn(k) {
    return EVENTS.filter(function (e) { return e.date <= k && k <= e.endDate; }).sort(byOrder);
  }
  function bdaysOn(k) {
    var out = [];
    BDAYS.forEach(function (b) {
      if (b.md === k.slice(5)) {
        out.push({
          title: b.name, sub: "Turns " + (b.age + (+k.slice(0, 4)) - 2026), date: k, endDate: k,
          allDay: true, s: 0, e: 1440, loc: "", bday: true, i: 1000 + out.length, idx: out.length
        });
      }
    });
    return out;
  }

  // Overlap windows: the stretches claimed by two or more events, adjacent
  // ones merged, each naming whoever touches it.
  function clashWindows(list) {
    var timed = list.filter(function (e) { return !e.allDay; });
    var pts = [];
    timed.forEach(function (e) { pts.push(e.s, e.e); });
    pts.sort(function (a, b) { return a - b; });
    var segs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (a === b) continue;
      var n = 0;
      for (var j = 0; j < timed.length; j++) if (timed[j].s <= a && timed[j].e >= b) n++;
      if (n < 2) continue;
      if (segs.length && segs[segs.length - 1][1] === a) segs[segs.length - 1][1] = b;
      else segs.push([a, b]);
    }
    return segs.map(function (sg) {
      return {
        s: sg[0], e: sg[1],
        events: timed.filter(function (e) { return e.s < sg[1] && e.e > sg[0]; })
      };
    });
  }

  /* ----------------------------------------------------------------------
     2. Colour assignment
     The app hands each day's events a brand colour in start order, all-day
     first; a multi-day event keeps the colour of its first day.
     ---------------------------------------------------------------------- */

  var PALETTE = ["#78A8E4", "#D26042", "#3F9A64", "#965AAE", "#EA7E5A", "#8E9BD6"];

  function channel(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  }
  function inkOn(hex) { return luminance(hex) > 0.179 ? "#0F172A" : "#FFFFFF"; }
  function colorOf(e) {
    if (e.bday) return PALETTE[e.idx % PALETTE.length];
    if (!e.color) e.color = PALETTE[eventsOn(e.date).indexOf(e) % PALETTE.length];
    return e.color;
  }

  /* ----------------------------------------------------------------------
     3. DOM helpers
     ---------------------------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(cls, label) {
    var b = el("button", cls);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
  }
  function setVars(node, map) {
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) node.style.setProperty(k, String(map[k]));
  }
  function colorVars(node, e) {
    var c = colorOf(e);
    setVars(node, { "--c": c, "--ink": inkOn(c) });
  }
  function svgIcon(id, cls) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "ap-i" + (cls ? " " + cls : ""));
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    var u = document.createElementNS(SVGNS, "use");
    u.setAttribute("href", "#" + id);
    s.appendChild(u);
    return s;
  }
  // Icons the page's sprite doesn't carry.
  var PATHS = {
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z",
    list: "M3 14h4v-4H3v4Zm0 5h4v-4H3v4ZM3 9h4V5H3v4Zm5 5h13v-4H8v4Zm0 5h13v-4H8v4ZM8 5v4h13V5H8Z",
    grid: "M20 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM8 20H4v-4h4v4Zm0-6H4v-4h4v4Zm0-6H4V4h4v4Zm6 12h-4v-4h4v4Zm0-6h-4v-4h4v4Zm0-6h-4V4h4v4Zm6 12h-4v-4h4v4Zm0-6h-4v-4h4v4Zm0-6h-4V4h4v4Z"
  };
  function pathIcon(name, cls) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "ap-i" + (cls ? " " + cls : ""));
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", PATHS[name]);
    s.appendChild(p);
    return s;
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function cardHead(iconId, title, warn) {
    var h = el("div", "ap-card__head" + (warn ? " ap-card__head--warn" : ""));
    if (iconId) h.appendChild(svgIcon(iconId));
    var t = el("div", "ap-card__title", title);
    t.setAttribute("role", "heading");
    t.setAttribute("aria-level", "2");
    h.appendChild(t);
    return h;
  }

  /* ----------------------------------------------------------------------
     4. The app
     ---------------------------------------------------------------------- */

  function buildApp(host, vp, dev, initial, anchor) {
    var tasks = makeTasks();
    var order = ["today", "week", "month", "settings"];
    var labels = { today: "Today", week: "Week", month: "Month", settings: "Settings" };
    var screens = {};
    var hooks = {};
    var navBtns = {};
    var active = initial;
    var offset = 0;            // days from the simulated today, as the Today pager shows
    var modal = null;
    var snackTimer = 0;
    var touched = false;
    var base, layer, snackEl, backEl;
    var todayShell = null;

    function scale() { return (vp.clientWidth / DEV_W) || 1; }

    /* ---- snackbar ---- */
    function snack(msg) {
      snackEl.textContent = msg;
      snackEl.classList.add("is-on");
      window.clearTimeout(snackTimer);
      snackTimer = window.setTimeout(function () { snackEl.classList.remove("is-on"); }, 2500);
    }

    /* ---- modal layer: bottom sheet and centred pop-up ---- */
    function closeModal(immediate) {
      if (!modal) return;
      var m = modal;
      modal = null;
      m.scrim.classList.remove("is-open");
      m.box.classList.remove("is-open");
      base.removeAttribute("inert");
      function done() {
        if (m.scrim.parentNode) m.scrim.parentNode.removeChild(m.scrim);
        if (m.box.parentNode) m.box.parentNode.removeChild(m.box);
      }
      if (immediate || reduced()) done(); else window.setTimeout(done, 280);
      if (m.prev && m.prev !== document.body && document.contains(m.prev) && m.prev.focus) {
        m.prev.focus({ preventScroll: true });
      }
    }

    function openModal(kind, build) {
      // A modal opened from another keeps that one's return point, so Escape
      // lands back where the whole chain started.
      var prev = modal ? modal.prev
        : (document.activeElement && host.contains(document.activeElement) ? document.activeElement : null);
      closeModal(true);
      var scrim = button("ap-scrim", "Close");
      scrim.tabIndex = -1;
      var box = el("div", kind === "sheet" ? "ap-sheet" : "ap-pop");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.tabIndex = -1;
      modal = { scrim: scrim, box: box, prev: prev };
      build(box);
      layer.appendChild(scrim);
      layer.appendChild(box);
      base.setAttribute("inert", "");
      scrim.addEventListener("click", function () { closeModal(false); });
      if (kind === "sheet") dragToClose(box);
      void box.offsetHeight;             // commit the closed state so the open one animates
      scrim.classList.add("is-open");
      box.classList.add("is-open");
      box.focus({ preventScroll: true });
    }

    // A downward drag on the sheet closes it.
    function dragToClose(box) {
      var g = null;
      box.addEventListener("pointerdown", function (e) {
        if (e.button > 0) return;
        g = { id: e.pointerId, y: e.clientY, dy: 0, moved: false };
        // A release outside the sheet (or the window) never reaches the box.
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      });
      box.addEventListener("pointermove", function (e) {
        if (!g || e.pointerId !== g.id) return;
        if (!e.buttons) { end(); return; }
        var dy = (e.clientY - g.y) / scale();
        if (!g.moved && Math.abs(dy) < 4) return;
        if (!g.moved) {
          g.moved = true;
          try { box.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
          box.classList.add("is-drag");
        }
        g.dy = dy;
        box.style.transform = "translateY(" + Math.max(0, dy) + "px)";
      });
      function end(e) {
        if (e && g && e.pointerId !== g.id) return;
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (!g) return;
        var s = g;
        g = null;
        if (!s.moved) return;
        box.classList.remove("is-drag");
        box.style.transform = "";
        if (s.dy > 70) closeModal(false);
      }
    }

    function noteEdit() {
      closeModal(false);
      snack("Editing and cancelling happen in the real app");
    }

    // The block shown for one event in a sheet.
    function sheetRow(e, meta) {
      var r = button("ap-srow");
      var bar = el("span", "ap-srow__bar");
      colorVars(bar, e);
      r.appendChild(bar);
      var main = el("span", "");
      main.appendChild(el("span", "ap-srow__t", e.title));
      main.appendChild(el("span", "ap-srow__m", meta));
      var l = e.bday ? e.sub : e.loc;
      if (l) main.appendChild(el("span", "ap-srow__l", l));
      r.appendChild(main);
      r.addEventListener("click", noteEdit);
      return r;
    }

    function openSlotSheet(hour, events) {
      openModal("sheet", function (box) {
        box.appendChild(el("div", "ap-sheet__grab"));
        var h = el("div", "ap-sheet__h", "Slot: " + hm4(hour * 60) + " - " + hm4(hour * 60 + 60));
        h.setAttribute("role", "heading");
        h.setAttribute("aria-level", "2");
        box.appendChild(h);
        events.forEach(function (e) { box.appendChild(sheetRow(e, range(e))); });
        box.appendChild(el("div", "ap-sheet__note", "Tap an event to edit or cancel it."));
      });
    }

    function openEventSheet(e, k) {
      openModal("sheet", function (box) {
        box.appendChild(el("div", "ap-sheet__grab"));
        var d = parseKey(k);
        var meta = shortDate(d) + " · " + (e.allDay ? "All day" : range(e));
        box.appendChild(sheetRow(e, meta));
        box.appendChild(el("div", "ap-sheet__note", "Tap an event to edit or cancel it."));
      });
    }

    function openAddSheet() {
      openModal("sheet", function (box) {
        box.appendChild(el("div", "ap-sheet__grab"));
        var h = el("div", "ap-sheet__h", "Add");
        h.setAttribute("role", "heading");
        h.setAttribute("aria-level", "2");
        box.appendChild(h);
        [["Event", "i-cal", "New event form opens here"],
         ["Task", "i-task", "New task form opens here"],
         ["Birthday", "i-cake", "New birthday form opens here"]].forEach(function (it) {
          var b = button("ap-addrow");
          var ic = el("span", "ap-addrow__i");
          ic.appendChild(svgIcon(it[1]));
          b.appendChild(ic);
          b.appendChild(el("span", "", it[0]));
          b.addEventListener("click", function () { closeModal(false); snack(it[2]); });
          box.appendChild(b);
        });
      });
    }

    /* ---- shared row builders ---- */
    function eventRow(e, k, o) {
      o = o || {};
      var b = button("ap-row");
      b.setAttribute("aria-label", e.title + ", " + (e.allDay ? "all day" : range(e)) + (e.loc ? ", " + e.loc : "") + (o.sub ? ", " + o.sub : ""));
      if (o.dayLabel) b.appendChild(el("span", "ap-row__d", o.dayLabel));
      var bar = el("span", "ap-row__bar");
      colorVars(bar, e);
      b.appendChild(bar);
      var t = el("span", "ap-row__time");
      if (e.allDay) {
        t.appendChild(el("span", "ap-row__ad", "all day"));
      } else {
        t.appendChild(el("span", "ap-row__s", hm(e.s)));
        t.appendChild(el("span", "ap-row__e", hm(e.e)));
      }
      b.appendChild(t);
      var main = el("span", "ap-row__main");
      main.appendChild(el("span", "ap-row__title", e.title));
      var sub = o.sub || (e.bday ? e.sub : e.loc);
      if (sub) main.appendChild(el("span", "ap-row__sub", sub));
      b.appendChild(main);
      b.addEventListener("click", function () { openEventSheet(e, k); });
      return b;
    }

    function bdayRow(b) {
      var r = el("div", "ap-bday");
      var ic = el("span", "ap-bday__i");
      ic.appendChild(svgIcon("i-cake"));
      r.appendChild(ic);
      var main = el("span", "ap-row__main");
      main.appendChild(el("span", "ap-row__title", b.title));
      main.appendChild(el("span", "ap-row__sub", b.sub));
      r.appendChild(main);
      return r;
    }

    /* ---- navigation ---- */
    function syncBack() {
      backEl.classList.toggle("is-on", active === "today" && offset !== 0);
    }

    function setTab(name) {
      if (name === active) return;
      closeModal(true);
      screens[active].classList.remove("is-active");
      navBtns[active].removeAttribute("aria-current");
      active = name;
      screens[name].classList.add("is-active");
      navBtns[name].setAttribute("aria-current", "page");
      syncBack();
      if (hooks[name]) hooks[name]();
    }

    function openDay(k) {
      closeModal(true);
      todayShell.jump(diffDays(parseKey(k), TODAY));
      setTab("today");
      var heading = todayShell.page().querySelector(".ap-head__t");
      if (heading) heading.focus({ preventScroll: true });
    }

    /* =====================================================================
       TODAY
       ===================================================================== */

    function dayTitle(off) {
      if (off === 0) return "Today";
      if (off === 1) return "Tomorrow";
      if (off === -1) return "Yesterday";
      return DOW[addDays(TODAY, off).getDay()];
    }

    function buildTopCard(list, off) {
      var card = el("div", "ap-card ap-top");
      var timed = list.filter(function (e) { return !e.allDay; });
      var cur = null, next = null;
      if (off === 0) {
        timed.forEach(function (e) {
          if (!cur && e.s <= NOW && NOW < e.e) cur = e;
          if (!next && e.s > NOW) next = e;
        });
      } else if (off > 0) {
        next = timed[0] || null;
      }
      if (cur) {
        var left = cur.e - NOW, h = Math.floor(left / 60), m = left % 60;
        card.appendChild(el("div", "ap-top__l", "Current event"));
        card.appendChild(el("div", "ap-top__t", cur.title));
        card.appendChild(el("div", "ap-top__m", "Until " + hm(cur.e) + " · " + (h ? h + "h " : "") + (m || !h ? m + "m " : "") + "left"));
        if (next) card.appendChild(el("div", "ap-top__then", "Then: " + next.title + " · " + hm(next.s)));
      } else if (next) {
        card.appendChild(el("div", "ap-top__l", "Up next"));
        card.appendChild(el("div", "ap-top__t", next.title));
        card.appendChild(el("div", "ap-top__m", range(next)));
      } else {
        card.appendChild(el("div", "ap-top__t", off < 0 ? "That day has passed." : "The rest of the day is yours."));
      }
      return card;
    }

    function buildGlance(list, off) {
      var card = el("div", "ap-card ap-hg");
      var timed = list.filter(function (e) { return !e.allDay; });
      var ends = [], lane = [];
      timed.forEach(function (e, i) {
        var l = 0;
        while (ends[l] !== undefined && ends[l] > e.s) l++;
        ends[l] = e.e;
        lane[i] = l;
      });
      card.appendChild(el("div", "ap-hg__label", "Day at a glance"));

      function onCell(h) {
        var busy = timed.filter(function (e) { return e.s < h * 60 + 60 && e.e > h * 60; });
        if (busy.length) openSlotSheet(h, busy);
        else snack("New event at " + pad(h) + ":00");
      }

      [0, 1].forEach(function (half) {
        var lo = half * 720, hi = lo + 720;
        var segs = [];
        timed.forEach(function (e, i) {
          if (e.s < hi && e.e > lo) {
            var x = (Math.max(e.s, lo) - lo) / 60;
            segs.push({ e: e, lane: lane[i], x: x, n: (Math.min(e.e, hi) - lo) / 60 - x });
          }
        });
        var lanes = 1;
        segs.forEach(function (sg) { lanes = Math.max(lanes, sg.lane + 1); });

        var nums = el("div", "ap-hg__nums");
        nums.setAttribute("aria-hidden", "true");
        for (var c = 0; c < 12; c++) {
          var hour = half * 12 + c;
          nums.appendChild(el("span", off === 0 && hour === Math.floor(NOW / 60) ? "is-now" : "", String(hour)));
        }
        card.appendChild(nums);

        for (var l = 0; l < lanes; l++) {
          var row = el("div", "ap-hg__row");
          for (var c2 = 0; c2 < 12; c2++) {
            (function (h2) {
              var overlapping = timed.filter(function (e) { return e.s < h2 * 60 + 60 && e.e > h2 * 60; });
              var cell;
              if (l === 0) {
                cell = button("ap-hg__cell", pad(h2) + ":00, " + (overlapping.length
                  ? "busy: " + overlapping.map(function (e) { return e.title; }).join(", ") : "free"));
              } else {
                cell = el("span", "ap-hg__cell");
                cell.setAttribute("aria-hidden", "true");
              }
              cell.addEventListener("click", function () { onCell(h2); });
              row.appendChild(cell);
            })(half * 12 + c2);
          }
          segs.forEach(function (sg) {
            if (sg.lane !== l) return;
            var bar = el("span", "ap-hg__bar");
            colorVars(bar, sg.e);
            setVars(bar, { "--x": sg.x, "--n": sg.n });
            // 12 cells and 2 px gaps across 348 px leave about 29 px per hour.
            if (sg.n * (350 / 12) - 2 >= 30) bar.textContent = sg.e.title;
            row.appendChild(bar);
          });
          var nowHour = Math.floor(NOW / 60);
          if (l === 0 && off === 0 && nowHour >= half * 12 && nowHour < half * 12 + 12) {
            var now = el("span", "ap-hg__now");
            setVars(now, { "--x": nowHour - half * 12 });
            row.appendChild(now);
          }
          card.appendChild(row);
        }
      });
      card.appendChild(el("div", "ap-hg__cap", "Tap a free hour to add an event."));
      return card;
    }

    function buildClash(list) {
      var wins = clashWindows(list);
      if (!wins.length) return null;
      var card = el("div", "ap-card ap-clash");
      card.appendChild(cardHead("i-warn", "Clash", true));
      wins.forEach(function (w) {
        card.appendChild(el("div", "ap-clash__h", "Double-booked " + hm(w.s) + "–" + hm(w.e) + " · " + plural(w.events.length, "event", "events")));
        var rows = el("div", "ap-clash__rows");
        w.events.forEach(function (e) { rows.appendChild(eventRow(e, e.date)); });
        card.appendChild(rows);
      });
      return card;
    }

    function taskSort(a, b) {
      return (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
        (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0) || a.id - b.id;
    }

    function buildTasks(k, overdue, dayTasks) {
      var card = el("div", "ap-card ap-tasks");
      function fill(focusId) {
        card.textContent = "";
        var head = cardHead("i-task", "Tasks");
        var left = overdue.concat(dayTasks).filter(function (t) { return !t.done; }).length;
        head.appendChild(el("span", "ap-card__aside", left + " left"));
        card.appendChild(head);
        function section(title, items, isOverdue) {
          if (!items.length) return;
          var sec = el("div", "ap-tasks__sec");
          if (title) sec.appendChild(el("div", "ap-tasks__h" + (isOverdue ? " ap-tasks__h--err" : ""), title));
          items.slice().sort(taskSort).forEach(function (t) {
            var row = el("div", "ap-task" + (t.done ? " is-done" : ""));
            var cb = button("ap-check", t.title);
            cb.setAttribute("role", "checkbox");
            cb.setAttribute("aria-checked", t.done ? "true" : "false");
            cb.setAttribute("data-task", String(t.id));
            var box = el("span", "ap-check__box");
            box.appendChild(pathIcon("check"));
            cb.appendChild(box);
            cb.addEventListener("click", function () { t.done = !t.done; fill(t.id); });
            row.appendChild(cb);
            var main = el("span", "ap-task__main");
            main.appendChild(el("span", "ap-task__t", t.title));
            var due = isOverdue
              ? shortDate(parseKey(t.date)) + " · " + t.time
              : (t.time ? "Due " + t.time : "any time");
            main.appendChild(el("span", "ap-task__d" + (isOverdue && !t.done ? " ap-task__d--err" : ""), due));
            row.appendChild(main);
            sec.appendChild(row);
          });
          card.appendChild(sec);
        }
        section("Overdue", overdue, true);
        section(overdue.length ? "Today" : "", dayTasks, false);
        card.appendChild(el("div", "ap-tasks__end"));
        if (focusId != null) {
          var again = card.querySelector('[data-task="' + focusId + '"]');
          if (again) again.focus({ preventScroll: true });
        }
      }
      fill(null);
      return card;
    }

    function buildDayPage(off) {
      var d = addDays(TODAY, off), k = key(d);
      var list = eventsOn(k);
      var page = el("div", "ap-scroll ap-page");

      var head = el("div", "ap-head");
      var t = el("div", "ap-head__t", dayTitle(off));
      t.tabIndex = -1;
      t.setAttribute("role", "heading");
      t.setAttribute("aria-level", "1");
      head.appendChild(t);
      head.appendChild(el("div", "ap-head__s", longDate(d)));
      page.appendChild(head);

      page.appendChild(buildTopCard(list, off));
      var sticky = el("div", "ap-sticky");
      sticky.appendChild(buildGlance(list, off));
      page.appendChild(sticky);

      var clash = buildClash(list);
      if (clash) page.appendChild(clash);

      var overdue = off === 0 ? tasks.filter(function (x) { return x.date < k && !x.done; }) : [];
      var dayTasks = tasks.filter(function (x) { return x.date === k; });
      if (overdue.length || dayTasks.length) page.appendChild(buildTasks(k, overdue, dayTasks));

      var bdays = bdaysOn(k);
      if (bdays.length) {
        var bc = el("div", "ap-card ap-bdays");
        bc.appendChild(cardHead("i-cake", "Birthdays"));
        var bb = el("div", "ap-rows");
        bdays.forEach(function (b) { bb.appendChild(bdayRow(b)); });
        bc.appendChild(bb);
        page.appendChild(bc);
      }

      var allDay = list.filter(function (e) { return e.allDay; });
      if (allDay.length) {
        var ac = el("div", "ap-card ap-allday");
        ac.appendChild(cardHead(null, "All day"));
        var ar = el("div", "ap-rows");
        allDay.forEach(function (e) {
          var sub = e.endDate !== e.date ? shortDate(parseKey(e.date)) + " – " + shortDate(parseKey(e.endDate)) : "";
          ar.appendChild(eventRow(e, k, { sub: sub }));
        });
        ac.appendChild(ar);
        page.appendChild(ac);
      }

      var timed = list.filter(function (e) { return !e.allDay; });
      var ag = el("div", "ap-card ap-agenda");
      ag.appendChild(cardHead("i-clock", "Agenda"));
      if (timed.length) {
        var gr = el("div", "ap-rows");
        timed.forEach(function (e) { gr.appendChild(eventRow(e, k)); });
        ag.appendChild(gr);
      } else {
        ag.appendChild(el("div", "ap-none", "Nothing planned."));
      }
      page.appendChild(ag);
      page.appendChild(el("div", "ap-end"));
      return page;
    }

    function scrollToAnchor(page, name) {
      var sel = name === "clash" ? ".ap-clash" : name === "tasks" ? ".ap-tasks" : "";
      var target = sel ? page.querySelector(sel) : null;
      var sticky = page.querySelector(".ap-sticky");
      if (!target) return;
      page.scrollTop = Math.max(0, target.offsetTop - (sticky ? sticky.offsetHeight : 0) - 4);
    }

    function buildToday() {
      var root = el("div", "ap-screen");
      var pager = el("div", "ap-pager");
      root.appendChild(pager);
      var cur = buildDayPage(0);
      pager.appendChild(cur);
      var busy = false;
      var timer = 0;

      // If focus sits inside a page that is about to go, move it to the new
      // page's heading instead of letting it fall to <body>.
      function rescueFocus(old, next) {
        var a = document.activeElement;
        if (old && a && old.contains(a)) {
          var h = next.querySelector(".ap-head__t");
          if (h) h.focus({ preventScroll: true });
        }
      }

      function finish(next, gone) {
        rescueFocus(gone, next);
        if (gone && gone.parentNode) gone.parentNode.removeChild(gone);
        next.classList.remove("is-anim");
        next.style.transform = "";
        cur = next;
        busy = false;
        syncBack();
      }

      // Swap pages with no animation.
      function jump(newOff) {
        window.clearTimeout(timer);
        busy = false;
        var old = cur;
        offset = newOff;
        cur = buildDayPage(newOff);
        pager.appendChild(cur);
        rescueFocus(old, cur);
        var kids = pager.children;
        for (var i = kids.length - 1; i >= 0; i--) if (kids[i] !== cur) pager.removeChild(kids[i]);
        cur.style.transform = "";
        syncBack();
      }

      function go(newOff) {
        if (newOff === offset || busy) return;
        if (reduced() || active !== "today") { jump(newOff); return; }
        var dir = newOff > offset ? 1 : -1, w = pager.clientWidth;
        var nb = buildDayPage(newOff), old = cur;
        nb.style.transform = "translateX(" + (dir * w) + "px)";
        pager.appendChild(nb);
        void nb.offsetWidth;
        busy = true;
        offset = newOff;
        old.classList.add("is-anim");
        nb.classList.add("is-anim");
        old.style.transform = "translateX(" + (-dir * w) + "px)";
        nb.style.transform = "translateX(0px)";
        syncBack();
        timer = window.setTimeout(function () { finish(nb, old); }, SLIDE_MS);
      }

      // Horizontal drag (mouse or touch) moves a day.
      var g = null;
      pager.addEventListener("pointerdown", function (e) {
        if (busy || e.button > 0 || !e.isPrimary) return;
        g = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, locked: false, dead: false, nb: null, dir: 0 };
      });
      pager.addEventListener("pointermove", function (e) {
        if (!g || e.pointerId !== g.id || g.dead) return;
        var k = scale(), dx = (e.clientX - g.x) / k, dy = (e.clientY - g.y) / k;
        if (!g.locked) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { g.dead = true; return; }
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            g.locked = true;
            try { pager.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
          } else {
            return;
          }
        }
        var dir = dx < 0 ? 1 : -1, w = pager.clientWidth;
        if (dir !== g.dir) {
          if (g.nb && g.nb.parentNode) g.nb.parentNode.removeChild(g.nb);
          g.dir = dir;
          g.nb = buildDayPage(offset + dir);
          pager.appendChild(g.nb);
        }
        g.dx = dx;
        cur.style.transform = "translateX(" + dx + "px)";
        g.nb.style.transform = "translateX(" + (dx + dir * w) + "px)";
      });
      function release() {
        if (!g) return;
        var s = g;
        g = null;
        if (!s.locked || !s.nb) return;
        var w = pager.clientWidth, old = cur, nb = s.nb;
        var commit = Math.abs(s.dx) >= SWIPE_PX;
        if (reduced()) {
          if (commit) { offset += s.dir; finish(nb, old); old.style.transform = ""; }
          else { old.style.transform = ""; if (nb.parentNode) nb.parentNode.removeChild(nb); }
          return;
        }
        busy = true;
        old.classList.add("is-anim");
        nb.classList.add("is-anim");
        if (commit) {
          offset += s.dir;
          old.style.transform = "translateX(" + (-s.dir * w) + "px)";
          nb.style.transform = "translateX(0px)";
          syncBack();
          timer = window.setTimeout(function () { finish(nb, old); }, SLIDE_MS);
        } else {
          old.style.transform = "translateX(0px)";
          nb.style.transform = "translateX(" + (s.dir * w) + "px)";
          timer = window.setTimeout(function () {
            if (nb.parentNode) nb.parentNode.removeChild(nb);
            old.classList.remove("is-anim");
            old.style.transform = "";
            busy = false;
          }, SLIDE_MS);
        }
      }
      pager.addEventListener("pointerup", release);
      pager.addEventListener("pointercancel", release);
      pager.addEventListener("keydown", function (e) {
        if (e.target && e.target.tagName === "INPUT") return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(offset - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(offset + 1); }
      });

      todayShell = {
        root: root, go: go, jump: jump,
        page: function () { return cur; },
        anchor: function () { if (anchor) scrollToAnchor(cur, anchor); }
      };
      return root;
    }

    /* =====================================================================
       WEEK
       ===================================================================== */

    function buildWeek() {
      var root = el("div", "ap-screen");
      var page = el("div", "ap-scroll ap-wk");
      root.appendChild(page);
      var start = addDays(TODAY, -TODAY.getDay());
      var days = [];
      for (var i = 0; i < 7; i++) days.push(addDays(start, i));

      // header: weekday initials and dates
      var head = el("div", "ap-wk__head");
      var hc = el("div", "ap-wk__hc");
      hc.appendChild(el("span", ""));
      days.forEach(function (d) {
        var c = el("div", "ap-wk__d" + (key(d) === TODAY_KEY ? " ap-wk__d--today" : ""));
        c.appendChild(el("span", "ap-wk__dw", dow3(d)));
        c.appendChild(el("span", "ap-wk__dn", String(d.getDate())));
        hc.appendChild(c);
      });
      head.appendChild(hc);
      page.appendChild(head);

      // timetable
      var grid = el("div", "ap-wk__grid");
      grid.appendChild(el("div", "ap-wk__gut"));
      for (var h = 0; h < 24; h++) {
        var top = WK_PAD + h * HOUR_PX;
        var hl = el("div", "ap-wk__hl");
        setVars(hl, { "--top": top + "px" });
        grid.appendChild(hl);
        var hn = el("div", "ap-wk__hn", hm4(h * 60));
        setVars(hn, { "--top": top + "px" });
        grid.appendChild(hn);
      }
      var cols = el("div", "ap-wk__cols");
      var firstHour = 8;
      days.forEach(function (d) {
        var k = key(d);
        var col = el("div", "ap-wk__col" + (k === TODAY_KEY ? " ap-wk__col--today" : ""));
        var bg = button("ap-wk__bg", "Add an event on " + shortDate(d));
        bg.addEventListener("click", function (ev) {
          var hour = 9;
          if (ev.detail > 0 || ev.clientY) {
            var r = col.getBoundingClientRect();
            if (r.height) {
              var y = (ev.clientY - r.top) / r.height * (24 * HOUR_PX + 2 * WK_PAD);
              hour = Math.max(0, Math.min(23, Math.floor((y - WK_PAD) / HOUR_PX)));
            }
          }
          snack("New event · " + dow3(d) + " " + d.getDate() + ", " + pad(hour) + ":00");
        });
        col.appendChild(bg);

        var timed = eventsOn(k).filter(function (e) { return !e.allDay; });
        timed.forEach(function (e) { firstHour = Math.min(firstHour, Math.floor(e.s / 60)); });
        // clusters of overlapping events split their column; a lone event keeps it whole
        var i2 = 0;
        while (i2 < timed.length) {
          var cluster = [timed[i2]], end = timed[i2].e;
          i2++;
          while (i2 < timed.length && timed[i2].s < end) { cluster.push(timed[i2]); end = Math.max(end, timed[i2].e); i2++; }
          var ends = [], lane = [];
          cluster.forEach(function (e, ci) {
            var l = 0;
            while (ends[l] !== undefined && ends[l] > e.s) l++;
            ends[l] = e.e;
            lane[ci] = l;
          });
          cluster.forEach(function (e, ci) { col.appendChild(weekBlock(e, k, lane[ci], ends.length)); });
        }
        cols.appendChild(col);
      });
      grid.appendChild(cols);
      page.appendChild(grid);

      // all-day and multi-day events (and birthdays), each once under the first day they touch
      var card = el("div", "ap-card ap-wk__list");
      card.appendChild(cardHead(null, "All day"));
      var rows = el("div", "ap-rows");
      var seen = {}, any = false;
      days.forEach(function (d) {
        var k = key(d);
        eventsOn(k).filter(function (e) { return e.allDay; }).forEach(function (e) {
          if (seen[e.i]) return;
          seen[e.i] = true;
          any = true;
          var sub = e.endDate !== e.date ? "Until " + shortDate(parseKey(e.endDate)) : "";
          rows.appendChild(eventRow(e, k, { dayLabel: dow3(d) + " " + d.getDate(), sub: sub }));
        });
        bdaysOn(k).forEach(function (b) {
          any = true;
          rows.appendChild(eventRow(b, k, { dayLabel: dow3(d) + " " + d.getDate() }));
        });
      });
      if (any) card.appendChild(rows); else card.appendChild(el("div", "ap-none", "Nothing all-day this week."));
      page.appendChild(card);
      page.appendChild(el("div", "ap-end"));

      function weekBlock(e, k, lane, n) {
        var hpx = (e.e - e.s) * HOUR_PX / 60 - 2;
        var b = button("ap-wk__blk", e.title + ", " + shortDate(parseKey(k)) + ", " + range(e) + (e.loc ? ", " + e.loc : ""));
        colorVars(b, e);
        setVars(b, { "--top": (WK_PAD + e.s * HOUR_PX / 60 + 1) + "px", "--h": hpx + "px", "--l": lane, "--n": n });
        var lines = Math.floor((hpx - 4) / 11.5);
        b.appendChild(el("span", "ap-wk__bt", e.title));
        if (lines >= 4) {
          b.appendChild(el("span", "", hm4(e.s)));
          b.appendChild(el("span", "", "-"));
          b.appendChild(el("span", "", hm4(e.e)));
          if (e.loc && lines >= 6) b.appendChild(el("span", "", e.loc));
        } else if (e.loc && lines >= 2) {
          b.appendChild(el("span", "", e.loc));
        }
        b.addEventListener("click", function () { openEventSheet(e, k); });
        return b;
      }

      hooks.weekScroll = function () {
        page.scrollTop = Math.max(0, grid.offsetTop + WK_PAD + firstHour * HOUR_PX - head.offsetHeight - 43);
      };
      return root;
    }

    /* =====================================================================
       MONTH
       ===================================================================== */

    function buildMonth() {
      var st = { mode: "cal", view: "grid" };
      var root = el("div", "ap-screen");
      var m = el("div", "ap-mo");
      root.appendChild(m);

      var head = el("div", "ap-mo__head");
      var tw = el("div", "");
      var title = el("div", "ap-mo__t", "October 2026");
      title.setAttribute("role", "heading");
      title.setAttribute("aria-level", "1");
      var sub = el("div", "ap-mo__sub");
      sub.setAttribute("aria-live", "polite");
      tw.appendChild(title);
      tw.appendChild(sub);
      head.appendChild(tw);

      var ctl = el("div", "ap-mo__ctl");
      var seg = el("div", "ap-seg");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Show");
      seg.appendChild(el("span", "ap-seg__thumb"));
      var bCal = button("", "Events");
      bCal.appendChild(svgIcon("i-cal"));
      var bCake = button("", "Birthdays");
      bCake.appendChild(svgIcon("i-cake"));
      seg.appendChild(bCal);
      seg.appendChild(bCake);
      var tog = button("ap-mo__tog");
      ctl.appendChild(seg);
      ctl.appendChild(tog);
      head.appendChild(ctl);
      m.appendChild(head);

      var body = el("div", "ap-mo__body");
      var gridV = el("div", "ap-mo__view ap-mo__grid is-on");
      var listV = el("div", "ap-mo__view ap-scroll");
      body.appendChild(gridV);
      body.appendChild(listV);
      m.appendChild(body);

      function itemsOn(k) { return st.mode === "cake" ? bdaysOn(k) : eventsOn(k); }

      function count() {
        var n = 0;
        if (st.mode === "cake") {
          for (var d = 1; d <= 31; d++) n += bdaysOn("2026-10-" + pad(d)).length;
          return plural(n, "birthday", "birthdays") + " this month";
        }
        EVENTS.forEach(function (e) { if (e.date.slice(0, 7) === "2026-10") n++; });
        return plural(n, "event", "events") + " this month";
      }

      // Pack one week's chips: bands first (longest first), then timed events
      // into the first free row; a day that can't fit them all ends in "•••".
      function layoutWeek(days) {
        var occ = [], bands = [], byId = {}, timedByDay = [], total = [];
        var firstKey = key(days[0]), lastKey = key(days[6]);
        days.forEach(function (d, c) {
          var k = key(d);
          timedByDay[c] = [];
          total[c] = 0;
          itemsOn(k).forEach(function (it) {
            total[c]++;
            if (it.allDay) {
              var id = it.bday ? it.title + it.date : "e" + it.i;
              if (byId[id]) byId[id].c1 = c;
              else { byId[id] = { it: it, c0: c, c1: c }; bands.push(byId[id]); }
            } else {
              timedByDay[c].push(it);
            }
          });
        });
        function free(s, c0, c1) {
          for (var c = c0; c <= c1; c++) if (occ[s] && occ[s][c]) return false;
          return true;
        }
        function take(s, c0, c1) {
          occ[s] = occ[s] || [];
          for (var c = c0; c <= c1; c++) occ[s][c] = true;
        }
        var chips = [], more = [];
        bands.sort(function (a, b) { return (b.c1 - b.c0) - (a.c1 - a.c0) || a.c0 - b.c0; });
        bands.forEach(function (b) {
          var s = 0;
          while (!free(s, b.c0, b.c1)) s++;
          take(s, b.c0, b.c1);
          b.slot = s;
        });
        var overflow = [];
        total.forEach(function (n, c) { overflow[c] = n > MAX_SLOTS; });
        bands.forEach(function (b) {
          var hide = b.slot >= MAX_SLOTS;
          for (var c = b.c0; c <= b.c1; c++) if (overflow[c] && b.slot >= MAX_SLOTS - 1) hide = true;
          if (hide) return;
          chips.push({ it: b.it, col: b.c0, span: b.c1 - b.c0 + 1, slot: b.slot,
            cl: b.it.date < firstKey, cr: b.it.endDate > lastKey });
        });
        timedByDay.forEach(function (list, c) {
          list.forEach(function (it) {
            var s = 0;
            while (!free(s, c, c)) s++;
            take(s, c, c);
            if (s >= MAX_SLOTS || (overflow[c] && s >= MAX_SLOTS - 1)) return;
            chips.push({ it: it, col: c, span: 1, slot: s, cl: false, cr: false });
          });
          if (overflow[c]) more.push({ col: c, slot: MAX_SLOTS - 1 });
        });
        return { chips: chips, more: more };
      }

      function buildWeekRow(days) {
        var week = el("div", "ap-mo__week");
        var dayEls = el("div", "ap-mo__days");
        days.forEach(function (d) {
          var k = key(d);
          var n = itemsOn(k).length;
          var b = button("ap-mo__day" + (d.getMonth() !== 9 ? " is-out" : "") + (k === TODAY_KEY ? " is-today" : ""),
            longDate(d) + (k === TODAY_KEY ? ", today" : "") + ", " + (n ? plural(n, st.mode === "cake" ? "birthday" : "event", st.mode === "cake" ? "birthdays" : "events") : "nothing planned"));
          b.appendChild(el("span", "ap-mo__n", String(d.getDate())));
          b.addEventListener("click", function () { openDayPopup(d); });
          dayEls.appendChild(b);
        });
        week.appendChild(dayEls);
        var lay = layoutWeek(days);
        var layer2 = el("div", "ap-mo__chips");
        layer2.setAttribute("aria-hidden", "true");
        lay.chips.forEach(function (c) {
          var chip = el("span", "ap-mo__chip" + (c.cl ? " ap-mo__chip--cl" : "") + (c.cr ? " ap-mo__chip--cr" : ""), c.it.title);
          colorVars(chip, c.it);
          setVars(chip, { "--col": c.col, "--span": c.span, "--slot": c.slot });
          layer2.appendChild(chip);
        });
        lay.more.forEach(function (mo) {
          var dots = el("span", "ap-mo__more", "•••");
          setVars(dots, { "--col": mo.col, "--slot": mo.slot });
          layer2.appendChild(dots);
        });
        week.appendChild(layer2);
        return week;
      }

      function renderGrid() {
        gridV.textContent = "";
        var wd = el("div", "ap-mo__wd");
        wd.setAttribute("aria-hidden", "true");
        "SMTWTFS".split("").forEach(function (ch) { wd.appendChild(el("span", "", ch)); });
        gridV.appendChild(wd);
        var weeks = el("div", "ap-mo__weeks");
        var start = new Date(2026, 8, 27);
        for (var w = 0; w < 6; w++) {
          var days = [];
          for (var c = 0; c < 7; c++) days.push(addDays(start, w * 7 + c));
          weeks.appendChild(buildWeekRow(days));
        }
        gridV.appendChild(weeks);
      }

      var todayGroup = null;
      function renderList() {
        listV.textContent = "";
        var ls = el("div", "ap-ls");
        var any = false;
        for (var i = 1; i <= 31; i++) {
          var d = new Date(2026, 9, i), k = key(d), items = itemsOn(k);
          if (!items.length) continue;
          any = true;
          var isToday = k === TODAY_KEY;
          var g = el("div", "ap-ls__g");
          var lab = el("div", "ap-ls__d" + (isToday ? " is-today" : ""));
          lab.appendChild(el("span", "ap-ls__w", dow3(d)));
          lab.appendChild(el("span", "ap-ls__n", String(i)));
          g.appendChild(lab);
          var rows = el("div", "ap-ls__rows");
          items.forEach(function (it) { rows.appendChild(eventRow(it, k)); });
          g.appendChild(rows);
          ls.appendChild(g);
          if (isToday) todayGroup = g;
        }
        if (!any) ls.appendChild(el("div", "ap-ls__none", "Nothing this month."));
        listV.appendChild(ls);
        listV.appendChild(el("div", "ap-end"));
      }
      function scrollListToToday() {
        listV.scrollTop = todayGroup ? Math.max(0, todayGroup.offsetTop - 20) : 0;
      }

      function openDayPopup(d) {
        var k = key(d);
        var items = itemsOn(k);
        openModal("pop", function (box) {
          var h = el("div", "ap-pop__h", longDate(d));
          h.setAttribute("role", "heading");
          h.setAttribute("aria-level", "2");
          box.appendChild(h);
          if (items.length) {
            items.forEach(function (it) { box.appendChild(eventRow(it, k)); });
          } else {
            box.appendChild(el("div", "ap-pop__none", "Nothing on this day."));
          }
          var btns = el("div", "ap-pop__btns");
          var open = button("ap-tbtn", "");
          open.textContent = "Open day";
          open.addEventListener("click", function () { openDay(k); });
          var add = button("ap-tbtn", "");
          add.textContent = "Add event";
          add.addEventListener("click", function () { closeModal(false); snack("New event on " + dow3(d) + " " + d.getDate()); });
          btns.appendChild(open);
          btns.appendChild(add);
          box.appendChild(btns);
        });
      }

      function sync() {
        var cake = st.mode === "cake", list = st.view === "list";
        seg.classList.toggle("is-cake", cake);
        bCal.setAttribute("aria-pressed", cake ? "false" : "true");
        bCake.setAttribute("aria-pressed", cake ? "true" : "false");
        sub.textContent = count();
        tog.textContent = "";
        tog.appendChild(pathIcon(list ? "grid" : "list"));
        tog.setAttribute("aria-label", list ? "Show the month as a grid" : "Show the month as a list");
        gridV.classList.toggle("is-on", !list);
        listV.classList.toggle("is-on", list);
        if (list) gridV.setAttribute("inert", ""); else gridV.removeAttribute("inert");
        if (list) listV.removeAttribute("inert"); else listV.setAttribute("inert", "");
      }
      function setMode(mode) {
        if (st.mode === mode) return;
        st.mode = mode;
        renderGrid();
        renderList();
        sync();
        if (st.view === "list") scrollListToToday();
      }
      bCal.addEventListener("click", function () { setMode("cal"); });
      bCake.addEventListener("click", function () { setMode("cake"); });
      tog.addEventListener("click", function () {
        st.view = st.view === "grid" ? "list" : "grid";
        sync();
        if (st.view === "list") scrollListToToday();
      });

      renderGrid();
      renderList();
      sync();
      hooks.month = function () { if (st.view === "list") scrollListToToday(); };
      return root;
    }

    /* =====================================================================
       SETTINGS
       ===================================================================== */

    function buildSettings() {
      var root = el("div", "ap-screen");
      var page = el("div", "ap-scroll");
      root.appendChild(page);
      var head = el("div", "ap-head");
      var t = el("div", "ap-head__t", "Settings");
      t.setAttribute("role", "heading");
      t.setAttribute("aria-level", "1");
      head.appendChild(t);
      page.appendChild(head);

      var cal = el("div", "ap-card");
      cal.appendChild(cardHead("i-cal", "Calendar"));
      var cb = el("div", "ap-card__body");
      var row = el("div", "ap-set__row");
      row.appendChild(el("span", "", "Default calendar"));
      row.appendChild(el("span", "", "Personal"));
      cb.appendChild(row);
      cb.appendChild(el("div", "ap-set__cap", "New events are added here and sync through that account."));
      cal.appendChild(cb);
      page.appendChild(cal);

      var sync = el("div", "ap-card");
      var syncHead = cardHead("i-sync", "Sync with Google");
      var syncIcon = syncHead.querySelector(".ap-i");
      sync.appendChild(syncHead);
      var sb = el("div", "ap-card__body");
      [["you@gmail.com", "Calendar auto-sync: on", "Waiting to upload: 0", false],
       ["work@company.com", "Calendar auto-sync: off", "Waiting to upload: 3", true]].forEach(function (a) {
        var acct = el("div", "ap-acct");
        acct.appendChild(el("div", "ap-acct__n", a[0]));
        acct.appendChild(el("div", "ap-acct__l" + (a[3] ? " is-warn" : ""), a[1]));
        acct.appendChild(el("div", "ap-acct__l" + (a[3] ? " is-warn" : ""), a[2]));
        sb.appendChild(acct);
      });
      sb.appendChild(el("div", "ap-set__cap", "Changes you make here are uploaded by the phone’s own Google sync. If “Waiting to upload” stays above zero, check that auto-sync is on for Calendar and that battery saving isn’t stopping background sync."));
      var status = el("div", "ap-sync__st");
      status.setAttribute("role", "status");
      sb.appendChild(status);
      var btns = el("div", "ap-sync__btns");
      var syncBtn = button("ap-tbtn");
      syncBtn.textContent = "Sync now";
      var phoneBtn = button("ap-tbtn");
      phoneBtn.textContent = "Phone sync settings";
      btns.appendChild(syncBtn);
      btns.appendChild(phoneBtn);
      sb.appendChild(btns);
      sync.appendChild(sb);
      page.appendChild(sync);

      var syncTimer = 0;
      syncBtn.addEventListener("click", function () {
        if (syncBtn.disabled) return;
        syncBtn.disabled = true;
        status.textContent = "Syncing…";
        syncIcon.classList.add("is-spin");
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(function () {
          syncIcon.classList.remove("is-spin");
          syncBtn.disabled = false;
          status.textContent = "Last synced just now";
        }, 1200);
      });
      phoneBtn.addEventListener("click", function () { snack("Opens Android’s account sync settings"); });

      var about = el("div", "ap-card");
      about.appendChild(cardHead(null, "About"));
      var ab = el("div", "ap-card__body");
      ab.appendChild(el("div", "ap-set__about", "Schedule reads the calendars already synced to this device. No account, no server, no analytics — nothing typed or scheduled here leaves the phone."));
      ab.appendChild(el("div", "ap-set__ver", "Version 1.3.0"));
      about.appendChild(ab);
      page.appendChild(about);
      page.appendChild(el("div", "ap-end"));
      return root;
    }

    /* =====================================================================
       Frame
       ===================================================================== */

    function buildStatus() {
      var s = el("div", "ap-status");
      s.setAttribute("aria-hidden", "true");
      s.appendChild(el("span", "", "13:20"));
      var r = el("span", "ap-status__r");
      var sig = el("span", "ap-sig");
      for (var i = 0; i < 4; i++) sig.appendChild(document.createElement("i"));
      r.appendChild(sig);
      r.appendChild(svgIcon("i-wifi", "ap-wifi"));
      r.appendChild(svgIcon("i-batt", "ap-batt"));
      s.appendChild(r);
      return s;
    }

    function buildNav() {
      var wrap = el("div", "ap-navwrap");
      var nav = el("nav", "ap-nav");
      nav.setAttribute("aria-label", "Screens");
      order.forEach(function (name) {
        var b = button("ap-nav__b");
        var pill = el("span", "ap-nav__pill");
        pill.appendChild(svgIcon("i-" + name));
        b.appendChild(pill);
        b.appendChild(el("span", "ap-nav__l", labels[name]));
        b.addEventListener("click", function () { setTab(name); });
        navBtns[name] = b;
        nav.appendChild(b);
      });
      wrap.appendChild(nav);
      return wrap;
    }

    base = el("div", "ap-base");
    base.appendChild(buildStatus());
    var screensEl = el("div", "ap-screens");
    screens.today = buildToday();
    screens.week = buildWeek();
    screens.month = buildMonth();
    screens.settings = buildSettings();
    order.forEach(function (name) { screensEl.appendChild(screens[name]); });
    base.appendChild(screensEl);

    var fab = button("ap-fab", "Add");
    fab.appendChild(svgIcon("i-add"));
    fab.addEventListener("click", openAddSheet);
    backEl = button("ap-back");
    backEl.textContent = "Back to today";
    backEl.addEventListener("click", function () { todayShell.go(0); });

    base.appendChild(fab);
    base.appendChild(backEl);
    base.appendChild(buildNav());
    dev.appendChild(base);

    layer = el("div", "ap-layer");
    dev.appendChild(layer);
    snackEl = el("div", "ap-snack");
    snackEl.setAttribute("role", "status");
    dev.appendChild(snackEl);
    dev.appendChild(el("div", "ap-gest"));

    screens[active].classList.add("is-active");
    navBtns[active].setAttribute("aria-current", "page");

    dev.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal) { e.stopPropagation(); closeModal(false); }
    });
    // Focus must never scroll the clipped frames out of place.
    function pin(n) { n.addEventListener("scroll", function () { n.scrollLeft = 0; n.scrollTop = 0; }); }
    pin(vp); pin(dev); pin(base); pin(screensEl); pin(screens.today.firstChild);
    // Taps and keys mean the opening positions should stay put. A wheel only
    // counts if it really scrolled something inside the phone: wheeling over
    // the phone to move the page along must not freeze it. (Moving the stage
    // in the DOM resets every scrollTop, so until the user has used the phone
    // the opening positions are re-applied each time it is laid out again.)
    var lastInput = 0;
    function noteInput() { lastInput = Date.now(); }
    dev.addEventListener("wheel", noteInput, { passive: true });
    dev.addEventListener("touchmove", noteInput, { passive: true });
    dev.addEventListener("pointerdown", function () { touched = true; }, { passive: true });
    dev.addEventListener("keydown", function () { touched = true; });
    dev.addEventListener("scroll", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("ap-scroll") && Date.now() - lastInput < 1000) touched = true;
    }, true);

    function placeStart() {
      if (touched) return;
      todayShell.anchor();
      if (hooks.weekScroll) hooks.weekScroll();
      if (hooks.month) hooks.month();
    }
    placeStart();
    return { placeStart: placeStart };
  }

  /* ----------------------------------------------------------------------
     5. Mount loop
     ---------------------------------------------------------------------- */

  function mount(host) {
    if (host.getAttribute("data-live") === "1") return;
    var img = host.querySelector(".phone__shot");
    var initial = host.getAttribute("data-app") || "today";
    if (initial !== "today" && initial !== "week" && initial !== "month" && initial !== "settings") initial = "today";
    var anchor = host.getAttribute("data-scroll") || "";

    var vp = el("div", "dev-vp");
    var dev = el("div", "dev");
    vp.appendChild(dev);

    var app = buildApp(host, vp, dev, initial, anchor);

    // The live app fills the frame exactly: the width sets the scale, and the
    // device height follows from the frame's own shape.
    function layout() {
      var w = vp.clientWidth, h = vp.clientHeight;
      if (!w || !h) return;
      var k = w / DEV_W;
      dev.style.setProperty("--k", String(k));
      dev.style.setProperty("--dev-h", (h / k) + "px");
      app.placeStart();
    }

    host.setAttribute("role", "region");
    host.setAttribute("aria-label", "Live demo of the Schedule app — tap around");
    host.setAttribute("data-live", "1");
    if (img && img.parentNode === host) host.replaceChild(vp, img); else host.appendChild(vp);
    layout();
    if (typeof ResizeObserver === "function") new ResizeObserver(layout).observe(vp);
    else window.addEventListener("resize", layout);

    // segments.js moves the stage (and toggles is-active on it) after this
    // runs; a move resets scroll positions without necessarily changing any
    // size, so also re-place when the host shows up again or its stage changes.
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function () { layout(); }).observe(host);
    }
    var stage = host.parentNode;
    while (stage && stage.nodeType === 1 && !(stage.classList && stage.classList.contains("stage"))) stage = stage.parentNode;
    if (stage && stage.nodeType === 1 && typeof MutationObserver === "function") {
      new MutationObserver(function () { layout(); }).observe(stage, { attributes: true, attributeFilter: ["class", "inert"] });
    }
  }

  function mountAll() {
    var hosts = document.querySelectorAll("[data-app]");
    for (var i = 0; i < hosts.length; i++) {
      try { mount(hosts[i]); } catch (err) { if (window.console) console.error("phone.js:", err); }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
