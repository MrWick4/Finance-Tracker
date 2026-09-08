const CATEGORY_RULES = [
  { category: 'Groceries', class: 'cat-groceries', keywords: ['whole foods', 'trader joe', 'grocery', 'safeway', 'kroger', 'market', 'aldi'] },
  { category: 'Dining', class: 'cat-dining', keywords: ['coffee', 'cafe', 'restaurant', 'starbucks', 'chipotle', 'pizza', 'sushi', 'bar '] },
  { category: 'Subscriptions', class: 'cat-subscriptions', keywords: ['netflix', 'spotify', 'subscription', 'hulu', 'apple.com/bill', 'prime video', 'icloud'] },
  { category: 'Transport', class: 'cat-transport', keywords: ['uber', 'lyft', 'transit', 'gas', 'shell', 'chevron', 'parking'] },
  { category: 'Shopping', class: 'cat-shopping', keywords: ['amazon', 'target', 'best buy', 'store', 'mall'] },
  { category: 'Utilities', class: 'cat-utilities', keywords: ['electric', 'water bill', 'internet', 'comcast', 'utility', 'phone bill'] },
];

function categorize(desc, type) {
  if (type === 'income') return { category: 'Income', class: 'cat-income' };
  const lower = desc.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return { category: rule.category, class: rule.class };
    }
  }
  return { category: 'Other', class: 'cat-other' };
}

const ACCOUNTS_KEY = 'ledger_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'ledger_active_account_v1';
const LEGACY_STORAGE_KEY = 'ledger_transactions_v1';

function txnKeyFor(accountId) {
  return 'ledger_transactions_v1__' + accountId;
}

function loadAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return [
    { id: 'you', name: 'You' },
    { id: 'partner', name: 'Partner' }
  ];
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

let accounts = loadAccounts();
saveAccounts(accounts);

function sampleTransactions() {
  const today = new Date();
  const sample = [
    { desc: 'Acme Payroll', amount: 2400, type: 'income', daysAgo: 3 },
    { desc: 'Whole Foods Market', amount: 62.14, type: 'expense', daysAgo: 1 },
    { desc: 'Netflix', amount: 15.49, type: 'expense', daysAgo: 2 },
    { desc: 'Uber', amount: 18.30, type: 'expense', daysAgo: 4 },
    { desc: 'Blue Bottle Coffee', amount: 6.75, type: 'expense', daysAgo: 5 },
    { desc: 'Amazon', amount: 43.20, type: 'expense', daysAgo: 6 },
    { desc: 'Electric Company', amount: 88.00, type: 'expense', daysAgo: 7 },
  ];
  return sample.map(s => {
    const d = new Date(today);
    d.setDate(d.getDate() - s.daysAgo);
    const cat = categorize(s.desc, s.type);
    return { desc: s.desc, amount: s.amount, type: s.type, date: d.toISOString(), category: cat.category, class: cat.class };
  });
}

function loadTransactions(accountId) {
  const key = txnKeyFor(accountId);
  const raw = localStorage.getItem(key);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  if (accountId === 'you') {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        localStorage.setItem(key, JSON.stringify(legacy));
        return legacy;
      } catch (e) { /* fall through to sample */ }
    }
    const sample = sampleTransactions();
    localStorage.setItem(key, JSON.stringify(sample));
    return sample;
  }
  return [];
}

function saveTransactions(txns) {
  localStorage.setItem(txnKeyFor(activeAccountId), JSON.stringify(txns));
}

function getActiveAccountId() {
  const stored = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (stored && accounts.some(a => a.id === stored)) return stored;
  return accounts[0].id;
}

function setActiveAccountId(id) {
  activeAccountId = id;
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
}

let activeAccountId = getActiveAccountId();
let transactions = loadTransactions(activeAccountId);

function renderAccountSwitcher() {
  const container = document.getElementById('accountSwitcher');
  container.innerHTML = '';
  accounts.forEach(acc => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'account-tab' + (acc.id === activeAccountId ? ' active' : '');
    tab.innerHTML = '<span>' + escapeHtml(acc.name) + '</span><span class="rename-icon">\u270E</span>';
    tab.addEventListener('click', (e) => {
      if (acc.id === activeAccountId) return;
      switchAccount(acc.id);
    });
    tab.querySelector('.rename-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = window.prompt('Rename account', acc.name);
      if (newName && newName.trim()) {
        acc.name = newName.trim();
        saveAccounts(accounts);
        renderAccountSwitcher();
      }
    });
    container.appendChild(tab);
  });
}

