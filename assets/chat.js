/* МЯУ — ассистент на сайте.
   Отвечает на вопросы (через MIAU.chatEndpoint → облачная функция → GigaChat),
   а запись и сертификат собирает сам, по шагам, и отправляет заявку в MIAU.endpoint
   (та же облачная функция пересылает её в Telegram). Ключей и токенов здесь нет и быть не должно.
   Без MIAU.chatEndpoint работает без нейросети: запись, сертификат и простые ответы. */
(function () {
  var D = document, MIAU = window.MIAU = window.MIAU || {};
  MIAU.chatEndpoint = MIAU.chatEndpoint || '';
  var DIRS = MIAU.DIRS || {}, SUMS = MIAU.SUMS || [5000, 10000, 15000, 20000];
  var money = MIAU.money || function (n) { return n + ' ₽'; };
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var btn, box, log, inp, form, open = false, history = [], flow = null, busy = false;

  /* ---------- оболочка ---------- */
  function mount() {
    btn = D.createElement('button');
    btn.type = 'button'; btn.className = 'ch-btn'; btn.setAttribute('aria-label', 'Ассистент МЯУ');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click', function () { toggle(true); });
    box = D.createElement('section');
    box.className = 'ch'; box.setAttribute('aria-label', 'Ассистент МЯУ'); box.hidden = true;
    box.innerHTML =
      '<header class="ch-hd"><p class="ch-ttl">Ассистент МЯУ</p><button type="button" class="ch-x" aria-label="Закрыть">×</button></header>' +
      '<div class="ch-log" role="log" aria-live="polite"></div>' +
      '<form class="ch-in"><textarea rows="1" name="q" placeholder="Напиши вопрос" maxlength="600" aria-label="Сообщение"></textarea>' +
      '<button type="submit" class="ch-send" aria-label="Отправить"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></form>' +
      '<p class="ch-note">Отвечает ИИ-ассистент. Время подтвердит администратор.</p>';
    D.body.appendChild(btn); D.body.appendChild(box);
    log = box.querySelector('.ch-log'); form = box.querySelector('.ch-in'); inp = form.querySelector('textarea');
    box.querySelector('.ch-x').addEventListener('click', function () { toggle(false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    inp.addEventListener('input', function () { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) toggle(false); });
    log.addEventListener('click', onChip);
  }
  function toggle(on) {
    open = on; box.hidden = !on; D.documentElement.classList.toggle('ch-open', on);
    if (on) {
      if (!log.children.length) hello();
      if (matchMedia('(min-width:641px)').matches) inp.focus();
    } else btn.focus();
  }
  function hello() {
    bot('Привет! Я ассистент МЯУ. Помогу выбрать направление, отвечу на вопросы и запишу тебя или оформлю сертификат.');
    chips([['book', 'Записаться'], ['cert', 'Подарить сертификат'], ['ask', 'Задать вопрос']], 'start');
  }

  /* ---------- сообщения ---------- */
  function add(cls, html) {
    var m = D.createElement('div'); m.className = 'ch-m ' + cls; m.innerHTML = html;
    log.appendChild(m); log.scrollTop = log.scrollHeight; return m;
  }
  function bot(t) { history.push({ role: 'assistant', content: t }); return add('ch-bot', esc(t).replace(/\n/g, '<br>')); }
  function me(t) { history.push({ role: 'user', content: t }); return add('ch-me', esc(t)); }
  function chips(list, key, multi) {
    var h = '<div class="chips ch-chips" data-key="' + key + '"' + (multi ? ' data-multi' : '') + '>' +
      list.map(function (x) { return '<button type="button" class="chip" aria-pressed="false" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
    if (multi) h += '<button type="button" class="btn btn-wine ch-ok" data-key="' + key + '">Дальше</button>';
    return add('ch-act', h);
  }
  function lock(wrap) { if (!wrap.querySelector('.ch-sum')) { wrap.remove(); return; } wrap.classList.add('used'); [].forEach.call(wrap.querySelectorAll('button'), function (b) { b.disabled = true; }); }
  function onChip(e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    var act = b.closest('.ch-act'); if (!act) return;
    if (b.classList.contains('ch-ok')) {
      var picked = [].filter.call(act.querySelectorAll('.chip[aria-pressed="true"]'), Boolean);
      lock(act); me(picked.length ? picked.map(function (p) { return p.textContent; }).join(', ') : 'Пропустить');
      return answer(b.dataset.key, picked.map(function (p) { return p.dataset.v; }));
    }
    if (!b.classList.contains('chip')) return;
    var grp = b.parentNode;
    if (grp.hasAttribute('data-multi')) { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
    b.setAttribute('aria-pressed', 'true'); lock(act); me(b.textContent);
    answer(grp.dataset.key, b.dataset.v);
  }

  /* ---------- сценарии: запись и сертификат ---------- */
  function days() {
    var out = [], d = new Date();
    for (var i = 0; i < 7; i++) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i); var v = x.getDate() + ' ' + MN[x.getMonth()] + ' (' + WD[x.getDay()] + ')'; out.push([v, v]); }
    return out.concat([['Любой', 'Любой день']]);
  }
  function services(dirs) {
    var out = [];
    dirs.forEach(function (d) { (DIRS[d] ? DIRS[d].items : []).forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); }); });
    return out;
  }
  function startBook(pre) {
    flow = { kind: 'book', v: {} }; pre = pre || {};
    if (pre.dir && pre.dir.length) { flow.v.dir = pre.dir; if (pre.svc && pre.svc.length) { flow.v.svc = pre.svc; return askDay(); } return askSvc(); }
    bot('Что хочется? Можно выбрать несколько направлений или пропустить — администратор подскажет.');
    chips(Object.keys(DIRS).map(function (k) { return [k, DIRS[k].name]; }), 'dir', true);
  }
  function askSvc() {
    var s = services(flow.v.dir || []);
    if (!s.length) return askDay();
    bot('Какие услуги?'); chips(s.map(function (x) { return [x, x]; }), 'svc', true);
  }
  function askDay() { bot('Какой день удобен?'); chips(days(), 'date'); }
  function askTime() { bot('А время?'); chips([['Утро, 10–13', 'Утро, 10–13'], ['День, 13–17', 'День, 13–17'], ['Вечер, 17–21', 'Вечер, 17–21'], ['own', 'Другое']], 'time'); }
  function startCert() {
    flow = { kind: 'cert', v: {} };
    bot('На какую сумму сертификат? Или можно на направление.');
    chips(SUMS.map(function (s) { return [String(s), money(s)]; }).concat([['own', 'Своя сумма'], ['dir', 'На направление']]), 'sum');
  }
  function askName() { flow.wait = 'name'; bot('Как к тебе обращаться?'); inp.placeholder = 'Имя'; }
  function askPhone() { flow.wait = 'phone'; bot('Телефон для связи?'); inp.placeholder = '+7 ___ ___-__-__'; inp.setAttribute('inputmode', 'tel'); }
  function askChannel() { bot('Как удобнее связаться?'); chips([['Позвонить', 'Позвонить'], ['Telegram', 'Telegram'], ['WhatsApp', 'WhatsApp']], 'channel'); }
  function askConsent() {
    var v = flow.v, rows = [];
    if (flow.kind === 'book') {
      rows = [['Направления', v.dir && v.dir.length ? v.dir.map(function (d) { return DIRS[d] ? DIRS[d].name : d; }).join(', ') : 'Подскажет администратор'],
        ['Услуги', v.svc && v.svc.length ? v.svc.join(', ') : '—'], ['День', v.date || 'Любой'], ['Время', v.time || 'Любое']];
    } else {
      rows = [['Сертификат', v.dir ? 'На направление ' + (DIRS[v.dir] ? DIRS[v.dir].name : v.dir) : (v.sum ? money(+v.sum) : '—')], ['Кому', v.to || '—']];
    }
    rows = rows.concat([['Имя', v.name], ['Телефон', v.phone], ['Связь', v.channel]]);
    add('ch-act', '<dl class="ch-sum">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1] || '—') + '</dd></div>'; }).join('') + '</dl>' +
      '<label class="ok-box ch-cs"><input type="checkbox" name="consent"><span>Даю <a href="dokumenty.html#soglasie" target="_blank">согласие на обработку персональных данных</a></span></label>' +
      '<div class="ch-row"><button type="button" class="btn btn-wine" data-send>Отправить заявку</button><button type="button" class="btn" data-redo>Заново</button></div>');
    var a = log.lastChild;
    a.querySelector('[data-redo]').addEventListener('click', function () { lock(a); var k = flow.kind; flow = null; k === 'book' ? startBook() : startCert(); });
    a.querySelector('[data-send]').addEventListener('click', function () {
      var cs = a.querySelector('[name=consent]');
      if (!cs.checked) { cs.closest('.ok-box').classList.add('err'); return; }
      lock(a); submit();
    });
    a.querySelector('[name=consent]').addEventListener('change', function (e) { e.target.closest('.ok-box').classList.remove('err'); });
  }
  function submit() {
    var v = flow.v, data = {};
    Object.keys(v).forEach(function (k) { data[k] = Array.isArray(v[k]) ? v[k].join(',') : v[k]; });
    if (flow.kind === 'cert' && /^\d+$/.test(data.sum || '')) data.sum = MIAU.money ? MIAU.money(+data.sum) : data.sum + ' ₽';
    var payload = { type: flow.kind, source: 'chat', data: data, consent: true, page: location.pathname, at: new Date().toISOString(),
      dialog: history.slice(-12).map(function (m) { return (m.role === 'user' ? 'Клиентка: ' : 'Бот: ') + m.content; }).join('\n') };
    var ep = MIAU.endpoint;
    var done = function (ok) {
      bot(ok ? 'Заявка у администратора. Она свяжется с тобой' + (v.channel && v.channel !== 'Позвонить' ? ' в ' + v.channel : ' по телефону') + ', чтобы подтвердить ' + (flow.kind === 'book' ? 'время.' : 'детали.')
        : 'Не получилось отправить. Попробуй ещё раз чуть позже или позвони нам — контакты на странице «Контакты».');
      flow = null; chips([['book', 'Ещё запись'], ['ask', 'Задать вопрос']], 'start');
    };
    if (!ep) { if (window.console) console.info('МЯУ: заявка из чата собрана, отправка не подключена (MIAU.endpoint пуст)', payload); return done(true); }
    fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { done(r.ok); }).catch(function () { done(false); });
  }
  function answer(key, val) {
    if (key === 'start') { if (val === 'book') return startBook(); if (val === 'cert') return startCert(); bot('Спрашивай: про направления, услуги, как к нам добраться.'); inp.focus(); return; }
    if (!flow) return;
    var v = flow.v;
    if (key === 'dir') { v.dir = val; return val.length ? askSvc() : askDay(); }
    if (key === 'svc') { v.svc = val; return askDay(); }
    if (key === 'date') { v.date = val; return askTime(); }
    if (key === 'time') { if (val === 'own') { flow.wait = 'time'; bot('Напиши удобное время, например 19:30 или после 20.'); inp.placeholder = 'Время'; return; } v.time = val; return askName(); }
    if (key === 'sum') {
      if (val === 'own') { flow.wait = 'sum'; bot('Напиши сумму от 1 000 ₽.'); inp.placeholder = 'Сумма, ₽'; inp.setAttribute('inputmode', 'numeric'); return; }
      if (val === 'dir') { bot('На какое направление?'); chips(Object.keys(DIRS).map(function (k) { return [k, DIRS[k].name]; }), 'certdir'); return; }
      v.sum = val; flow.wait = 'to'; bot('Кому сертификат? Имя для открытки.'); inp.placeholder = 'Имя получательницы'; return;
    }
    if (key === 'certdir') { v.dir = val; flow.wait = 'to'; bot('Кому сертификат? Имя для открытки.'); inp.placeholder = 'Имя получательницы'; return; }
    if (key === 'channel') { v.channel = val; return askConsent(); }
  }
  function typed(t) {
    var w = flow.wait; flow.wait = null; inp.placeholder = 'Напиши вопрос'; inp.removeAttribute('inputmode');
    var v = flow.v;
    if (w === 'time') { v.time = t; return askName(); }
    if (w === 'sum') { var n = +t.replace(/[^\d]/g, ''); if (!n || n < 1000) { flow.wait = 'sum'; inp.setAttribute('inputmode', 'numeric'); return bot('Нужна сумма от 1 000 ₽.'); } v.sum = String(n); flow.wait = 'to'; bot('Кому сертификат? Имя для открытки.'); inp.placeholder = 'Имя получательницы'; return; }
    if (w === 'to') { v.to = t.slice(0, 28); return askName(); }
    if (w === 'name') { v.name = t.slice(0, 40); return askPhone(); }
    if (w === 'phone') {
      var d = t.replace(/\D/g, ''); if (d.length === 10) d = '7' + d; if (d[0] === '8') d = '7' + d.slice(1);
      if (d.length !== 11) { flow.wait = 'phone'; inp.placeholder = '+7 ___ ___-__-__'; inp.setAttribute('inputmode', 'tel'); return bot('Кажется, в номере не хватает цифр. Напиши его целиком.'); }
      v.phone = '+' + d[0] + ' ' + d.slice(1, 4) + ' ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9); return askChannel();
    }
  }

  /* ---------- свободный текст ---------- */
  function send() {
    var t = inp.value.trim(); if (!t || busy) return;
    inp.value = ''; inp.style.height = 'auto'; me(t);
    if (flow && flow.wait) return typed(t);
    ask(t);
  }
  /* текст, набранный в английской раскладке: «rfr dfc pjden» → «как вас зовут» */
  var EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  /* русский, набранный в английской раскладке («ghbdtn» → «привет»). Настоящий английский не трогаем:
     в нём есть частые слова и гласные, а в «перевёрнутом» русском слова почти без гласных или со знаками ;[],.' внутри */
  var EN_WORDS = /^(a|an|the|is|are|am|do|does|did|you|your|i|i'm|im|my|me|we|it|it's|how|what|where|when|why|who|which|can|could|would|should|will|to|for|of|in|on|at|and|or|not|no|yes|hi|hello|hey|please|thanks|thank|price|prices|cost|much|many|book|booking|massage|yoga|nails|manicure|pedicure|makeup|open|hours|address|gift|card|certificate|english|speak|need|want|have|has|there|this|that|with|about|ok|okay)$/i;
  var BI = ' th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur ag ge oo ow ok ho wh ly ca us ut ut ir ss ee el et la lo ot no mu uc ki ke ye yo pr ri ic ce ga ty ' ;
  function looksEnglish(t) {
    var w = t.toLowerCase().match(/[a-z'\[\];,.`]+/g) || [];
    if (!w.length) return false;
    if (w.some(function (x) { return EN_WORDS.test(x.replace(/[.,]+$/, '')); })) return true;
    var odd = w.filter(function (x) { return !/[aeiouy]/.test(x) || /[a-z][\[\];',.`][a-z]/.test(x); }).length;
    if (odd / w.length >= .5) return false;
    /* доля частых английских сочетаний букв: в английском их много, в «перевёрнутом» русском почти нет */
    var L = t.toLowerCase().replace(/[^a-z]+/g, ' '), n = 0, hit = 0;
    for (var i = 0; i < L.length - 1; i++) { var g = L.substr(i, 2); if (g.indexOf(' ') > -1) continue; n++; if (BI.indexOf(' ' + g + ' ') > -1) hit++; }
    return !n || hit / n >= .28;
  }
  function layout(t) {
    if (/[а-яё]/i.test(t) || !/[a-z]/i.test(t) || looksEnglish(t)) return t;
    return t.replace(/[a-z\[\];',.`]/gi, function (c) { var i = EN.indexOf(c.toLowerCase()); return i < 0 ? c : RU[i]; });
  }
  /* короткие описания услуг — те же, что на страницах направлений */
  var ABOUT = {
    'Йога': 'Йога — позы, дыхание и концентрация. Начать можно с любым опытом.',
    'Массаж': 'Массаж — мастер прорабатывает мышцы спины, шеи и плеч. Около часа.',
    'Массажные практики': 'Массажные практики — медленный массаж-ритуал с тёплым маслом и свечами.',
    'Силовая йога': 'Силовая йога — динамичная практика: позы идут одна за другой в ритме дыхания.',
    'Саундхилинг': 'Саундхилинг — звуковая медитация: ты лежишь, ведущий играет на поющих чашах.',
    'Маникюр': 'Маникюр — уход за ногтями и кожей рук: кутикула, форма, покрытие.',
    'Педикюр': 'Педикюр — уход за стопами и ногтями на ногах.',
    'Макияж': 'Макияж — под событие или просто потому, что хочется.',
    'Лекции': 'Лекции — встречи с экспертами о здоровье, психологии, отношениях и самопознании.',
    'Комьюнити и ретриты': 'Ретриты — совместные занятия и выезды, в том числе банные.',
    'Кундалини-практики': 'Кундалини — дыхание, повторяющиеся движения, звук и медитация.'
  };
  var ADMIN = 'Это подскажет администратор: напиши в Telegram или WhatsApp, контакты на странице «Контакты».';
  function match(s) {
    var list = Object.keys(ABOUT).filter(function (n) { return s.indexOf(n.toLowerCase().slice(0, 5)) > -1; });
    if (/силов/.test(s)) list = list.filter(function (n) { return n !== 'Йога'; });
    if (/практик/.test(s) && list.indexOf('Массажные практики') > -1) list = list.filter(function (n) { return n !== 'Массаж'; });
    var d = Object.keys(DIRS).filter(function (k) { return DIRS[k].items.some(function (i) { return list.indexOf(i) > -1; }); });
    return { list: list, d: d, svc: list.filter(function (n) { return d.some(function (k) { return DIRS[k].items.indexOf(n) > -1; }); }) };
  }
  function local(t) {
    var s = layout(t).toLowerCase();
    if (/^(привет|здравств|добр(ый|ое|ого)|хай|hello|hi)\b/.test(s)) return { reply: 'Привет! Хочешь записаться, подобрать направление или подарить сертификат?' };
    if (/как (тебя|вас) зовут|кто ты|ты бот|ты человек/.test(s)) return { reply: 'Я ассистент МЯУ, онлайн-помощник сайта. Записываю, помогаю выбрать направление и оформить сертификат. На сложные вопросы ответит администратор.' };
    if (/как (ты|дела|жизнь)|как поживаешь/.test(s)) return { reply: 'Всё хорошо, спасибо! Чем помочь: подобрать направление, записать или рассказать про сертификат?' };
    if (/спасиб/.test(s)) return { reply: 'Пожалуйста! Если что-то ещё — пиши.' };
    var m = match(s);
    if (/запис|записа|хочу на|свобод|окошк/.test(s)) return { action: 'book', dir: m.d, svc: m.svc };
    if (/сертиф|подар/.test(s)) return { action: 'cert' };
    if (/адрес|где вы|где наход|добрат|метро|наход/.test(s)) return { reply: 'Мы на Фрунзенской набережной, 46. Карта и как пройти — на странице «Контакты».' };
    if (/сколько (стоит|длит|идёт|идет|по времени)|цен|стоимост|прайс|длительн|сколько времени|сколько час|сколько минут/.test(s)) return { reply: 'Цены и длительность сейчас уточняем. ' + ADMIN + ' А записаться можешь прямо здесь — администратор всё расскажет при подтверждении.' };
    if (/врем|часы|график|работаете|открыт/.test(s)) return { reply: 'Часы работы уточнит администратор. ' + ADMIN };
    if (m.list.length) return { reply: m.list.map(function (n) { return ABOUT[n]; }).join('\n'), action: 'book', dir: m.d, svc: m.svc };
    var hit = Object.keys(DIRS).filter(function (k) { return DIRS[k].name.toLowerCase().split(' ').some(function (w) { return s.indexOf(w.slice(0, 5)) > -1; }); });
    if (hit.length) return { reply: hit.map(function (k) { return DIRS[k].name + ': ' + DIRS[k].items.join(', '); }).join('\n'), action: 'book', dir: hit };
    return { reply: 'Пока я умею записывать, рассказывать о направлениях и оформлять сертификат. С остальным поможет администратор — контакты на странице «Контакты».' };
  }
  function act(r) {
    if (r.reply) bot(r.reply);
    if (r.action === 'book') {
      if (r.reply) { chips([['go', 'Записаться']], 'gobook'); flow = { kind: 'pre', pre: { dir: r.dir || [], svc: r.svc || [] } }; return; }
      return startBook({ dir: r.dir, svc: r.svc });
    }
    if (r.action === 'cert') return startCert();
  }
  var _answer = answer;
  answer = function (key, val) { if (key === 'gobook') { var p = flow && flow.pre; flow = null; return startBook(p); } return _answer(key, val); };
  function ask(t) {
    t = layout(t); /* «rfr dfc pjden» → «как вас зовут», и для нейросети тоже */
    if (!MIAU.chatEndpoint) return act(local(t));
    busy = true; var w = add('ch-bot ch-wait', '<i></i><i></i><i></i>');
    fetch(MIAU.chatEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12).map(function (m) { return { role: m.role, content: m.content.replace(/\+?\d[\d\s()-]{8,}\d/g, '[телефон]') }; }) }) })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (r) { w.remove(); act(r || {}); })
      .catch(function () { w.remove(); act(local(t)); })
      .then(function () { busy = false; });
  }

  /* не мешаем панели записи */
  new MutationObserver(function () { if (btn) btn.hidden = D.documentElement.classList.contains('bk-open'); })
    .observe(D.documentElement, { attributes: true, attributeFilter: ['class'] });

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', mount); else mount();
  MIAU.chat = { open: function () { toggle(true); } };
})();
