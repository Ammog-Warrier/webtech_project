// Small DOM helpers. All user/DB text goes through textContent (never innerHTML).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(imageUrl, title, ...lines) {
  const article = el('article', 'card');
  const img = el('img');
  img.src = imageUrl;
  img.alt = title;
  img.loading = 'lazy';
  const body = el('div', 'card-body');
  body.append(el('h3', null, title));
  lines.forEach((l) => body.append(el('p', l.cls, l.text)));
  article.append(img, body);
  return article;
}

function showMessage(container, text) {
  container.replaceChildren(el('p', 'muted', text));
}
