/* Вариант «Перетекание». Включается ?fade, выключается ?flat (класс v-fade ставится скриптом в <head>).
   vf-in / vf-out — винные блоки перетекают в крем (фон-градиент в fade.css).
   Фото растворяются в фон без CSS-масок: поверх кладётся неподвижная плёнка .vf-ov цвета фона.
   Маски заставляли браузер перерисовывать видео и движущиеся фото на каждом кадре — отсюда были лаги и мерцание. */
(function () {
  var D = document, H = D.documentElement;
  if (!H.classList.contains('v-fade')) return;
  var WINE = 'rgb(42, 3, 12)', RGB = { w: '42,3,12', c: '239,228,214' };
  function bg(el) { return getComputedStyle(el).backgroundColor === WINE ? 'w' : 'c'; }
  function vb() { var p = D.createElement('div'); p.style.height = 'var(--vb)'; D.body.appendChild(p); var h = p.offsetHeight; p.remove(); return h || 160; }
  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  /* плавный градиент «цвет фона → прозрачно» на отрезке [a%, b%] */
  function fadeTo(rgb, dir, a, b) {
    var s = [];
    for (var i = 0; i <= 8; i++) { var t = i / 8; s.push('rgba(' + rgb + ',' + (1 - ease(t)).toFixed(3) + ') ' + (a + (b - a) * t).toFixed(2) + '%'); }
    return 'linear-gradient(' + dir + ',' + s.join(',') + ')';
  }
  function edges(rgb, x, y) {   /* x, y — ширина растворения в % по горизонтали и вертикали */
    return [fadeTo(rgb, '90deg', 0, x), fadeTo(rgb, '270deg', 0, x), fadeTo(rgb, '180deg', 0, y), fadeTo(rgb, '0deg', 0, y)].join(',');
  }
  function film(host, before, bgImg) {
    var d = D.createElement('div'); d.className = 'vf-ov'; d.setAttribute('aria-hidden', 'true'); d.style.backgroundImage = bgImg;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(d, before || null); return d;
  }

  var blocks = [].filter.call(D.querySelectorAll('section, footer.ft'), function (s) { return !s.parentElement.closest('section, footer') && s.getBoundingClientRect().height > 40; });
  var col = blocks.map(bg), band = vb();
  blocks.forEach(function (s, i) { s.dataset.vfc = col[i]; });
  function colorOf(el) { var s = el.closest('[data-vfc]'); return RGB[s ? s.dataset.vfc : 'c']; }

  blocks.forEach(function (s, i) {
    var fullPhoto = [].some.call(s.querySelectorAll(':scope > img, :scope > video, :scope > picture'), function (m) { return m.getBoundingClientRect().width > innerWidth * .95; });
    if (col[i] === 'w' && i === 0 && fullPhoto) {
      /* первый экран: фото уходит в вино плёнкой, затем вино → крем */
      s.classList.add('vf-hero');
      var media = [].filter.call(s.children, function (c) {
        var cs = getComputedStyle(c);
        return c.tagName === 'IMG' || c.tagName === 'VIDEO' || c.tagName === 'PICTURE' || (cs.position === 'absolute' && !c.textContent.trim());
      });
      var last = media[media.length - 1];
      if (last) {
        /* одна плёнка: фото уходит в вино, затем вино → крем (полоса --vb); видео под ней не перерисовывает маску */
        var hh = s.offsetHeight, toCream = col[i + 1] === 'c', room = toCream ? hh - band : hh, stay = hh * .48, st = [], k, t, e;
        for (k = 0; k <= 8; k++) { t = k / 8; st.push('rgba(' + RGB.w + ',' + ease(t).toFixed(3) + ') ' + ((stay + (room - stay) * t) / hh * 100).toFixed(2) + '%'); }
        if (toCream) for (k = 1; k <= 12; k++) {
          t = k / 12; e = ease(t);
          var c = [42 + (239 - 42) * e, 3 + (228 - 3) * e, 12 + (214 - 12) * e].map(Math.round).join(',');
          st.push('rgb(' + c + ') ' + ((room + band * t) / hh * 100).toFixed(2) + '%');
        }
        film(s, last.nextSibling, 'linear-gradient(180deg,' + st.join(',') + ')');
      }
      if (col[i + 1] === 'c') {
        s.classList.add('vf-out');
        [].forEach.call(s.children, function (t) {
          if (!t.textContent.trim() || media.indexOf(t) > -1) return;
          var pb = parseFloat(getComputedStyle(t).paddingBottom) || 0; t.style.paddingBottom = (pb + band * 1.05) + 'px';
        });
      }
      return;
    }
    if (col[i] !== 'w') return;
    var cs = getComputedStyle(s);
    if (i > 0 && col[i - 1] === 'c') { s.classList.add('vf-in'); s.style.paddingTop = ((parseFloat(cs.paddingTop) || 0) + band * .8) + 'px'; }
    if (i < blocks.length - 1 && col[i + 1] === 'c') { s.classList.add('vf-out'); s.style.paddingBottom = ((parseFloat(cs.paddingBottom) || 0) + band * .8) + 'px'; }
  });

  /* фото внутри блоков: мягкие края плёнкой цвета фона */
  [].forEach.call(D.querySelectorAll('main img, body > div img'), function (im) {
    if (im.closest('.vf-hero, .zr-sec, .dp, .dpanels, .id-rail, .cert-ph, .site-head, .ft, .ch, .bk, .nav-mob, .intro, .cert')) return;
    var ir = im.getBoundingClientRect(); if ((ir.width || im.offsetWidth) < 220) return;
    var p = im.parentElement, pr = p.getBoundingClientRect();
    var fills = Math.abs(pr.width - ir.width) < 8 && Math.abs(pr.height - ir.height) < 8;
    if (p.querySelector(':scope > .vf-ov')) return;
    var wide = ir.width > innerWidth * .8;
    var f = film(p, fills ? null : im.nextSibling, edges(colorOf(p), wide ? 3 : 6, wide ? 8 : 7));
    if (!fills) {                       /* рамки по размеру фото нет — ставим плёнку точно на фото */
      var place = function () { f.style.inset = 'auto'; f.style.left = im.offsetLeft + 'px'; f.style.top = im.offsetTop + 'px'; f.style.width = im.offsetWidth + 'px'; f.style.height = im.offsetHeight + 'px'; };
      place(); addEventListener('resize', place); if (!im.complete) im.addEventListener('load', place);
    }
  });

  /* блок направлений: края перетекают в крем */
  [].forEach.call(D.querySelectorAll('.dpanels .dp'), function (dp) {
    var r = dp.getBoundingClientRect(), x = Math.min(4, 2000 / Math.max(r.width, 1)), y = Math.min(6, 3200 / Math.max(r.height, 1));
    film(dp, null, edges(colorOf(dp), x, y)).style.zIndex = '1';
  });

  /* широкое фото «Можно задержаться»: сверху крем, снизу вино */
  [].forEach.call(D.querySelectorAll('.zr-sec .zr-frame'), function (f) {
    film(f, null, fadeTo(RGB.c, '180deg', 0, 22) + ',' + fadeTo(RGB.w, '0deg', 0, 20));
  });

  /* карта: растворяется сверху и снизу */
  [].forEach.call(D.querySelectorAll('.mapx'), function (m) {
    var c = colorOf(m); film(m, null, fadeTo(c, '180deg', 0, 14) + ',' + fadeTo(c, '0deg', 0, 14)).style.zIndex = '500';
  });
})();
