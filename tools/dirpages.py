import re, json, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
BASE = 'https://nikitazhuravlev229-star.github.io/miau-site/'
tpl = open('napravleniya.html', encoding='utf-8').read()
head, rest = tpl.split('<main>', 1)
foot = rest.split('</main>', 1)[1]

D = [
 dict(slug='body', key='BODY', ru='Тело', motto='Тело и чувственность', photo='massage-back',
      lead='Йога и массаж, после которых тело снова слушается.',
      svc=[
       ('Йога', 'yoga-mat', 'Практика из Индии, которой несколько тысяч лет: позы (асаны), дыхание и концентрация. Работает с телом и головой одновременно, начать можно с любым опытом.',
        ['Подвижность и гибкость суставов', 'Ровная спина и осанка', 'Спокойное дыхание и меньше напряжения']),
       ('Массаж', 'massage-back', 'Мастер руками прорабатывает мышцы спины, шеи и плеч. Час, после которого плечи опускаются, а дыхание выравнивается.',
        ['Снимает напряжение после сидячей работы', 'Помогает расслабиться и восстановиться', 'Возвращает ощущение собственного тела']),
       ('Массажные практики', 'massage-oil', 'Медленный массаж-ритуал с тёплым маслом и свечами. Здесь важна не техника, а состояние: замедлиться и побыть с собой.',
        ['Глубокое расслабление', 'Чувственность и контакт с телом', 'Время, когда никуда не нужно спешить']),
      ]),
 dict(slug='energy', key='ENERGY', ru='Энергия', motto='Сила и движение', photo='power-yoga',
      lead='Силовая йога и саундхилинг, чтобы проснуться и зарядиться на весь день.',
      svc=[
       ('Силовая йога', 'power-yoga', 'Динамичная йога: позы идут одна за другой в ритме дыхания. Похоже на тренировку, но с вниманием к телу, а не к результату.',
        ['Укрепляет мышцы и выносливость', 'Тренирует баланс и координацию', 'Бодрость на весь день']),
       ('Саундхилинг', 'm-bowl', 'Звуковая медитация: ты лежишь, а ведущий играет на поющих чашах. Вибрацию звука слышишь всем телом.',
        ['Глубокое расслабление', 'Помогает переключиться и выдохнуть', 'Подходит, если медитировать сложно']),
      ]),
 dict(slug='beauty', key='BEAUTY', ru='Красота', motto='Любовь к себе', photo='nails-red',
      lead='Маникюр, педикюр и макияж. Без спешки: мастер работает с тобой, а не с очередью.',
      svc=[
       ('Маникюр', 'nails-red', 'Уход за ногтями и кожей рук: кутикула, форма, покрытие. Цвет и длину выбираешь вместе с мастером.',
        ['Ухоженные руки', 'Форма и цвет под тебя', 'Час тишины для себя']),
       ('Педикюр', 'toes', 'Уход за стопами и ногтями на ногах: кожа, кутикула, форма и покрытие.',
        ['Мягкая кожа стоп', 'Аккуратные ногти', 'Лёгкость в ногах']),
       ('Макияж', 'lipstick-roses', 'Макияж, который подчёркивает тебя, а не прячет. Под событие или просто потому, что хочется.',
        ['Под твоё лицо и настроение', 'Стойкость на весь вечер', 'Можно спросить, как повторить дома']),
      ]),
 dict(slug='connection', key='CONNECTION', ru='Связь', motto='Слово и общение', photo='talk',
      lead='Лекции и встречи с людьми, которым интересно то же, что тебе.',
      svc=[
       ('Лекции и встречи', 'talk', 'Встречи с экспертами о здоровье, психологии, отношениях, энергии и самопознании. Можно слушать, спрашивать и спорить.',
        ['Новые знания без учебника', 'Разговоры с близкими по духу', 'Знакомства, которые продолжаются']),
       ('Комьюнити и ретриты', 'sauna-steam', 'Совместные занятия и выездные ретриты, в том числе банные. Расписание и запись будут в приложении MIAU.',
        ['Поддержка и принадлежность', 'Отдых вне города', 'MIAU за пределами стен']),
      ]),
 dict(slug='soul', key='SOUL', ru='Душа', motto='Интуиция и внутренний мир', photo='candle-hands',
      lead='Кундалини-практики и тишина. Время услышать себя.',
      svc=[
       ('Кундалини-практики', 'med-hands', 'Направление йоги, где соединяются дыхание, повторяющиеся движения, звук и медитация. Важно не как выглядит поза, а что ты чувствуешь.',
        ['Успокаивает поток мыслей', 'Возвращает энергию', 'Помогает прислушаться к себе']),
      ]),
]
TITLES = {d['slug']: f"{d['key']} — {d['motto']} · MIAU" for d in D}

