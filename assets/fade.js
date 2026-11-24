/* Вариант «Перетекание». Включается ?fade, выключается ?flat (класс v-fade ставится скриптом в <head>).
   Расставляет классы: vf-in / vf-out — винные блоки перетекают в крем; vf-hero + vf-m — первый экран;
   vf-soft — фото внутри блоков с мягкими краями. */
(function () {
  var D = document, H = D.documentElement;
  if (!H.classList.contains('v-fade')) return;
  var WINE = 'rgb(42, 3, 12)';
  function bg(el) { var c = getComputedStyle(el).backgroundColor; return c === WINE ? 'w' : 'c'; }
  function vb() { return parseFloat(getComputedStyle(H).getPropertyValue('--vb')) || Math.min(168, Math.max(96, innerWidth * .1)); }
  var blocks = [].filter.call(D.querySelectorAll('section, footer.ft'), function (s) { return !s.parentElement.closest('section, footer') && s.getBoundingClientRect().height > 40; });
  var col = blocks.map(bg), band = vb();
  blocks.forEach(function (s, i) {
    var r = s.getBoundingClientRect();
    var fullPhoto = [].some.call(s.querySelectorAll(':scope > img, :scope > video, :scope > picture'), function (m) { return m.getBoundingClientRect().width > innerWidth * .95; });
    if (col[i] === 'w' && i === 0 && fullPhoto) {
      /* первый экран: фото и затемнения растворяются вниз в вино, затем вино → крем */
      s.classList.add('vf-hero');
      [].forEach.call(s.children, function (c) {
        var cs = getComputedStyle(c);
        if ((c.tagName === 'IMG' || c.tagName === 'VIDEO' || c.tagName === 'PICTURE' || (cs.position === 'absolute' && !c.textContent.trim()))) c.classList.add('vf-m');
      });
      if (col[i + 1] === 'c') {
        s.classList.add('vf-out');
        var txt = [].filter.call(s.children, function (c) { return c.textContent.trim() && !c.classList.contains('vf-m'); });
        txt.forEach(function (t) { var pb = parseFloat(getComputedStyle(t).paddingBottom) || 0; t.style.paddingBottom = (pb + band * 1.05) + 'px'; });
      }
      return;
    }
    if (col[i] !== 'w') return;
    var cs = getComputedStyle(s);
    if (i > 0 && col[i - 1] === 'c') { s.classList.add('vf-in'); s.style.paddingTop = ((parseFloat(cs.paddingTop) || 0) + band * .8) + 'px'; }
    if (i < blocks.length - 1 && col[i + 1] === 'c') { s.classList.add('vf-out'); s.style.paddingBottom = ((parseFloat(cs.paddingBottom) || 0) + band * .8) + 'px'; }
  });
  /* фото внутри блоков */
  [].forEach.call(D.querySelectorAll('main img, body > div img'), function (im) {
    if (im.closest('.vf-hero, .zr-sec, .dp, .dpanels, .id-rail, .cert-ph, .site-head, .ft, .ch, .bk, .nav-mob, .intro, .cert')) return;
    var w = im.getBoundingClientRect().width || im.offsetWidth;
    if (w < 220) return;
    var p = im.parentElement, pr = p.getBoundingClientRect(), ir = im.getBoundingClientRect();
    var tgt = (Math.abs(pr.width - ir.width) < 8 && Math.abs(pr.height - ir.height) < 8) ? p : im;
    tgt.classList.add('vf-soft');
    if (ir.width > innerWidth * .8) tgt.classList.add('vf-wide');
  });
})();
