/* MIAU — общий скрипт сайта */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Видео первого экрана: без звука, по кругу; при «уменьшить движение» — стоп-кадр */
  document.querySelectorAll('video').forEach(function (v) {
    v.muted = true;
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); return; }
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () {});
  });

  /* 2. Сцена (страница удалена, код не мешает) «Руки. Масло. Свечи.» на странице «Второй этаж» */
  var scene = document.querySelector('[data-scene]');
  if (scene) {
    var frames = scene.querySelectorAll('.fr');
    var word = scene.querySelector('[data-word]');
    var line = scene.querySelector('[data-line]');
    var words = ['Руки.', 'Масло.', 'Свечи.'];
    var lines = ['Закрываешь дверь кабинета. Телефон остаётся снаружи.', 'Тёплое масло и уверенные руки мастера.', 'Свечи, тишина и час, который никто не отнимет.'];
    var cur = -1;
    var onScroll = function () {
      var r = scene.getBoundingClientRect();
      var span = Math.max(1, r.height - window.innerHeight);
      var p = Math.min(1, Math.max(0, -r.top / span));
      var i = Math.min(2, Math.floor(p * 3));
      if (i === cur) return;
      cur = i;
      frames.forEach(function (f, k) { f.style.opacity = k === i ? 1 : 0; });
      if (word) word.textContent = words[i];
      if (line) line.textContent = lines[i];
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 3. Появление блоков при скролле, если браузер не умеет animation-timeline */
  var supports = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  if (!supports && !reduce && 'IntersectionObserver' in window) {
    var st = document.createElement('style');
    st.textContent = '.io .rv{opacity:0;transform:translateY(40px);transition:opacity .9s cubic-bezier(.33,1,.68,1),transform .9s cubic-bezier(.33,1,.68,1)}' +
      '.io .zoom{clip-path:inset(16% 0 0 0);transition:clip-path 1.1s cubic-bezier(.33,1,.68,1)}' +
      '.io .in{opacity:1 !important;transform:none !important;clip-path:inset(0 0 0 0) !important}';
    document.head.appendChild(st);
    document.documentElement.classList.add('io');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.rv, .zoom').forEach(function (el) { io.observe(el); });
  }

  /* 4. Мобильное меню: закрыть по Escape и после выбора пункта */
  var menu = document.querySelector('.nav-mob');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { menu.open = false; }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }
})();
