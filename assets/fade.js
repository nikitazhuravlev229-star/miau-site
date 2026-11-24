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
  /* маска мягких краёв для неподвижных фото и панелей: швов не даёт, а перерисовки нет — содержимое не движется */
  function maskTo(dir, a, b) {
    var st = [];
    /* первые 2px у края полностью прозрачны: при дробных координатах браузер считает маску со сдвигом, и иначе крайний пиксель фото проступает линией */
    for (var i = 0; i <= 8; i++) { var t = i / 8; st.push('rgba(0,0,0,' + ease(t).toFixed(3) + ') calc(2px + ' + (a + (b - a) * t).toFixed(2) + '%)'); }
    return 'linear-gradient(' + dir + ',transparent 0,' + st.join(',') + ',#000 calc(2px + ' + b + '%))';
  }
  function softMask(el, x, y) {
    var m = maskTo('90deg', 0, x) + ',' + maskTo('270deg', 0, x);
    var v = maskTo('180deg', 0, y) + ',' + maskTo('0deg', 0, y);
    /* горизонталь и вертикаль перемножаются: пересекаем две составные маски */
    el.style.webkitMaskImage = el.style.maskImage = m + ',' + v;
    el.style.webkitMaskComposite = 'source-in'; el.style.maskComposite = 'intersect';
    el.classList.add('vf-mask');
    /* обводка цвета фона внутри края: закрывает пиксель, который при дробном масштабе остаётся без маски */
    el.style.outline = '2px solid rgb(' + colorOf(el) + ')'; el.style.outlineOffset = '-2px';
  }
  function edges(rgb, x, y) {   /* x, y — ширина растворения в % по горизонтали и вертикали */
    return [fadeTo(rgb, '90deg', 0, x), fadeTo(rgb, '270deg', 0, x), fadeTo(rgb, '180deg', 0, y), fadeTo(rgb, '0deg', 0, y)].join(',');
  }
  /* фото под плёнкой обрезаем на 1px внутрь: иначе на границе между пикселями из-под плёнки проступает тонкая тёмная линия */
  function cut(el) { [].forEach.call(el.matches && el.matches('img, video, picture') ? [el] : el.querySelectorAll('img, video, picture'), function (m) { m.classList.add('vf-cut'); }); }
  function film(host, before, bgImg, media) {
    var d = D.createElement('div'); d.className = 'vf-ov'; d.setAttribute('aria-hidden', 'true'); d.style.backgroundImage = bgImg;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(d, before || null); cut(media || host);
    return d;
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
        media.forEach(function (m) { m.classList.add('vf-cut'); });
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

  /* фото внутри блоков: мягкие края маской */
  [].forEach.call(D.querySelectorAll('main img, body > div img'), function (im) {
    if (im.closest('.vf-hero, .zr-sec, .dp, .dpanels, .id-rail, .cert-ph, .site-head, .ft, .ch, .bk, .nav-mob, .intro, .cert')) return;
    var ir = im.getBoundingClientRect(); if ((ir.width || im.offsetWidth) < 220) return;
    var p = im.parentElement, pr = p.getBoundingClientRect();
    var fills = Math.abs(pr.width - ir.width) < 8 && Math.abs(pr.height - ir.height) < 8;
    var t = fills ? p : im; if (t.classList.contains('vf-mask')) return;
    var wide = ir.width > innerWidth * .8;
    softMask(t, wide ? 3 : 6, wide ? 8 : 7);
  });

  /* блок направлений: края перетекают в крем (маска; панель перерисовывается только при клике) */
  [].forEach.call(D.querySelectorAll('.dpanels .dp'), function (dp) {
    var r = dp.getBoundingClientRect();
    softMask(dp, Math.min(4, 2000 / Math.max(r.width, 1)), Math.min(6, 3200 / Math.max(r.height, 1)));
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
