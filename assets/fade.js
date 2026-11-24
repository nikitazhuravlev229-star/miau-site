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
  var col = blocks.map(bg), band = vb(), colB;
  colB = col.slice();
  /* кремовые блоки с фото становятся тёмными, как первый экран: без бежевых полей по бокам */
  function bigImgs(s) { return [].filter.call(s.querySelectorAll('img'), function (m) { return !m.closest('.site-head, .ch, .bk, .intro') && (m.getBoundingClientRect().width || m.offsetWidth) > 200; }); }
  blocks.forEach(function (s, i) {
    if (i === 0 || col[i] !== 'c' || s.matches('.zr-sec, .map-sec, footer') || s.querySelector('.zr-sec, .mapx')) return;
    var bi = bigImgs(s); if (!bi.length) return;
    col[i] = 'w'; s.classList.add('vf-dark');
    /* длинный блок, где фото только в начале (например, «Команда»): верх тёмный, затем переход в беж, ниже — на беже */
    var ph = bi[0].getBoundingClientRect();
    if (bi.length === 1 && s.offsetHeight > ph.height * 1.8) { colB[i] = 'c'; s.classList.add('vf-split'); }
  });
  blocks.forEach(function (s, i) { if (!s.classList.contains('vf-split')) colB[i] = col[i]; s.dataset.vfc = col[i]; });
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
        var hh = s.offsetHeight, toCream = colB[i] === 'w' && col[i + 1] === 'c', room = toCream ? hh - band : hh, stay = hh * .48, st = [], k, t, e;
        for (k = 0; k <= 8; k++) { t = k / 8; st.push('rgba(' + RGB.w + ',' + ease(t).toFixed(3) + ') ' + ((stay + (room - stay) * t) / hh * 100).toFixed(2) + '%'); }
        if (toCream) for (k = 1; k <= 12; k++) {
          t = k / 12; e = ease(t);
          var c = [42 + (239 - 42) * e, 3 + (228 - 3) * e, 12 + (214 - 12) * e].map(Math.round).join(',');
          st.push('rgb(' + c + ') ' + ((room + band * t) / hh * 100).toFixed(2) + '%');
        }
        film(s, last.nextSibling, 'linear-gradient(180deg,' + st.join(',') + ')');
        media.forEach(function (m) { m.classList.add('vf-cut'); });
      }
      if (toCream) {
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
    if (i > 0 && colB[i - 1] === 'c') { s.classList.add('vf-in'); s.style.paddingTop = ((parseFloat(cs.paddingTop) || 0) + band * .8) + 'px'; }
    if (i < blocks.length - 1 && colB[i] === 'w' && col[i + 1] === 'c') { s.classList.add('vf-out'); s.style.paddingBottom = ((parseFloat(cs.paddingBottom) || 0) + band * .8) + 'px'; }
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
    softMask(dp, dp.closest('.vf-dark') ? 0 : Math.min(4, 2000 / Math.max(r.width, 1)), Math.min(6, 3200 / Math.max(r.height, 1)));
  });

  /* широкое фото «Можно задержаться»: сверху крем, снизу вино */
  [].forEach.call(D.querySelectorAll('.zr-sec .zr-frame'), function (f) {
    film(f, null, fadeTo(RGB.c, '180deg', 0, 22) + ',' + fadeTo(RGB.w, '0deg', 0, 20));
  });

  /* карта: растворяется сверху и снизу */
  [].forEach.call(D.querySelectorAll('.mapx'), function (m) {
    var c = colorOf(m); film(m, null, fadeTo(c, '180deg', 0, 14) + ',' + fadeTo(c, '0deg', 0, 14)).style.zIndex = '500';
  });

  /* фото рядом с текстом → фон блока до края экрана: к тексту, вверх и вниз уходит в вино, в полосах перехода прозрачно */
  function pxMask(dir, total, a0, a1, b0, b1) {   /* прозрачно до a0, плавно до a1, сплошь до b0, плавно гаснет к b1 (всё в px) */
    var st = ['transparent 0', 'transparent ' + a0 + 'px'], k, t;
    for (k = 1; k <= 8; k++) { t = k / 8; st.push('rgba(0,0,0,' + ease(t).toFixed(3) + ') ' + (a0 + (a1 - a0) * t).toFixed(1) + 'px'); }
    for (k = 1; k <= 8; k++) { t = k / 8; st.push('rgba(0,0,0,' + (1 - ease(t)).toFixed(3) + ') ' + (b0 + (b1 - b0) * t).toFixed(1) + 'px'); }
    st.push('transparent ' + total + 'px');
    return 'linear-gradient(' + dir + ',' + st.join(',') + ')';
  }
  var bleeds = [];
  [].forEach.call(D.querySelectorAll('.vf-dark'), function (s) {
    var imgs = bigImgs(s); if (imgs.length !== 1) return;
    var im = imgs[0], P = im.closest('.zoom, .quote-ph, .svc-ph') || im.parentElement;
    if (P.closest('.dpanels, .rc, .light-rail') || P === s) return;
    var L = D.createElement('div'); L.className = 'vf-bg'; L.setAttribute('aria-hidden', 'true');
    L.style.backgroundImage = 'url("' + (im.currentSrc || im.src) + '")';
    s.insertBefore(L, s.firstChild); P.style.visibility = 'hidden';
    bleeds.push([s, P, L, im]);
  });
  function markLight(el, absY) {      /* всё, что ниже границы, — на беже: тёмный текст */
    [].forEach.call(el.children, function (c) {
      if (c.classList.contains('vf-bg')) return;
      var r = c.getBoundingClientRect();
      if (r.top >= absY - 4) { c.classList.add('vf-light'); c.dataset.vfc = 'c'; }
      else if (r.bottom > absY) markLight(c, absY);
    });
  }
  function layout() {
    bleeds.forEach(function (b) {
      var s = b[0], P = b[1], L = b[2], im = b[3];
      if (im.currentSrc && L.style.backgroundImage.indexOf(im.currentSrc) < 0) L.style.backgroundImage = 'url("' + im.currentSrc + '")';
      var sr = s.getBoundingClientRect(), pr = P.getBoundingClientRect(), H = s.offsetHeight;
      var topT = s.classList.contains('vf-in') ? band : 0, botT = s.classList.contains('vf-out') ? band : 0;
      var top = 0, h = H;
      if (s.classList.contains('vf-split')) {
        /* граница: под фото. Выше — вино, затем полоса вино → беж, ниже — беж и тёмный текст */
        /* граница — под всем рядом с фото (вместе с текстом), а не только под фото: на телефоне текст стоит под снимком */
        var A = P; while (A.parentElement && A.parentElement !== s && A.parentElement.offsetHeight < H * .6) A = A.parentElement;
        var Y = Math.round(Math.max(pr.bottom, A.getBoundingClientRect().bottom) - sr.top + 40), g = ['#2A030C 0', '#2A030C ' + Y + 'px'], k2, t2, e2;
        for (k2 = 1; k2 <= 12; k2++) { t2 = k2 / 12; e2 = ease(t2); g.push('rgb(' + [42 + 197 * e2, 3 + 225 * e2, 12 + 202 * e2].map(Math.round).join(',') + ') ' + Math.round(Y + band * t2) + 'px'); }
        if (!s.classList.contains('vf-in')) s.style.setProperty('background', 'linear-gradient(180deg,' + g.join(',') + ',#EFE4D6 100%)', 'important');
        markLight(s, sr.top + Y);
        /* бежевую часть опускаем ниже полосы перехода, чтобы тёмный текст не попадал на тёмное */
        var first = s.querySelector('.vf-light');
        if (first) { if (first.dataset.mt == null) first.dataset.mt = parseFloat(getComputedStyle(first).marginTop) || 0; first.style.marginTop = (+first.dataset.mt + band) + 'px'; }
        h = Y; botT = 0;
      }
      var st = L.style; st.top = top + 'px'; st.height = h + 'px';
      var vm = pxMask('180deg', h, topT, topT + Math.max(120, h * .22), h - botT - Math.max(120, h * .22), h - botT), hm;
      if (pr.width > sr.width * .7) {                                   /* телефон: фото сверху, текст под ним */
        st.left = '0'; st.right = '0'; st.width = 'auto';
        h = Math.min(H, pr.bottom - sr.top + 140); st.height = h + 'px';
        vm = pxMask('180deg', h, topT, topT + 120, h - 220, h); hm = 'linear-gradient(#000,#000)';
      } else {
        var left = pr.left + pr.width / 2 < sr.left + sr.width / 2, w = left ? pr.right - sr.left + 140 : sr.right - pr.left + 140;
        st.width = w + 'px'; st.left = left ? '0' : 'auto'; st.right = left ? 'auto' : '0';
        hm = pxMask(left ? '90deg' : '270deg', w, 0, 0, w * .62, w);
      }
      st.webkitMaskImage = st.maskImage = hm + ',' + vm;
      st.webkitMaskComposite = 'source-in'; st.maskComposite = 'intersect';
    });
  }
  if (bleeds.length) { layout(); addEventListener('load', layout); var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); }); }
})();