def page(d):
    url = BASE + d['slug'] + '.html'
    h = head
    h = re.sub(r'<title>[^<]*</title>', f"<title>{TITLES[d['slug']]}</title>", h)
    desc = f"{d['motto']} в MIAU на Фрунзенской набережной: " + ', '.join(s[0].lower() for s in d['svc']) + '. Что это, чем помогает и как записаться.'
    h = re.sub(r'(<meta (?:name="description"|property="og:description") content=")[^"]*', lambda m: m.group(1) + desc, h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + TITLES[d['slug']], h)
    h = h.replace(BASE + 'napravleniya.html', url)
    h = re.sub(r'"name": "Направления и цены"', f'"name": "{d["ru"]}"', h)
    h = h.replace('{"@type": "ListItem", "position": 2, "name": "' + d['ru'] + '", "item": "' + url + '"}',
                  '{"@type": "ListItem", "position": 2, "name": "Направления и цены", "item": "' + BASE + 'napravleniya.html"}, {"@type": "ListItem", "position": 3, "name": "' + d['ru'] + '", "item": "' + url + '"}')
    m = []
    m.append(f'''
  <section class="scr" style="position: relative; height: 100svh; min-height: 560px; background: #2A030C; color: #EFE4D6; overflow: hidden" data-scroll="pass">
    <img fetchpriority="high" class="ph" data-depth src="assets/{d['photo']}.webp" alt="" style="--depth:-140">
    <div style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(42,3,12,.88) 0%, rgba(42,3,12,.55) 55%, rgba(42,3,12,.3) 100%)"></div>
    <div class="wrap" style="position: relative; height: 100%; display: flex; align-items: flex-end; gap: 32px; padding-bottom: clamp(48px, 9svh, 96px)">
      <img class="draw" src="assets/sign-{d['slug']}-cream.svg" alt="" style="height: clamp(140px, 22svh, 220px); width: auto">
      <div style="display: flex; flex-direction: column; gap: 14px; max-width: 640px">
        <h1 class="h1">{d['key']}</h1>
        <p class="h3" style="font-size: 22px">{d['motto']}</p>
        <p class="lead">{d['lead']}</p>
      </div>
    </div>
  </section>''')
    for i, (name, ph, what, helps) in enumerate(d['svc']):
        rev = ' svc-rev' if i % 2 else ''
        lis = ''.join(f'<li>{x}</li>' for x in helps)
        m.append(f'''
  <section class="wrap scr svc{rev}">
    <div class="svc-ph zoom soft"><img class="ph" src="assets/{ph}.webp" alt="{name}"></div>
    <div class="svc-tx">
      <span class="small" style="color: #2A030C">{d['key']} · {i + 1:02d}</span>
      <h2 class="h2 rv">{name}</h2>
      <p class="lead fade">{what}</p>
      <div class="fade">
        <p class="small" style="color: #2A030C; margin-bottom: 10px">Чем помогает</p>
        <ul class="svc-list">{lis}</ul>
      </div>
      <p class="small fade">[мин] · [цена]</p>
      <a class="btn btn-wine fade" href="kontakty.html" data-book data-dir="{d['slug']}" data-svc="{name}" style="align-self: flex-start">Записаться</a>
    </div>
  </section>''')
    others = ''.join(f'<a class="btn btn-ghost" href="{o["slug"]}.html">{o["key"]}</a>' for o in D if o is not d)
    m.append(f'''
  <section style="background: #2A030C; color: #EFE4D6">
    <div class="wrap sec" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 24px 80px">
      <h2 class="h2 rv">Другие направления</h2>
      <nav style="display: flex; flex-wrap: wrap; gap: 8px" aria-label="Другие направления">{others}</nav>
    </div>
  </section>
''')
    return h + '<main>' + ''.join(m) + '\n</main>' + foot

for d in D:
    open(d['slug'] + '.html', 'w', encoding='utf-8').write(page(d))
    print(d['slug'])
