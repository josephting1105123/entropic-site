/* MIF Finance demo: made-up church, made-up numbers, nothing is saved. */
(function () {
  'use strict';

  var host = document.getElementById('mif-demo');
  if (!host) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  // Jan to May are fixed totals, in cents. June is worked out from the rows and claims below.
  var BASE = [
    { income: 520000, expenses: 310000 },
    { income: 380000, expenses: 430000 },
    { income: 580000, expenses: 430000 },
    { income: 490000, expenses: 290000 },
    { income: 530000, expenses: 360000 }
  ];
  // Services earlier in June, before the Sunday Service this demo is editing.
  var JUNE_EARLIER_INCOME = 380000;
  var TOTAL_BUDGET = 4800000;
  var CASH_NAME = 'Cash (no name)';
  var METHODS = ['Bank Transfer', 'TNG', 'Cash'];
  // Offerings by method up to and including the earlier June services (sums to Jan-May income + earlier June).
  var METHOD_BASE = { 'Bank Transfer': 1880000, 'TNG': 430000, 'Cash': 570000 };
  // Expenses by category for Jan to May (sums to the Jan-May expenses above).
  var CATEGORY_BASE = [
    { code: 'MIF-03', cents: 520000 },
    { code: 'PJS-01', cents: 380000 },
    { code: 'CAMP-02', cents: 610000 },
    { code: 'OUT-01', cents: 310000 }
  ];
  var ROW_DATE = '2026-06-14';
  var MAX_CENTS_DIGITS = 8;

  // Chart geometry, in viewBox units.
  var PLOT = { w: 300, h: 190, l: 54, r: 290, t: 10, b: 160 };
  var PALETTE = ['mif-c-accent', 'mif-c-teal', 'mif-c-warn', 'mif-c-grey'];
  var SWATCH = ['mif-bg-accent', 'mif-bg-teal', 'mif-bg-warn', 'mif-bg-grey'];

  var nextId = 1;
  var rows = [
    { id: nextId++, date: ROW_DATE, name: 'Grace Lim', method: 'Bank Transfer', cents: 20000, saved: true },
    { id: nextId++, date: ROW_DATE, name: 'Daniel Tan', method: 'Bank Transfer', cents: 35000, saved: true },
    { id: nextId++, date: ROW_DATE, name: 'Ruth Chong', method: 'TNG', cents: 12000, saved: true },
    { id: nextId++, date: ROW_DATE, name: CASH_NAME, method: 'Cash', cents: 8500, saved: true }
  ];
  var claims = [
    { id: 1, date: '2026-06-02', category: { code: 'MIF-03', name: 'Hospitality' }, desc: 'Fellowship lunch supplies', cents: 12050, by: 'Mary Ong', paid: true },
    { id: 2, date: '2026-06-05', category: { code: 'PJS-01', name: 'Outreach' }, desc: 'Printing flyers', cents: 8600, by: 'David Koh', paid: true },
    { id: 3, date: '2026-06-09', category: { code: 'CAMP-02', name: 'Transport' }, desc: 'Van hire for youth camp', cents: 24000, by: 'Peter Yap', paid: false },
    { id: 4, date: '2026-06-11', category: { code: 'OUT-01', name: 'Missions' }, desc: 'Visiting speaker travel', cents: 4575, by: 'Sarah Teo', paid: false },
    { id: 5, date: '2026-06-13', category: { code: 'MIF-03', name: 'Hospitality' }, desc: 'Sunday morning refreshments', cents: 15000, by: 'Mary Ong', paid: false }
  ];
  // Names used before, so a known name fills in its method on its own.
  var known = {};
  var knownOrder = [];
  var i;
  for (i = 0; i < rows.length; i++) remember(rows[i].name, rows[i].method);

  var amountCents = 0;
  var lastAnnouncement = '';

  var els = {};

  function remember(name, method) {
    if (name === CASH_NAME) return;
    var key = name.toLowerCase();
    if (!known[key]) knownOrder.push(name);
    known[key] = { name: name, method: method };
  }

  function group(whole) {
    var s = String(whole);
    var out = '';
    while (s.length > 3) {
      out = ',' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return s + out;
  }

  // RM1,234.50 and RM-500.00 (the app puts the minus after the RM prefix)
  function fmt(cents) {
    var neg = cents < 0;
    var n = Math.abs(Math.round(cents));
    var frac = n % 100;
    return 'RM' + (neg ? '-' : '') + group(Math.floor(n / 100)) + '.' + (frac < 10 ? '0' : '') + frac;
  }

  // Axis labels drop the cents: RM3,000
  function fmtAxis(cents) {
    return 'RM' + group(Math.round(cents / 100));
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, String(attrs[k]));
    }
    return node;
  }

  function svgText(x, y, className, text, anchor) {
    var t = svgEl('text', { x: x, y: y, 'class': className, 'text-anchor': anchor || 'middle' });
    t.textContent = text;
    return t;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function numCell(tag, cents, extra) {
    var cell = el(tag, 'mif-num' + (cents < 0 ? ' mif-neg' : '') + (extra ? ' ' + extra : ''), fmt(cents));
    return cell;
  }

  function yearLine() {
    var p = el('p', 'mif-sub', 'Year: ');
    p.appendChild(el('span', 'mif-fig', '2026'));
    return p;
  }

  function announce(message) {
    // Repeating the same text would not be read out again, so alternate a trailing space.
    if (message === lastAnnouncement) message += ' ';
    lastAnnouncement = message;
    els.status.textContent = message;
  }

  function sumRows(saved) {
    var total = 0;
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].saved === saved) total += rows[r].cents;
    }
    return total;
  }

  function sumClaims(onlyUnpaid) {
    var total = 0;
    for (var c = 0; c < claims.length; c++) {
      if (!onlyUnpaid || !claims[c].paid) total += claims[c].cents;
    }
    return total;
  }

  function juneIncome() {
    return JUNE_EARLIER_INCOME + sumRows(true);
  }

  function methodTotal(method) {
    var total = METHOD_BASE[method] || 0;
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].saved && rows[r].method === method) total += rows[r].cents;
    }
    return total;
  }

  function categoryTotal(entry) {
    var total = entry.cents;
    for (var c = 0; c < claims.length; c++) {
      if (claims[c].category.code === entry.code) total += claims[c].cents;
    }
    return total;
  }

  /* ---------- Charts ---------- */

  // Round the top gridline up to a multiple of RM2,000 so the middle line is a round number too.
  function niceTop(maxCents) {
    var step = 200000;
    return Math.max(step, Math.ceil(maxCents / step) * step);
  }

  function plotY(value, top) {
    return round2(PLOT.b - ((PLOT.b - PLOT.t) * value) / top);
  }

  function newChartSvg(label, extraClass) {
    return svgEl('svg', {
      viewBox: '0 0 ' + PLOT.w + ' ' + PLOT.h,
      role: 'img',
      'aria-label': label,
      'class': 'mif-svg' + (extraClass ? ' ' + extraClass : ''),
      focusable: 'false'
    });
  }

  // Three horizontal gridlines (0, half, top) with RM labels.
  function drawGrid(svg, top) {
    for (var g = 0; g <= 2; g++) {
      var y = plotY((top * g) / 2, top);
      svg.appendChild(svgEl('line', { x1: PLOT.l, x2: PLOT.r, y1: y, y2: y, 'class': 'mif-c-grid' }));
      svg.appendChild(svgText(PLOT.l - 6, round2(y + 4), 'mif-c-label', fmtAxis((top * g) / 2), 'end'));
    }
  }

  function chartFigure(title, svg) {
    var fig = el('figure', 'mif-chart');
    fig.appendChild(el('figcaption', 'mif-chart-title', title));
    fig.appendChild(svg);
    return fig;
  }

  function lineChart(values) {
    var parts = [];
    var max = 0;
    for (var v = 0; v < values.length; v++) {
      parts.push(MONTHS[v] + ' ' + fmt(values[v]));
      if (values[v] > max) max = values[v];
    }
    var top = niceTop(max);
    var svg = newChartSvg('Monthly income: ' + parts.join(', '));
    drawGrid(svg, top);

    var stepX = (PLOT.r - PLOT.l) / (values.length - 1);
    var pts = [];
    for (var p = 0; p < values.length; p++) {
      pts.push({ x: round2(PLOT.l + stepX * p), y: plotY(values[p], top) });
    }
    var line = 'M' + pts[0].x + ' ' + pts[0].y;
    for (var q = 1; q < pts.length; q++) line += ' L' + pts[q].x + ' ' + pts[q].y;
    var last = pts[pts.length - 1];
    svg.appendChild(svgEl('path', { d: line + ' L' + last.x + ' ' + PLOT.b + ' L' + pts[0].x + ' ' + PLOT.b + ' Z', 'class': 'mif-c-area' }));
    svg.appendChild(svgEl('path', { d: line, 'class': 'mif-c-line' }));
    for (var d = 0; d < pts.length; d++) {
      svg.appendChild(svgEl('circle', { cx: pts[d].x, cy: pts[d].y, r: 4, 'class': 'mif-c-accent' }));
      svg.appendChild(svgText(pts[d].x, PLOT.b + 18, 'mif-c-label', MONTHS[d]));
    }
    return chartFigure('Monthly Income (weekly meeting offering)', svg);
  }

  function columnChart(entries) {
    var parts = [];
    var max = 0;
    for (var e = 0; e < entries.length; e++) {
      parts.push(entries[e].code + ' ' + fmt(entries[e].cents));
      if (entries[e].cents > max) max = entries[e].cents;
    }
    var top = niceTop(max);
    var svg = newChartSvg('Expenses by category: ' + parts.join(', '));
    drawGrid(svg, top);

    var slot = (PLOT.r - PLOT.l) / entries.length;
    var barW = round2(slot * 0.56);
    for (var b = 0; b < entries.length; b++) {
      var y = plotY(entries[b].cents, top);
      var x = round2(PLOT.l + slot * b + (slot - barW) / 2);
      svg.appendChild(svgEl('rect', { x: x, y: y, width: barW, height: round2(PLOT.b - y), rx: 3, 'class': 'mif-c-red' }));
      svg.appendChild(svgText(round2(PLOT.l + slot * b + slot / 2), PLOT.b + 18, 'mif-c-label', entries[b].code));
    }
    return chartFigure('Expenses by Category', svg);
  }

  function pieChart(items) {
    var total = 0;
    var parts = [];
    var k;
    for (k = 0; k < items.length; k++) {
      total += items[k].cents;
      parts.push(items[k].label + ' ' + fmt(items[k].cents));
    }
    var svg = svgEl('svg', {
      viewBox: '0 0 200 200',
      role: 'img',
      'aria-label': 'Offerings by method: ' + parts.join(', '),
      'class': 'mif-svg mif-pie',
      focusable: 'false'
    });
    var cx = 100;
    var cy = 100;
    var r = 90;
    var start = -Math.PI / 2;
    for (k = 0; k < items.length; k++) {
      if (items[k].cents <= 0 || total <= 0) continue;
      var frac = items[k].cents / total;
      var cls = PALETTE[k % PALETTE.length] + ' mif-c-sep';
      if (frac > 0.9999) {
        svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, 'class': cls }));
        continue;
      }
      var end = start + frac * 2 * Math.PI;
      var x1 = round2(cx + r * Math.cos(start));
      var y1 = round2(cy + r * Math.sin(start));
      var x2 = round2(cx + r * Math.cos(end));
      var y2 = round2(cy + r * Math.sin(end));
      var dPath = 'M' + cx + ' ' + cy + ' L' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z';
      svg.appendChild(svgEl('path', { d: dPath, 'class': cls }));
      start = end;
    }

    var fig = chartFigure('Offerings by Method', svg);
    var legend = el('ul', 'mif-legend');
    for (k = 0; k < items.length; k++) {
      var li = el('li');
      li.appendChild(el('span', 'mif-swatch ' + SWATCH[k % SWATCH.length]));
      var text = el('span');
      text.appendChild(document.createTextNode(items[k].label + ' ('));
      text.appendChild(el('span', 'mif-fig', fmt(items[k].cents)));
      text.appendChild(document.createTextNode(')'));
      li.appendChild(text);
      legend.appendChild(li);
    }
    fig.appendChild(legend);
    return fig;
  }

  /* ---------- Home ---------- */

  function addCard(label, cents, valueClass) {
    var card = el('div', 'mif-card');
    card.appendChild(el('span', 'mif-card-label', label));
    card.appendChild(el('strong', 'mif-card-value' + (valueClass ? ' ' + valueClass : ''), fmt(cents)));
    els.cards.appendChild(card);
  }

  function renderHome() {
    clear(els.homeBody);
    clear(els.cards);
    clear(els.charts);

    var incomes = [];
    var totIncome = 0;
    var totExpenses = 0;
    for (var m = 0; m < MONTHS.length; m++) {
      var income = m < BASE.length ? BASE[m].income : juneIncome();
      var expenses = m < BASE.length ? BASE[m].expenses : sumClaims(false);
      incomes.push(income);
      totIncome += income;
      totExpenses += expenses;

      var tr = el('tr');
      tr.appendChild(el('th', null, MONTHS[m]));
      tr.lastChild.setAttribute('scope', 'row');
      tr.appendChild(numCell('td', income));
      tr.appendChild(numCell('td', expenses));
      els.homeBody.appendChild(tr);
    }

    var surplus = totIncome - totExpenses;
    addCard('Total Income', totIncome);
    addCard('Total Expense', totExpenses);
    addCard('Total Budget', TOTAL_BUDGET);
    addCard('Surplus / Deficit', surplus, surplus >= 0 ? 'mif-pos' : 'mif-neg-red');

    els.charts.appendChild(lineChart(incomes));

    var cats = [];
    for (var c = 0; c < CATEGORY_BASE.length; c++) {
      cats.push({ code: CATEGORY_BASE[c].code, cents: categoryTotal(CATEGORY_BASE[c]) });
    }
    els.charts.appendChild(columnChart(cats));

    var methods = [];
    for (var n = 0; n < METHODS.length; n++) {
      methods.push({ label: METHODS[n], cents: methodTotal(METHODS[n]) });
    }
    els.charts.appendChild(pieChart(methods));
  }

  function buildHome(panel) {
    panel.appendChild(el('h3', 'mif-heading', 'Budget vs Actual'));
    panel.appendChild(yearLine());

    els.cards = el('div', 'mif-cards');
    panel.appendChild(els.cards);
    els.charts = el('div', 'mif-charts');
    panel.appendChild(els.charts);

    // The charts are pictures, so keep the monthly numbers available as a plain table for screen readers.
    var srWrap = el('div', 'mif-sr');
    var table = el('table');
    table.appendChild(el('caption', null, 'Income and expenses for 2026, month by month. June follows the Offering and Expenses tabs.'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['Month', 'Income', 'Expenses'];
    for (var h = 0; h < heads.length; h++) {
      var th = el('th', null, heads[h]);
      th.setAttribute('scope', 'col');
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    els.homeBody = el('tbody');
    table.appendChild(els.homeBody);
    srWrap.appendChild(table);
    panel.appendChild(srWrap);
  }

  /* ---------- Offering ---------- */

  function scrollWrap(label) {
    var wrap = el('div', 'mif-scroll');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', label);
    wrap.setAttribute('tabindex', '0');
    return wrap;
  }

  function renderRows() {
    clear(els.rowsBody);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var tr = el('tr');
      tr.appendChild(el('td', 'mif-fig', row.date));
      tr.appendChild(el('td', null, row.name));
      tr.appendChild(numCell('td', row.cents));
      tr.appendChild(el('td', null, row.method));
      var statusCell = el('td');
      if (row.saved) {
        statusCell.appendChild(el('span', 'mif-saved', 'Saved'));
      } else {
        statusCell.appendChild(el('span', 'mif-tag', 'Unsaved'));
      }
      tr.appendChild(statusCell);
      var delCell = el('td');
      if (!row.saved) {
        var del = el('button', 'mif-remove', '✕');
        del.type = 'button';
        del.setAttribute('aria-label', 'Remove ' + row.name + ' row');
        del.setAttribute('data-id', String(row.id));
        delCell.appendChild(del);
      }
      tr.appendChild(delCell);
      els.rowsBody.appendChild(tr);
    }
    if (!rows.length) {
      var empty = el('tr');
      var cell = el('td', null, 'No rows yet. Add the first giver below.');
      cell.setAttribute('colspan', '6');
      empty.appendChild(cell);
      els.rowsBody.appendChild(empty);
    }
    els.activityTotal.textContent = fmt(sumRows(true));
    els.unsavedTotal.textContent = fmt(sumRows(false));
  }

  function renderNames() {
    clear(els.names);
    for (var n = 0; n < knownOrder.length; n++) {
      var opt = el('option');
      opt.value = knownOrder[n];
      els.names.appendChild(opt);
    }
  }

  function setAmount(cents) {
    amountCents = cents;
    els.amount.value = fmt(cents);
    els.addBtn.disabled = cents === 0;
  }

  function onAmountInput() {
    var digits = els.amount.value.replace(/\D/g, '').slice(0, MAX_CENTS_DIGITS);
    setAmount(digits ? parseInt(digits, 10) : 0);
  }

  function onNameInput() {
    var typed = els.name.value.trim();
    var match = known[typed.toLowerCase()];
    if (match) els.method.value = match.method;
    syncMethod();
  }

  // A blank name is a cash gift, so the method is fixed to Cash until a name is typed.
  function syncMethod() {
    var blank = !els.name.value.trim();
    if (blank) els.method.value = 'Cash';
    els.method.disabled = blank;
  }

  function addRow(event) {
    event.preventDefault();
    if (amountCents === 0) return;
    var name = els.name.value.trim();
    var method = els.method.value;
    if (!name) {
      name = CASH_NAME;
      method = 'Cash';
    } else {
      remember(name, method);
    }
    rows.push({ id: nextId++, date: ROW_DATE, name: name, method: method, cents: amountCents, saved: false });
    els.name.value = '';
    els.method.value = METHODS[0];
    syncMethod();
    setAmount(0);
    renderNames();
    renderRows();
    announce('Row added, unsaved');
    els.name.focus();
  }

  function confirmRows() {
    var count = 0;
    for (var r = 0; r < rows.length; r++) {
      if (!rows[r].saved) {
        rows[r].saved = true;
        count++;
      }
    }
    renderRows();
    renderHome();
    if (!count) {
      announce('No unsaved rows to confirm');
    } else {
      announce(count + (count === 1 ? ' row' : ' rows') + ' confirmed. June income is now ' + fmt(juneIncome()));
    }
  }

  function onRowsClick(event) {
    var target = event.target;
    while (target && target !== els.rowsBody && !(target.className === 'mif-remove')) target = target.parentNode;
    if (!target || target === els.rowsBody) return;
    var id = parseInt(target.getAttribute('data-id'), 10);
    var index = -1;
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].id === id) index = r;
    }
    if (index < 0) return;
    var pos = [].indexOf.call(els.rowsBody.querySelectorAll('.mif-remove'), target);
    var removed = rows.splice(index, 1)[0];
    renderRows();
    renderHome();
    var buttons = els.rowsBody.querySelectorAll('.mif-remove');
    if (buttons.length) {
      buttons[Math.min(pos, buttons.length - 1)].focus();
    } else {
      els.name.focus();
    }
    announce('Row removed: ' + removed.name + (removed.saved ? '. June income is now ' + fmt(juneIncome()) : ''));
  }

  function field(labelText, control) {
    var label = el('label', 'mif-field');
    label.appendChild(el('span', null, labelText));
    label.appendChild(control);
    return label;
  }

  function buildOffering(panel) {
    panel.appendChild(el('h3', 'mif-heading', 'Offering — Edit'));
    panel.appendChild(yearLine());

    // One activity only: the demo edits a single Sunday Service.
    var activity = el('select');
    var activityOpt = el('option', null, '140626 - (Sunday Service)');
    activityOpt.value = 'sunday-service';
    activity.appendChild(activityOpt);
    var activityField = field('Activity', activity);
    activityField.className += ' mif-activity';
    panel.appendChild(activityField);
    panel.appendChild(el('p', 'mif-sub mif-note', 'Rows count towards June income once you confirm them.'));

    var wrap = scrollWrap('Offering rows');
    var table = el('table', 'mif-table');
    table.appendChild(el('caption', 'mif-sr', 'Offering rows for Sunday Service, 14 Jun 2026'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['Date', 'Name', 'Amount', 'Method', 'Status', ''];
    for (var h = 0; h < heads.length; h++) {
      var th = el('th', h === 2 ? 'mif-num' : null);
      th.setAttribute('scope', 'col');
      if (heads[h]) {
        th.textContent = heads[h];
      } else {
        th.appendChild(el('span', 'mif-sr', 'Remove'));
      }
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    els.rowsBody = el('tbody');
    els.rowsBody.addEventListener('click', onRowsClick);
    table.appendChild(els.rowsBody);
    wrap.appendChild(table);
    panel.appendChild(wrap);

    var form = el('form', 'mif-form');
    form.setAttribute('autocomplete', 'off');
    form.addEventListener('submit', addRow);

    els.name = el('input');
    els.name.type = 'text';
    els.name.setAttribute('list', 'mif-names');
    els.name.setAttribute('maxlength', '40');
    els.name.addEventListener('input', onNameInput);
    els.name.addEventListener('change', onNameInput);
    els.names = el('datalist');
    els.names.id = 'mif-names';
    var nameField = field('Name (optional)', els.name);
    nameField.appendChild(els.names);
    form.appendChild(nameField);

    els.method = el('select');
    for (var m = 0; m < METHODS.length; m++) {
      var opt = el('option', null, METHODS[m]);
      opt.value = METHODS[m];
      els.method.appendChild(opt);
    }
    form.appendChild(field('Method', els.method));

    els.amount = el('input', 'mif-amount');
    els.amount.type = 'text';
    els.amount.setAttribute('inputmode', 'numeric');
    els.amount.addEventListener('input', onAmountInput);
    form.appendChild(field('Amount', els.amount));

    els.addBtn = el('button', 'mif-btn', '+ Add row');
    els.addBtn.type = 'submit';
    form.appendChild(els.addBtn);
    panel.appendChild(form);

    var totals = el('div', 'mif-totals');
    var t1 = el('span', null, 'Activity total: ');
    els.activityTotal = el('strong');
    t1.appendChild(els.activityTotal);
    var t2 = el('span', null, 'Unsaved: ');
    els.unsavedTotal = el('strong');
    t2.appendChild(els.unsavedTotal);
    var confirmBtn = el('button', 'mif-btn mif-btn-primary', 'Confirm');
    confirmBtn.type = 'button';
    confirmBtn.addEventListener('click', confirmRows);
    totals.appendChild(t1);
    totals.appendChild(t2);
    totals.appendChild(confirmBtn);
    panel.appendChild(totals);

    setAmount(0);
    renderNames();
    syncMethod();
  }

  /* ---------- Expenses ---------- */

  function iconSvg(className) {
    var svg = svgEl('svg', {
      'class': className,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    return svg;
  }

  function lockIcon() {
    var svg = iconSvg('mif-lock');
    svg.appendChild(svgEl('rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }));
    svg.appendChild(svgEl('path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }));
    return svg;
  }

  function chevronIcon() {
    var svg = iconSvg('mif-chevron');
    svg.appendChild(svgEl('path', { d: 'M6 9l6 6 6-6' }));
    return svg;
  }

  function renderClaims(focusId) {
    clear(els.claimsBody);
    for (var c = 0; c < claims.length; c++) {
      var claim = claims[c];
      var tr = el('tr', claim.paid ? 'mif-locked' : null);
      tr.appendChild(el('td', 'mif-fig', String(c + 1)));
      tr.appendChild(el('td', 'mif-fig', claim.date));
      tr.appendChild(el('td', null, claim.category.code + ' - ' + claim.category.name));
      tr.appendChild(el('td', null, claim.desc));
      tr.appendChild(numCell('td', claim.cents));
      tr.appendChild(el('td', null, claim.by));
      var statusCell = el('td');
      statusCell.appendChild(el('span', 'mif-pill ' + (claim.paid ? 'mif-pill-paid' : 'mif-pill-unpaid'), claim.paid ? 'Claimed' : 'Unclaimed'));
      if (claim.paid) {
        statusCell.appendChild(lockIcon());
        statusCell.appendChild(el('span', 'mif-sr', 'locked'));
      }
      tr.appendChild(statusCell);
      var actionCell = el('td');
      var btn = el('button', claim.paid ? 'mif-btn' : 'mif-btn mif-btn-tonal', claim.paid ? 'Mark Unpaid' : 'Mark Paid');
      btn.type = 'button';
      btn.setAttribute('data-id', String(claim.id));
      btn.setAttribute('aria-label', (claim.paid ? 'Mark Unpaid' : 'Mark Paid') + ': ' + claim.desc);
      actionCell.appendChild(btn);
      tr.appendChild(actionCell);
      els.claimsBody.appendChild(tr);
      if (focusId === claim.id) btn.focus();
    }
    els.owed.textContent = fmt(sumClaims(true));
  }

  function onClaimsClick(event) {
    var target = event.target;
    while (target && target !== els.claimsBody && target.tagName !== 'BUTTON') target = target.parentNode;
    if (!target || target === els.claimsBody) return;
    var id = parseInt(target.getAttribute('data-id'), 10);
    for (var c = 0; c < claims.length; c++) {
      if (claims[c].id === id) {
        claims[c].paid = !claims[c].paid;
        renderClaims(id);
        renderHome();
        announce(claims[c].paid ? 'Claim marked paid' : 'Claim marked unpaid');
        return;
      }
    }
  }

  function buildExpenses(panel) {
    panel.appendChild(el('h3', 'mif-heading', 'Expenses — Payment'));
    panel.appendChild(yearLine());
    var owed = el('p', 'mif-owed', 'Still to pay back: ');
    els.owed = el('strong');
    owed.appendChild(els.owed);
    panel.appendChild(owed);

    var wrap = scrollWrap('Expense claims');
    var table = el('table', 'mif-table');
    table.appendChild(el('caption', 'mif-sr', 'Expense claims, June 2026'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['No', 'Date', 'Category', 'Description', 'Amount', 'Claimed By', 'Status', 'Action'];
    for (var h = 0; h < heads.length; h++) {
      var th = el('th', h === 4 ? 'mif-num' : null, heads[h]);
      th.setAttribute('scope', 'col');
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    els.claimsBody = el('tbody');
    els.claimsBody.addEventListener('click', onClaimsClick);
    table.appendChild(els.claimsBody);
    wrap.appendChild(table);
    panel.appendChild(wrap);
  }

  /* ---------- Window, tabs ---------- */

  var TABS = [
    { key: 'home', label: 'Home', menu: false, build: buildHome },
    { key: 'offering', label: 'Offering', menu: true, build: buildOffering },
    { key: 'expenses', label: 'Expenses', menu: true, build: buildExpenses }
  ];
  var tabButtons = [];
  var panels = [];

  function selectTab(index, focus) {
    for (var t = 0; t < TABS.length; t++) {
      var on = t === index;
      tabButtons[t].setAttribute('aria-selected', on ? 'true' : 'false');
      tabButtons[t].setAttribute('tabindex', on ? '0' : '-1');
      panels[t].hidden = !on;
    }
    if (focus) tabButtons[index].focus();
  }

  function onTabKey(event) {
    var current = tabButtons.indexOf(event.currentTarget);
    var next = -1;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(next, true);
  }

  function build() {
    clear(host);

    var win = el('div', 'mif-window');
    var titlebar = el('div', 'mif-titlebar');
    var title = el('button', 'mif-title');
    title.type = 'button';
    title.setAttribute('aria-label', 'Example Church, go to home');
    title.appendChild(document.createTextNode('Example Church'));
    title.appendChild(el('span', 'mif-title-rest', ' · Yearly Financial Report'));
    title.addEventListener('click', function () {
      selectTab(0, false);
    });
    titlebar.appendChild(title);
    // A static stand-in for the app's year dropdown.
    var year = el('span', 'mif-year', '2026');
    year.appendChild(chevronIcon());
    titlebar.appendChild(year);
    win.appendChild(titlebar);

    var menubar = el('div', 'mif-menubar');
    var tablist = el('div', 'mif-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'MIF Finance');
    menubar.appendChild(tablist);
    // Menu entries the demo does not have: shown for fidelity, not interactive.
    var off = ['Budget', 'Import / Export ▾', 'Settings'];
    for (var o = 0; o < off.length; o++) {
      var item = el('span', 'mif-menu-item mif-menu-off', off[o]);
      item.setAttribute('aria-hidden', 'true');
      menubar.appendChild(item);
    }
    win.appendChild(menubar);

    for (var t = 0; t < TABS.length; t++) {
      var tab = el('button', 'mif-tab', TABS[t].label);
      tab.type = 'button';
      tab.id = 'mif-tab-' + TABS[t].key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'mif-panel-' + TABS[t].key);
      if (TABS[t].menu) {
        var caret = el('span', null, ' ▾');
        caret.setAttribute('aria-hidden', 'true');
        tab.appendChild(caret);
      }
      tab.addEventListener('click', makeTabClick(t));
      tab.addEventListener('keydown', onTabKey);
      tablist.appendChild(tab);
      tabButtons.push(tab);

      var panel = el('div', 'mif-panel');
      panel.id = 'mif-panel-' + TABS[t].key;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      TABS[t].build(panel);
      win.appendChild(panel);
      panels.push(panel);
    }

    els.status = el('p', 'mif-sr');
    els.status.setAttribute('aria-live', 'polite');
    els.status.setAttribute('role', 'status');
    win.appendChild(els.status);

    host.appendChild(win);

    renderRows();
    renderClaims();
    renderHome();
    selectTab(0, false);
  }

  function makeTabClick(index) {
    return function () {
      selectTab(index, false);
    };
  }

  build();
})();
