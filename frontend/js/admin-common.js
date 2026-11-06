// Helpers shared by the admin and super admin pages. Text is always inserted with textContent.
const PAGE_SIZE = 10;

function byId(id) {
  return document.getElementById(id);
}

function setNote(node, message, isError = false) {
  node.textContent = message;
  node.classList.toggle('admin-dashboard-status-error', isError);
}

function showError(node, message) {
  node.textContent = message || '';
  node.className = message ? 'auth-alert auth-alert-error show' : 'auth-alert';
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
    .format(Number(amount || 0));
}

const STATUS_KIND = {
  PENDING: 'pending', UNPAID: 'pending',
  APPROVED: 'active', CONFIRMED: 'active', COMPLETED: 'active', PAID: 'active', ACTIVE: 'active',
  REJECTED: 'blocked', CANCELLED: 'blocked', REFUNDED: 'blocked', BLOCKED: 'blocked', DISABLED: 'blocked',
  ARCHIVED: 'neutral',
};

function statusPill(status) {
  return el('span', `admin-account-status is-${STATUS_KIND[status] || 'neutral'}`, String(status).replace(/_/g, ' '));
}

// A table cell holding text, a node, or several nodes.
function cell(content, className) {
  const td = el('td', className);
  [].concat(content).forEach((part) => {
    if (part !== null && part !== undefined) td.append(part instanceof Node ? part : document.createTextNode(String(part)));
  });
  return td;
}

// Cell with a main line and a smaller second line.
function cellWithSub(main, sub) {
  const td = el('td');
  td.append(el('strong', null, main));
  if (sub) td.append(el('small', null, sub));
  return td;
}

function fillTable(tbody, rows, columns, emptyText) {
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', null, emptyText);
    td.colSpan = columns;
    tr.append(td);
    tbody.replaceChildren(tr);
    return;
  }
  tbody.replaceChildren(...rows);
}

function button(text, className, onClick) {
  const b = el('button', `btn ${className} btn-small`, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function queryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined && value !== 'ALL') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

// Previous / next controls for the { items, page, total_pages, total } envelope.
function renderPager(container, info, onPage) {
  container.replaceChildren();
  if (!info || info.total_pages <= 1) {
    if (info) container.append(el('span', 'muted', `${info.total} result(s)`));
    return;
  }
  const prev = button('Previous', 'btn-secondary', () => onPage(info.page - 1));
  prev.disabled = info.page <= 1;
  const next = button('Next', 'btn-secondary', () => onPage(info.page + 1));
  next.disabled = info.page >= info.total_pages;
  container.append(prev, el('span', 'muted', `Page ${info.page} of ${info.total_pages} · ${info.total} result(s)`), next);
}

// One "Label: value" line for detail panels.
function detailLine(label, value) {
  const p = el('p');
  p.append(el('strong', null, `${label}: `), document.createTextNode(value === null || value === undefined || value === '' ? '—' : String(value)));
  return p;
}

function labeledField(labelText, control, id) {
  const group = el('div', 'form-group');
  const label = el('label', null, labelText);
  if (id) {
    label.htmlFor = id;
    control.id = id;
  }
  group.append(label, control);
  return group;
}
