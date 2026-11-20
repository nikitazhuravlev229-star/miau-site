/* MIAU — интерактив: панель записи и сертификата, направления, лента, сертификат, карта */
(function () {
  var D = document;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIAU = window.MIAU = window.MIAU || {};
  /* Куда отправлять заявки. Пока пусто: заявка собирается, но никуда не уходит.
     Подключить: MIAU.endpoint = 'https://…' (Telegram-бот, CRM, Formspree) — придёт POST с JSON. */
  MIAU.endpoint = MIAU.endpoint || '';

  var DIRS = {
    body: { name: 'BODY · Тело', items: ['Йога', 'Массаж', 'Массажные практики'] },
    energy: { name: 'ENERGY · Энергия', items: ['Силовая йога', 'Саундхилинг'] },
    beauty: { name: 'BEAUTY · Красота', items: ['Маникюр', 'Педикюр', 'Макияж'] },
    connection: { name: 'CONNECTION · Связь', items: ['Лекции'] },
    soul: { name: 'SOUL · Душа', items: ['Кундалини-практики'] }
  };
  var SUMS = [5000, 10000, 15000, 20000];
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function el(html) { var t = D.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function certHTML(cls) {
    return '<div class="cert ' + (cls || '') + '"><div class="cert-l"><img class="cert-em" src="assets/emblem-cream.webp" alt=""></div><span class="cert-div"></span><div class="cert-r"><span class="cert-k">ПОДАРОЧНЫЙ СЕРТИФИКАТ</span><span class="cert-sum" data-c-sum>10\u00a0000\u00a0₽</span><span class="cert-line"><em>для</em><i data-c-for></i></span><span class="cert-foot"><span>№ 0001</span><span>время для себя</span></span></div></div>';
  }
  MIAU.certHTML = certHTML;

  /* ================= панель (drawer) ================= */
  var ov, bk, state, lenisWasRunning;
  function chips(name, list, multi) {
    return '<div class="chips" data-name="' + name + '"' + (multi ? ' data-multi' : '') + '>' + list.map(function (x) {
      var v = typeof x === 'object' ? x[0] : x, l = typeof x === 'object' ? x[1] : x;
      return '<button type="button" class="chip" aria-pressed="false" data-v="' + esc(v) + '">' + l + '</button>';
    }).join('') + '</div>';
  }
  function dates() {
    var out = [], wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], mn = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var d = new Date();
    for (var i = 0; i < 14; i++) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      var label = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : wd[x.getDay()];
      out.push('<button type="button" class="chip bk-date" aria-pressed="false" data-v="' + x.getDate() + ' ' + mn[x.getMonth()] + ' (' + label + ')"><small>' + label + '</small><b>' + x.getDate() + '</b><small>' + mn[x.getMonth()] + '</small></button>');
    }
    return '<div class="chips bk-dates" data-name="date">' + out.join('') + '</div>';
  }
  var contactStep =
    '<div class="bk-step" data-step="contacts"><p class="bk-q">Как с тобой связаться</p>' +
    '<label class="fld"><span class="bk-l">Имя</span><input name="name" autocomplete="given-name" required><span class="msg"></span></label>' +
    '<label class="fld"><span class="bk-l">Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___-__-__" required><span class="msg"></span></label>' +
    '<div><p class="bk-l">Удобнее</p>' + chips('channel', ['Позвонить', 'Telegram', 'WhatsApp']) + '</div>' +
    '<label class="fld"><span class="bk-l">Комментарий</span><textarea name="comment" rows="3" placeholder="Пожелания, вопросы"></textarea></label>' +
    '<label class="ok-box"><input type="checkbox" name="consent"><span>Даю <a href="dokumenty.html#soglasie" target="_blank">согласие на обработку персональных данных</a></span></label>' +
    '</div>';

  var FLOWS = {
    book: {
      title: 'Запись в MIAU',
      steps: [
        '<div class="bk-step" data-step="what"><p class="bk-q">Что хочется?</p><div><p class="bk-l">Направление</p>' +
        chips('dir', Object.keys(DIRS).map(function (k) { return [k, DIRS[k].name]; })) + '</div><div data-svc hidden><p class="bk-l">Услуга</p><div data-svc-list></div></div>' +
        '<p class="body" style="opacity:.7">Не знаешь, что выбрать? Пропусти — администратор подскажет.</p></div>',
        '<div class="bk-step" data-step="when"><p class="bk-q">Когда удобно?</p><div><p class="bk-l">День</p>' + dates() + '</div>' +
        '<div><p class="bk-l">Время</p>' + chips('time', ['Утро, 10–13', 'День, 13–17', 'Вечер, 17–21']) + '</div>' +
        '<div><p class="bk-l">Специалист</p>' + chips('master', ['Любой свободный', 'Уже знаю, к кому — напишу в комментарии']) + '</div></div>',
        contactStep
      ],
      done: 'Администратор свяжется с тобой, чтобы подтвердить время.'
    },
    cert: {
      title: 'Подарочный сертификат',
      steps: [
        '<div class="bk-step" data-step="sum"><div class="bk-preview">' + certHTML() + '</div><div><p class="bk-l">Номинал</p>' +
        chips('sum', SUMS.map(function (s) { return [String(s), money(s)]; }).concat([['own', 'Своя сумма']])) + '</div>' +
        '<label class="fld" data-own hidden><span class="bk-l">Своя сумма, ₽</span><input name="own" inputmode="numeric" placeholder="Например, 12 000"><span class="msg"></span></label>' +
        '<div><p class="bk-l">Или на направление</p>' + chips('dir', Object.keys(DIRS).map(function (k) { return [k, DIRS[k].name.split(' · ')[1]]; })) + '</div></div>',
        '<div class="bk-step" data-step="who"><div class="bk-preview">' + certHTML() + '</div><p class="bk-q">Кому и от кого</p>' +
        '<label class="fld"><span class="bk-l">Имя на сертификате</span><input name="to" placeholder="Например, Анне" maxlength="28"></label>' +
        '<label class="fld"><span class="bk-l">От кого</span><input name="from" maxlength="40"></label>' +
        '<label class="fld"><span class="bk-l">Пожелание</span><textarea name="wish" rows="2" maxlength="140" placeholder="Пара тёплых слов — впишем от руки"></textarea></label>' +
        '<div><p class="bk-l">Как получить</p>' + chips('get', ['Заберу на Фрунзенской, 46', 'Электронный — в мессенджер']) + '</div></div>',
        contactStep
      ],
      done: 'Администратор свяжется с тобой, чтобы подтвердить сертификат и оплату.'
    }
  };

  function build(kind, preset) {
    close(true);
    var F = FLOWS[kind];
    ov = el('<div class="bk-ov"></div>');
    bk = el('<aside class="bk" role="dialog" aria-modal="true" aria-label="' + F.title + '" data-lenis-prevent>' +
      '<div class="bk-hd"><p class="bk-ttl">' + F.title + '</p><button type="button" class="bk-x" aria-label="Закрыть">×</button></div>' +
      '<div class="bk-steps">' + F.steps.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<form class="bk-bd" novalidate>' + F.steps.join('') +
      '<div class="bk-done"><img src="assets/emblem-wine.webp" alt=""><p class="bk-q">Заявка у нас</p><p class="body">' + F.done + '</p><dl class="bk-sum" data-sum></dl></div></form>' +
      '<div class="bk-ft"><button type="button" class="bk-back">← Назад</button><button type="button" class="btn btn-wine bk-next">Дальше</button></div></aside>');
    D.body.appendChild(ov); D.body.appendChild(bk);
    state = { kind: kind, i: 0, v: {} };
    var form = bk.querySelector('form');

    form.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var g = c.parentNode, name = g.dataset.name;
      [].forEach.call(g.children, function (x) { if (x !== c) x.setAttribute('aria-pressed', 'false'); });
      var on = c.getAttribute('aria-pressed') !== 'true';
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      state.v[name] = on ? c.dataset.v : '';
      if (name === 'dir' && kind === 'book') svc(state.v.dir);
      if (kind === 'cert') {
        if (name === 'sum') { state.v.dir = ''; clearGroup('dir'); }
        if (name === 'dir' && on) { state.v.sum = ''; clearGroup('sum'); }
        bk.querySelector('[data-own]').hidden = state.v.sum !== 'own';
        preview();
      }
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.name === 'phone') t.value = phoneMask(t.value);
      if (t.name === 'own') t.value = t.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      state.v[t.name] = t.value;
      t.closest('.fld') && t.closest('.fld').classList.remove('err');
      if (kind === 'cert') preview();
    });
    form.addEventListener('change', function (e) { if (e.target.name === 'consent') { state.v.consent = e.target.checked; e.target.closest('.ok-box').classList.remove('err'); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); next(); });
    bk.querySelector('.bk-x').addEventListener('click', function () { close(); });
    ov.addEventListener('click', function () { close(); });
    bk.querySelector('.bk-next').addEventListener('click', next);
    bk.querySelector('.bk-back').addEventListener('click', function () { go(state.i - 1); });

    /* предустановки из кнопки */
    if (preset) Object.keys(preset).forEach(function (k) {
      var b = form.querySelector('.chips[data-name="' + k + '"] .chip[data-v="' + preset[k] + '"]');
      if (b) b.click();
    });
    if (kind === 'cert' && !state.v.sum && !state.v.dir) { var d0 = form.querySelector('.chips[data-name="sum"] .chip[data-v="10000"]'); d0 && d0.click(); }

    go(0);
    requestAnimationFrame(function () { requestAnimationFrame(function () { D.documentElement.classList.add('bk-open'); }); });
    if (MIAU.lenis) MIAU.lenis.stop();
    D.body.style.overflow = 'hidden';
    setTimeout(function () { var f = bk.querySelector('.bk-step.cur .chip, .bk-step.cur input'); f && f.focus({ preventScroll: true }); }, 500);
  }
  function clearGroup(n) { [].forEach.call(bk.querySelectorAll('.chips[data-name="' + n + '"] .chip'), function (x) { x.setAttribute('aria-pressed', 'false'); }); }
  function svc(dir) {
    var box = bk.querySelector('[data-svc]'), list = bk.querySelector('[data-svc-list]');
    state.v.svc = '';
    if (!dir) { box.hidden = true; return; }
    list.innerHTML = chips('svc', DIRS[dir].items);
    box.hidden = false;
  }
  function phoneMask(v) {
    var d = v.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
    var r = '+7'; if (d.length > 1) r += ' ' + d.slice(1, 4); if (d.length > 4) r += ' ' + d.slice(4, 7); if (d.length > 7) r += '-' + d.slice(7, 9); if (d.length > 9) r += '-' + d.slice(9, 11);
    return r;
  }
  function preview() {
    var sum = state.v.sum === 'own' ? (state.v.own ? state.v.own.replace(/\s/g, '') : '') : state.v.sum;
    var txt = state.v.dir ? DIRS[state.v.dir].name.split(' · ')[1].toUpperCase() : (sum ? money(+sum) : '— ₽');
    [].forEach.call(bk.querySelectorAll('[data-c-sum]'), function (x) { x.textContent = txt; x.style.fontSize = state.v.dir ? '5cqw' : ''; });
    [].forEach.call(bk.querySelectorAll('[data-c-for]'), function (x) { x.textContent = state.v.to || ''; });
  }
  function go(i) {
    var steps = bk.querySelectorAll('.bk-step');
    state.i = Math.max(0, Math.min(i, steps.length - 1));
    [].forEach.call(steps, function (s, k) { s.classList.toggle('cur', k === state.i); });
    [].forEach.call(bk.querySelectorAll('.bk-steps i'), function (s, k) { s.classList.toggle('done', k <= state.i); });
    bk.querySelector('.bk-back').style.visibility = state.i ? 'visible' : 'hidden';
    bk.querySelector('.bk-next').textContent = state.i === steps.length - 1 ? 'Отправить заявку' : 'Дальше';
    bk.querySelector('.bk-bd').scrollTop = 0;
  }
  function valid() {
    var step = bk.querySelectorAll('.bk-step')[state.i], ok = true;
    if (step.dataset.step === 'sum' && state.v.sum === 'own') {
      var n = +(state.v.own || '').replace(/\s/g, ''), f = step.querySelector('[data-own]');
      if (!n || n < 1000) { f.classList.add('err'); f.querySelector('.msg').textContent = 'Укажи сумму от 1 000 ₽'; ok = false; }
    }
    if (step.dataset.step === 'contacts') {
      var nm = step.querySelector('[name=name]'), ph = step.querySelector('[name=phone]'), cs = step.querySelector('[name=consent]');
      if (!nm.value.trim()) { mark(nm, 'Как к тебе обращаться?'); ok = false; }
      if (ph.value.replace(/\D/g, '').length !== 11) { mark(ph, 'Нужен номер целиком'); ok = false; }
      if (!cs.checked) { cs.closest('.ok-box').classList.add('err'); ok = false; }
    }
    return ok;
  }
  function mark(inp, m) { var f = inp.closest('.fld'); f.classList.add('err'); f.querySelector('.msg').textContent = m; }
  function next() {
    if (!valid()) return;
    var n = bk.querySelectorAll('.bk-step').length;
    if (state.i < n - 1) return go(state.i + 1);
    submit();
  }
  function submit() {
    var v = state.v, rows = [];
    if (state.kind === 'book') {
      rows = [['Направление', v.dir ? DIRS[v.dir].name : 'Подскажет администратор'], ['Услуга', v.svc || '—'], ['День', v.date || 'Любой'], ['Время', v.time || 'Любое'], ['Специалист', v.master || 'Любой']];
    } else {
      var sum = v.sum === 'own' ? (v.own || '') + ' ₽' : v.sum ? money(+v.sum) : '';
      rows = [['Сертификат', v.dir ? 'На направление ' + DIRS[v.dir].name : sum], ['Кому', v.to || '—'], ['От кого', v.from || '—'], ['Получение', v.get || 'Уточним']];
    }
    rows = rows.concat([['Имя', v.name], ['Телефон', v.phone], ['Связь', v.channel || 'Позвонить']]);
    bk.querySelector('[data-sum]').innerHTML = rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1] || '—') + '</dd></div>'; }).join('');
    [].forEach.call(bk.querySelectorAll('.bk-step'), function (s) { s.classList.remove('cur'); });
    bk.querySelector('.bk-done').classList.add('cur');
    bk.querySelector('.bk-steps').style.visibility = 'hidden';
    bk.querySelector('.bk-back').style.visibility = 'hidden';
    var nb = bk.querySelector('.bk-next'); nb.textContent = 'Готово'; nb.onclick = function (e) { e.stopImmediatePropagation(); close(); };
    var payload = { type: state.kind, data: v, page: location.pathname, at: new Date().toISOString() };
    delete payload.data.consent; payload.consent = true;
    if (MIAU.endpoint) { try { fetch(MIAU.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) {} }
    else if (window.console) console.info('MIAU: заявка собрана, но отправка не подключена (MIAU.endpoint пуст)', payload);
  }
  function close(instant) {
    if (!bk) return;
    var a = ov, b = bk; ov = bk = null;
    D.documentElement.classList.remove('bk-open');
    D.body.style.overflow = '';
    if (MIAU.lenis) MIAU.lenis.start();
    setTimeout(function () { a.remove(); b.remove(); }, instant ? 0 : 700);
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && bk) close(); });
  D.addEventListener('click', function (e) {
    var a = e.target.closest('[data-book],[data-cert]'); if (!a) return;
    e.preventDefault();
    var p = {};
    if (a.dataset.dir) p.dir = a.dataset.dir;
    if (a.dataset.svc) p.svc = a.dataset.svc;
    if (a.dataset.sum) p.sum = a.dataset.sum;
    build(a.hasAttribute('data-cert') ? 'cert' : 'book', p);
  });

  /* ================= направления: панели ================= */
  [].forEach.call(D.querySelectorAll('.dpanels'), function (wrap) {
    var ps = wrap.querySelectorAll('.dp');
    function on(p) { [].forEach.call(ps, function (x) { x.classList.toggle('on', x === p); x.setAttribute('aria-expanded', x === p ? 'true' : 'false'); }); }
    [].forEach.call(ps, function (p) {
      p.addEventListener('mouseenter', function () { if (matchMedia('(hover:hover) and (min-width:761px)').matches) on(p); });
      p.addEventListener('click', function (e) { if (!e.target.closest('a,button')) on(p); });
      p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on(p); } });
    });
  });

  /* ================= лента ================= */
  [].forEach.call(D.querySelectorAll('[data-rail]'), function (box) {
    var r = box.querySelector('.rail'), bar = box.querySelector('.rail-bar i'), prev = box.querySelector('[data-prev]'), nxt = box.querySelector('[data-next]');
    function step() { var c = r.querySelector('.rc'); return c ? c.offsetWidth + 16 : 300; }
    function upd() {
      var max = r.scrollWidth - r.clientWidth, k = max > 0 ? r.scrollLeft / max : 0;
      if (bar) { var w = Math.max(.12, r.clientWidth / r.scrollWidth); bar.style.width = (w * 100) + '%'; bar.style.transform = 'translateX(' + (k * (1 / w - 1) * 100) + '%)'; }
      if (prev) prev.disabled = r.scrollLeft < 4; if (nxt) nxt.disabled = r.scrollLeft > max - 4;
    }
    prev && prev.addEventListener('click', function () { r.scrollBy({ left: -step(), behavior: 'smooth' }); });
    nxt && nxt.addEventListener('click', function () { r.scrollBy({ left: step(), behavior: 'smooth' }); });
    r.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    /* перетаскивание мышью */
    var down = false, sx = 0, sl = 0, moved = 0;
    r.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = r.scrollLeft; });
    addEventListener('pointermove', function (e) { if (!down) return; var d = e.clientX - sx; moved = Math.abs(d); if (moved > 5) r.classList.add('drag'); r.scrollLeft = sl - d; });
    addEventListener('pointerup', function () { if (!down) return; down = false; setTimeout(function () { r.classList.remove('drag'); }, 0); });
    r.addEventListener('click', function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ================= сертификат на главной: суммы + наклон ================= */
  [].forEach.call(D.querySelectorAll('[data-cert-live]'), function (box) {
    var sumEl = box.querySelector('[data-c-sum]'), btn = box.querySelector('[data-cert]');
    box.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      [].forEach.call(c.parentNode.children, function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      var v = c.dataset.v;
      sumEl.textContent = v === 'own' ? 'Своя сумма' : money(+v);
      sumEl.style.fontSize = v === 'own' ? '5.2cqw' : '';
      if (btn) btn.dataset.sum = v;
    });
  });

  /* ================= карта (Leaflet + OpenStreetMap, без рекламы) ================= */
  var maps = D.querySelectorAll('.mapx');
  if (maps.length) {
    var LL = [55.718375, 37.581325];
    var init = function (box) {
      if (box._m || !window.L) return; box._m = 1;
      var m = L.map(box, { center: LL, zoom: 16, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, zoomControl: true, attributionControl: true });
      m.zoomControl.setPosition('bottomright');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
      m.attributionControl.setPrefix(false);
      L.marker(LL, { icon: L.divIcon({ className: '', html: '<div class="pin"><i></i><b>MIAU</b></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }).addTo(m);
      if (L.Browser.mobile) m.panBy([60, 0], { animate: false });
    };
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { init(e.target); io.unobserve(e.target); } }); }, { rootMargin: '300px' });
    [].forEach.call(maps, function (b) { io.observe(b); });
  }
})();
