/* Вариант бренда MIAU (латиница, как было до 24.11). Включается ?miau, выключается ?myau (класс b-miau ставит скрипт в <head>).
   Меняет на лету: логотипы и эмблемы, фото сертификатов и мерча (файлы *-miau.*), значок вкладки и слово «МЯУ» в текстах,
   в том числе в чате, который появляется позже. Русская версия (по умолчанию) не трогается. */
(function () {
  var D = document, H = D.documentElement;
  if (!H.classList.contains('b-miau')) return;
  var MAP = [
    [/logo-myau-(beige|wine)\.svg/g, 'logo-miau-beige.svg'],
    [/emblem-myau-(wine|cream)\.webp/g, 'emblem-$1.webp'],
    [/((?:cert|merch)-[a-z-]+?)\.(webp|jpg)/g, function (m, n, e) { return /-miau$/.test(n) ? m : n + '-miau.' + e; }],
    [/favicon\.png/g, 'favicon-miau.png'],
    [/apple-touch-icon\.png/g, 'favicon-miau.png']
  ];
  function url(v) { if (!v) return v; var o = v; MAP.forEach(function (r) { v = v.replace(r[0], r[1]); }); return v === o ? o : v; }
  function txt(v) { return v && v.indexOf('МЯУ') > -1 ? v.replace(/МЯУ/g, 'MIAU') : v; }
  var ATTR_URL = ['src', 'srcset', 'href', 'data-src', 'poster'], ATTR_TXT = ['alt', 'aria-label', 'title', 'placeholder', 'content'];
  function fixEl(el) {
    if (el.nodeType !== 1) return;
    ATTR_URL.forEach(function (a) { var v = el.getAttribute(a); if (v) { var n = url(v); if (n !== v) el.setAttribute(a, n); } });
    ATTR_TXT.forEach(function (a) { var v = el.getAttribute(a); if (v) { var n = txt(v); if (n !== v) el.setAttribute(a, n); } });
    var st = el.getAttribute('style'); if (st && /url\(/.test(st)) { var ns = url(st); if (ns !== st) el.setAttribute('style', ns); }
  }
  function walk(root) {
    if (root.nodeType === 3) { var t = txt(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' && root.type !== 'application/ld+json') return;
    fixEl(root);
    var w = D.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (n.parentNode && n.parentNode.tagName === 'SCRIPT' && n.parentNode.type !== 'application/ld+json') continue; var tv = txt(n.nodeValue); if (tv !== n.nodeValue) n.nodeValue = tv; }
      else fixEl(n);
    }
  }
  /* большое слово в подвале нарисовано маской из файла логотипа */
  var css = D.createElement('style');
  css.textContent = '.b-miau .ft-word{aspect-ratio:1854/440;-webkit-mask-image:url(assets/logo-miau-beige.svg);mask-image:url(assets/logo-miau-beige.svg)}';
  D.head.appendChild(css);
  D.title = txt(D.title);
  walk(D.head); walk(D.body);
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'characterData') { var t = txt(m.target.nodeValue); if (t !== m.target.nodeValue) m.target.nodeValue = t; }
      else if (m.type === 'attributes') fixEl(m.target);
      else m.addedNodes.forEach(walk);
    });
  }).observe(D.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR_URL.concat(ATTR_TXT, ['style']) });
})();
