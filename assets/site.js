/* MIAU — общий скрипт сайта: видео, плавная прокрутка, анимации, меню */
(function () {
  var D = document, H = D.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fx = H.classList.contains('js-fx');

  /* 1. Видео первого экрана: без звука, по кругу; при «уменьшить движение» — стоп-кадр */
  D.querySelectorAll('video').forEach(function (v) {
    v.muted = true;
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); return; }
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () {});
  });

  /* 2. Мобильное меню: закрыть по Escape и после выбора пункта */
  var menu = D.querySelector('.nav-mob');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { menu.open = false; }); });
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }

  /* Карта: заслонка не даёт карте перехватывать прокрутку, пока по ней не нажали */
  D.querySelectorAll('.map-cover').forEach(function (b) {
    b.addEventListener('click', function () { b.parentNode.classList.add('live'); });
  });

  if (!fx) return;

  /* 3. Плавная прокрутка (Lenis): только колесо мыши, на телефоне — родной скролл */
  if (window.Lenis) {
    var lenis = new Lenis({ lerp: 0.09, anchors: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    if (menu) menu.addEventListener('toggle', function () { menu.open ? lenis.stop() : lenis.start(); });
  }

  /* 4. Заголовки делим на слова (только если внутри чистый текст) */
  D.querySelectorAll('.h1, .d1, .h2.rv').forEach(function (el) {
    if (el.children.length || el.classList.contains('focus-words') || el.hasAttribute('data-word')) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var m = D.createElement('span'), s = D.createElement('span');
      m.className = 'wm'; s.className = 'wi'; s.textContent = w; s.style.setProperty('--i', i);
      m.appendChild(s); el.appendChild(m); el.appendChild(D.createTextNode(' '));
    });
    el.classList.add('split');
  });

  /* слова цитаты — для проявления из размытия */
  D.querySelectorAll('.focus-words').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = D.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i); s.textContent = w;
      el.appendChild(s); el.appendChild(D.createTextNode(' '));
    });
    el.style.setProperty('--n', words.length);
  });

  /* порядковые номера детей в группах карточек */
  D.querySelectorAll('.stg').forEach(function (g) {
    [].forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
  });

  /* 5. Первый экран: заголовок выезжает сразу (или после интро-логотипа) */
  var heroDelay = H.classList.contains('has-intro') ? 2500 : 150;
  var firstTitle = D.querySelector('.d1.split, section:first-of-type .h1.split, main > section:first-child .h1.split');
  if (firstTitle) setTimeout(function () { firstTitle.classList.add('in'); }, heroDelay);

  /* 6. Появление при прокрутке (один раз) */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  D.querySelectorAll('.split, .zoom, .stg, .draw, .fade').forEach(function (el) {
    if (el !== firstTitle) io.observe(el);
  });

  /* 7. Прогресс прокрутки --p (0..1) для [data-scroll]:
     pin  — высокая секция со sticky-сценой: 0 когда секция у верха экрана, 1 когда сцена отпускается
     pass — обычный блок: 0 когда появился снизу, 1 когда ушёл вверх */
  var els = [].slice.call(D.querySelectorAll('[data-scroll]')), queued = false;
  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function run() {
    queued = false;
    var vh = innerHeight;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var p = el.dataset.scroll === 'pin'
        ? clamp(-r.top / Math.max(1, el.offsetHeight - vh))
        : clamp((vh - r.top) / (vh + r.height));
      if (el._p !== p) { el._p = p; el.style.setProperty('--p', p.toFixed(4)); }
    });
  }
  function req() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  run();
})();