function switchAccount(id) {
  setActiveAccountId(id);
  transactions = loadTransactions(id);
  renderAccountSwitcher();
  renderAll();
}

function formatCurrency(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'CAD' });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function animateNumber(el, target, duration = 900) {
  const startVal = 0;
  const start = performance.now();
  function step(ts) {
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (target - startVal) * eased;
    el.textContent = formatCurrency(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderRegister() {
  const list = document.getElementById('registerList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('txnCount');
  list.innerHTML = '';

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  count.textContent = sorted.length === 1 ? '1 entry' : `${sorted.length} entries`;

  if (sorted.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  sorted.forEach(t => {
    const row = document.createElement('div');
    row.className = 'txn-row';
    row.innerHTML = `
      <div class="txn-info">
        <p class="txn-desc">${escapeHtml(t.desc)}</p>
        <p class="txn-date">${formatDate(t.date)}</p>
      </div>
      <span class="txn-category ${t.class}">${t.category}</span>
      <span class="txn-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
    `;
    list.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderBreakdown() {
  const container = document.getElementById('breakdownList');
  container.innerHTML = '';
  const expenseTxns = transactions.filter(t => t.type === 'expense');
  const totals = {};
  expenseTxns.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const maxVal = Math.max(...Object.values(totals), 1);
  const colorMap = {
    Groceries: 'var(--verdigris)', Dining: 'var(--gold)', Subscriptions: '#5B4C97',
    Transport: '#385E7A', Shopping: 'var(--rose)', Utilities: '#6B6350', Other: 'var(--ink-soft)'
  };

  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <span>${cat}</span>
        <div class="breakdown-track"><div class="breakdown-fill" style="background:${colorMap[cat] || 'var(--ink-soft)'}"></div></div>
        <span class="breakdown-amount">${formatCurrency(amt)}</span>
      `;
      container.appendChild(row);
      requestAnimationFrame(() => {
        const fill = row.querySelector('.breakdown-fill');
        fill.style.width = `${(amt / maxVal) * 100}%`;
      });
    });
}

function renderSummary() {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - spent;
  animateNumber(document.getElementById('balanceNumber'), balance);
  document.getElementById('incomeMeta').textContent = `Income ${formatCurrency(income)}`;
  document.getElementById('spendMeta').textContent = `Spent ${formatCurrency(spent)}`;
}

function renderAll() {
  renderSummary();
  renderRegister();
  renderBreakdown();
}

document.getElementById('txnForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const descEl = document.getElementById('txnDesc');
  const amountEl = document.getElementById('txnAmount');
  const typeEl = document.getElementById('txnType');
  const errorEl = document.getElementById('formError');

  const desc = descEl.value.trim();
  const amount = parseFloat(amountEl.value);

  if (!desc) {
    errorEl.textContent = 'Enter a description first.';
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    errorEl.textContent = 'Enter an amount greater than zero.';
    return;
  }
  errorEl.textContent = '';

  const type = typeEl.value;
  const cat = categorize(desc, type);
  transactions.push({
    desc, amount, type, date: new Date().toISOString(),
    category: cat.category, class: cat.class
  });
  saveTransactions(transactions);
  descEl.value = '';
  amountEl.value = '';
  renderAll();
});

document.getElementById('monthLabel').textContent = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const heroTilt = document.getElementById('heroTilt');
const hero = document.getElementById('hero');
hero.addEventListener('pointermove', (e) => {
  const r = hero.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  heroTilt.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
});
hero.addEventListener('pointerleave', () => {
  heroTilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

renderAccountSwitcher();
renderAll();

// --- CSV import ---

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function findColumn(headers, candidates) {
  const lower = headers.map(h => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = lower.findIndex(h => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAmountString(str) {
  if (!str) return NaN;
  let s = str.trim().replace(/[$,]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  const val = parseFloat(s);
  if (isNaN(val)) return NaN;
  return negative ? -val : val;
}

function parseDateString(str) {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function mapCsvRows(rows) {
  if (rows.length < 2) return { entries: [], error: "That file doesn't have any data rows." };
  const headers = rows[0];
  const dateCol = findColumn(headers, ['date', 'transaction date', 'posted date']);
  const descCol = findColumn(headers, ['description', 'desc', 'memo', 'payee', 'name', 'merchant']);
  const amountCol = findColumn(headers, ['amount', 'value']);
  const debitCol = findColumn(headers, ['debit', 'withdrawal']);
  const creditCol = findColumn(headers, ['credit', 'deposit']);

  if (descCol === -1 || (amountCol === -1 && debitCol === -1 && creditCol === -1)) {
    return { entries: [], error: "Couldn't find description/amount columns in that file." };
  }

  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const desc = (r[descCol] || '').trim();
    if (!desc) continue;

    let amount, type;
    if (amountCol !== -1) {
      const raw = parseAmountString(r[amountCol]);
      if (isNaN(raw) || raw === 0) continue;
      amount = Math.abs(raw);
      type = raw < 0 ? 'expense' : 'income';
    } else {
      const debit = debitCol !== -1 ? parseAmountString(r[debitCol]) : NaN;
      const credit = creditCol !== -1 ? parseAmountString(r[creditCol]) : NaN;
      if (!isNaN(debit) && debit !== 0) { amount = Math.abs(debit); type = 'expense'; }
      else if (!isNaN(credit) && credit !== 0) { amount = Math.abs(credit); type = 'income'; }
      else continue;
    }

    const date = dateCol !== -1 ? parseDateString(r[dateCol]) : new Date().toISOString();
    const cat = categorize(desc, type);
    entries.push({ desc, amount, type, date, category: cat.category, class: cat.class });
  }
  return { entries, error: entries.length === 0 ? 'No usable rows found in that file.' : null };
}

let pendingImportEntries = [];

function openImportPreview(entries) {
  pendingImportEntries = entries;
  const list = document.getElementById('importPreviewList');
  const summary = document.getElementById('importSummary');
  list.innerHTML = '';
  summary.textContent = entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries') + ' found. Review before adding.';

  entries.forEach(t => {
    const row = document.createElement('div');
    row.className = 'import-row-item';
    row.innerHTML = '<div class="txn-info"><p class="txn-desc">' + escapeHtml(t.desc) + '</p><p class="txn-date">' + formatDate(t.date) + '</p></div>' +
      '<span class="txn-category ' + t.class + '">' + t.category + '</span>' +
      '<span class="txn-amount ' + (t.type === 'income' ? 'amount-income' : 'amount-expense') + '">' + (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount) + '</span>';
    list.appendChild(row);
  });

  document.getElementById('importBackdrop').classList.add('open');
}

function closeImportPreview() {
  document.getElementById('importBackdrop').classList.remove('open');
  pendingImportEntries = [];
}

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('csvInput').click();
});

document.getElementById('csvInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const statusEl = document.getElementById('importStatus');
  statusEl.classList.remove('is-error');
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsvText(reader.result);
    const result = mapCsvRows(rows);
    if (result.error) {
      statusEl.textContent = result.error;
      statusEl.classList.add('is-error');
      return;
    }
    statusEl.textContent = '';
    openImportPreview(result.entries);
  };
  reader.onerror = () => {
    statusEl.textContent = "Couldn't read that file. Try again.";
    statusEl.classList.add('is-error');
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('importCancel').addEventListener('click', closeImportPreview);

document.getElementById('importConfirm').addEventListener('click', () => {
  if (pendingImportEntries.length === 0) return;
  transactions = transactions.concat(pendingImportEntries);
  saveTransactions(transactions);
  const count = pendingImportEntries.length;
  closeImportPreview();
  renderAll();
  const statusEl = document.getElementById('importStatus');
  statusEl.classList.remove('is-error');
  statusEl.textContent = 'Added ' + count + ' ' + (count === 1 ? 'entry' : 'entries') + '.';
});

