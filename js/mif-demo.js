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
  var MONTHLY_BUDGET = 400000;
  var CASH_NAME = 'Cash (no name)';
  var METHODS = ['Bank transfer', 'Cash', 'Cheque'];
  var MAX_CENTS_DIGITS = 8;

  var nextId = 1;
  var rows = [
    { id: nextId++, name: 'Grace Lim', method: 'Bank transfer', cents: 20000, saved: true },
    { id: nextId++, name: 'Daniel Tan', method: 'Bank transfer', cents: 35000, saved: true },
    { id: nextId++, name: 'Ruth Chong', method: 'Cheque', cents: 12000, saved: true },
    { id: nextId++, name: CASH_NAME, method: 'Cash', cents: 8500, saved: true }
  ];
  var claims = [
    { id: 1, date: '02 Jun', category: 'MIF-03 Hospitality', desc: 'Fellowship lunch supplies', cents: 12050, by: 'Mary Ong', paid: true },
    { id: 2, date: '05 Jun', category: 'PJS-01 Outreach', desc: 'Printing flyers', cents: 8600, by: 'David Koh', paid: true },
    { id: 3, date: '09 Jun', category: 'CAMP-02 Transport', desc: 'Van hire for youth camp', cents: 24000, by: 'Peter Yap', paid: false },
    { id: 4, date: '11 Jun', category: 'OUT-01 Missions', desc: 'Visiting speaker travel', cents: 4575, by: 'Sarah Teo', paid: false },
    { id: 5, date: '13 Jun', category: 'MIF-03 Hospitality', desc: 'Sunday morning refreshments', cents: 15000, by: 'Mary Ong', paid: false }
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

  function fmt(cents) {
    var neg = cents < 0;
    var n = Math.abs(Math.round(cents));
    var whole = String(Math.floor(n / 100));
    var frac = n % 100;
    var out = '';
    while (whole.length > 3) {
      out = ',' + whole.slice(-3) + out;
      whole = whole.slice(0, -3);
    }
    out = whole + out;
    return (neg ? '-' : '') + out + '.' + (frac < 10 ? '0' : '') + frac;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function numCell(tag, cents, extra) {
    var cell = el(tag, 'mif-num' + (cents < 0 ? ' mif-neg' : '') + (extra ? ' ' + extra : ''), fmt(cents));
    return cell;
  }

  function announce(message) {
    // Repeating the same text would not be read out again, so alternate a trailing space.
    if (message === lastAnnouncement) message += ' ';
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
    return sumRows(true);
  }

  /* ---------- Home ---------- */

  function renderHome() {
    clear(els.homeBody);
    clear(els.homeFoot);
    var running = 0;
    var totIncome = 0;
    var totExpenses = 0;
    var totBudget = 0;
    for (var m = 0; m < MONTHS.length; m++) {
      var income = m < BASE.length ? BASE[m].income : juneIncome();
      var expenses = m < BASE.length ? BASE[m].expenses : sumClaims(false);
      var surplus = income - expenses;
      running += surplus;
      totIncome += income;
      totExpenses += expenses;
      totBudget += MONTHLY_BUDGET;

      var tr = el('tr');
      tr.appendChild(el('th', null, MONTHS[m]));
      tr.lastChild.setAttribute('scope', 'row');
      tr.appendChild(numCell('td', income));
      tr.appendChild(numCell('td', expenses));
      tr.appendChild(numCell('td', MONTHLY_BUDGET));
      tr.appendChild(numCell('td', surplus));
      tr.appendChild(numCell('td', running));
      els.homeBody.appendChild(tr);
    }
    var foot = el('tr');
    foot.appendChild(el('th', null, 'Total'));
    foot.lastChild.setAttribute('scope', 'row');
    foot.appendChild(numCell('td', totIncome));
    foot.appendChild(numCell('td', totExpenses));
    foot.appendChild(numCell('td', totBudget));
    foot.appendChild(numCell('td', totIncome - totExpenses));
    foot.appendChild(numCell('td', running));
    els.homeFoot.appendChild(foot);
  }

  function buildHome(panel) {
    panel.appendChild(el('h3', 'mif-heading', 'Budget vs Actual · 2026'));
    var wrap = scrollWrap('Budget against actual, month by month');
    var table = el('table', 'mif-table');
    table.appendChild(el('caption', 'mif-sr', 'Budget against actual for 2026, month by month. June follows the Offering and Payments tabs.'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['Month', 'Income', 'Expenses', 'Budget', 'Surplus', 'Running'];
    for (var h = 0; h < heads.length; h++) {
      var th = el('th', h > 0 ? 'mif-num' : null, heads[h]);
      th.setAttribute('scope', 'col');
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    els.homeBody = el('tbody');
    els.homeFoot = el('tfoot');
    table.appendChild(els.homeBody);
    table.appendChild(els.homeFoot);
    wrap.appendChild(table);
    panel.appendChild(wrap);
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
      tr.appendChild(el('td', null, row.name));
      tr.appendChild(el('td', null, row.method));
      tr.appendChild(numCell('td', row.cents));
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
      cell.setAttribute('colspan', '5');
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
    rows.push({ id: nextId++, name: name, method: method, cents: amountCents, saved: false });
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
    panel.appendChild(el('h3', 'mif-heading', 'Sunday Service · 14 Jun 2026'));
    panel.appendChild(el('p', 'mif-sub', 'Rows count towards June income once you confirm them.'));

    var wrap = scrollWrap('Offering rows');
    var table = el('table', 'mif-table');
    table.appendChild(el('caption', 'mif-sr', 'Offering rows for Sunday Service, 14 Jun 2026'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['Name', 'Method', 'Amount', 'Status', ''];
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

  /* ---------- Payments ---------- */

  function lockIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mif-lock');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', '5');
    body.setAttribute('y', '11');
    body.setAttribute('width', '14');
    body.setAttribute('height', '9');
    body.setAttribute('rx', '2');
    var shackle = document.createElementNS(SVG_NS, 'path');
    shackle.setAttribute('d', 'M8 11V8a4 4 0 0 1 8 0v3');
    svg.appendChild(body);
    svg.appendChild(shackle);
    return svg;
  }

  function renderClaims(focusId) {
    clear(els.claimsBody);
    for (var c = 0; c < claims.length; c++) {
      var claim = claims[c];
      var tr = el('tr', claim.paid ? 'mif-locked' : null);
      tr.appendChild(el('td', null, claim.date));
      tr.appendChild(el('td', null, claim.category));
      tr.appendChild(el('td', null, claim.desc));
      tr.appendChild(numCell('td', claim.cents));
      tr.appendChild(el('td', null, claim.by));
      var statusCell = el('td');
      statusCell.appendChild(el('span', 'mif-pill ' + (claim.paid ? 'mif-pill-paid' : 'mif-pill-unpaid'), claim.paid ? 'Paid' : 'Unpaid'));
      if (claim.paid) {
        statusCell.appendChild(lockIcon());
        statusCell.appendChild(el('span', 'mif-sr', 'locked'));
      }
      tr.appendChild(statusCell);
      var actionCell = el('td');
      var btn = el('button', 'mif-btn', claim.paid ? 'Mark unpaid' : 'Mark paid');
      btn.type = 'button';
      btn.setAttribute('data-id', String(claim.id));
      btn.setAttribute('aria-label', (claim.paid ? 'Mark unpaid' : 'Mark paid') + ': ' + claim.desc);
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

  function buildPayments(panel) {
    panel.appendChild(el('h3', 'mif-heading', 'Expense claims'));
    var owed = el('p', 'mif-owed', 'Still to pay back: ');
    els.owed = el('strong');
    owed.appendChild(els.owed);
    panel.appendChild(owed);

    var wrap = scrollWrap('Expense claims');
    var table = el('table', 'mif-table');
    table.appendChild(el('caption', 'mif-sr', 'Expense claims, June 2026'));
    var thead = el('thead');
    var hr = el('tr');
    var heads = ['Date', 'Category', 'Description', 'Amount', 'Claimed by', 'Status', ''];
    for (var h = 0; h < heads.length; h++) {
      var th = el('th', h === 3 ? 'mif-num' : null);
      th.setAttribute('scope', 'col');
      if (heads[h]) {
        th.textContent = heads[h];
      } else {
        th.appendChild(el('span', 'mif-sr', 'Action'));
      }
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
    { key: 'home', label: 'Home', build: buildHome },
    { key: 'offering', label: 'Offering', build: buildOffering },
    { key: 'payments', label: 'Payments', build: buildPayments }
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
    titlebar.appendChild(el('span', 'mif-title', 'Example Church'));
    titlebar.appendChild(el('span', 'mif-year', '2026'));
    win.appendChild(titlebar);

    var tablist = el('div', 'mif-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'MIF Finance');
    win.appendChild(tablist);

    for (var t = 0; t < TABS.length; t++) {
      var tab = el('button', 'mif-tab', TABS[t].label);
      tab.type = 'button';
      tab.id = 'mif-tab-' + TABS[t].key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'mif-panel-' + TABS[t].key);
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
