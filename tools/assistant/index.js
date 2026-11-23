/* MIAU — облачная функция для ассистента и заявок (Yandex Cloud Functions, Node.js 18+).
   Один адрес на всё:
     { messages: [...] }  → ответ ассистента через GigaChat
     { type, data, ... }  → заявка с сайта (форма или чат) → сообщение в Telegram
   Все ключи — в переменных окружения функции, НЕ в коде сайта:
     GIGACHAT_KEY   — ключ авторизации из личного кабинета GigaChat (Basic)
     GIGACHAT_SCOPE — GIGACHAT_API_PERS (физлицо) или GIGACHAT_API_B2B (ИП/юрлицо)
     TG_TOKEN       — токен бота от @BotFather
     TG_CHAT        — id чата администратора или группы
     ALLOW_ORIGIN   — https://nikitazhuravlev229-star.github.io (или домен сайта)
     NODE_EXTRA_CA_CERTS=./russian_trusted_root_ca.pem — сертификат НУЦ Минцифры, нужен для GigaChat */
const fs = require('fs');
const crypto = require('crypto');
const KB = fs.readFileSync(__dirname + '/kb.md', 'utf8');
const DIRS = ['body', 'energy', 'beauty', 'connection', 'soul'];
const NAMES = { body: 'BODY Тело', energy: 'ENERGY Энергия', beauty: 'BEAUTY Красота', connection: 'CONNECTION Связь', soul: 'SOUL Душа' };
const dirName = v => String(v || '').split(',').filter(Boolean).map(d => NAMES[d] || d).join(', ');

const SYSTEM = `Ты — ассистент женского пространства MIAU на сайте. Обращайся к собеседнице на «ты», тепло и коротко: 1–3 предложения.
Отвечай ТОЛЬКО по базе знаний ниже. Если факта нет в базе или он в [квадратных скобках] — не придумывай, скажи, что это уточнит администратор, и предложи записаться.
Не ставь диагнозов и не давай медицинских советов. Не обещай скидок, цен, времени и мастеров.
Не проси телефон и имя в тексте — запись собирается отдельными шагами.
Ответ строго в JSON без пояснений: {"reply":"текст","action":"none|book|cert","dir":["body"],"svc":["Массаж"]}
action=book — если она хочет записаться или выбрала услугу; dir — коды направлений из ${DIRS.join(', ')}; svc — названия услуг из базы. action=cert — если хочет сертификат.

БАЗА ЗНАНИЙ:
${KB}`;

/* простая защита от перебора: не больше 20 запросов в 10 минут с адреса (в пределах одного экземпляра функции) */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

let token = null, tokenExp = 0;
async function gigaToken() {
  if (token && Date.now() < tokenExp - 60000) return token;
  const r = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', RqUID: crypto.randomUUID(), Authorization: 'Basic ' + process.env.GIGACHAT_KEY },
    body: 'scope=' + (process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS')
  });
  if (!r.ok) throw new Error('gigachat oauth ' + r.status);
  const j = await r.json();
  token = j.access_token; tokenExp = j.expires_at || Date.now() + 25 * 60000;
  return token;
}

async function chat(messages) {
  const msgs = (Array.isArray(messages) ? messages : []).slice(-12)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
  const r = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await gigaToken() },
    body: JSON.stringify({ model: 'GigaChat', temperature: 0.3, max_tokens: 400, messages: [{ role: 'system', content: SYSTEM }, ...msgs] })
  });
  if (!r.ok) throw new Error('gigachat ' + r.status);
  const text = (await r.json()).choices[0].message.content || '';
  let out;
  try { out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch (e) { out = { reply: text }; }
  return {
    reply: String(out.reply || '').slice(0, 800),
    action: ['book', 'cert'].includes(out.action) ? out.action : 'none',
    dir: (out.dir || []).filter(d => DIRS.includes(d)),
    svc: (out.svc || []).filter(s => typeof s === 'string' && KB.includes(s))
  };
}

function lead(p) {
  const d = p.data || {}, L = [];
  const head = p.type === 'cert' ? '🎁 Сертификат' : '📝 Запись';
  L.push(`${head} ${p.source === 'chat' ? 'из чата' : 'с формы'}`);
  const add = (k, v) => { if (v) L.push(`${k}: ${String(v).slice(0, 300)}`); };
  if (p.type === 'cert') { add('Сумма', d.sum); add('Направление', dirName(d.dir)); add('Кому', d.to); add('От кого', d.from); add('Пожелание', d.wish); add('Получение', d.get); }
  else { add('Направления', dirName(d.dir)); add('Услуги', d.svc); add('День', d.date); add('Время', d.time === 'own' ? d.owntime : d.time); add('Специалист', d.master); }
  add('Имя', d.name); add('Телефон', d.phone); add('Связь', d.channel); add('Комментарий', d.comment);
  if (p.dialog) L.push('\nДиалог:\n' + String(p.dialog).slice(0, 2500));
  return fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_CHAT, text: L.join('\n'), disable_web_page_preview: true })
  }).then(r => { if (!r.ok) throw new Error('telegram ' + r.status); });
}

module.exports.handler = async function (event) {
  const origin = process.env.ALLOW_ORIGIN || '*';
  const H = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json; charset=utf-8' };
  const res = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return res(405, { error: 'method' });
  const ip = (event.headers && (event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for']) || '').split(',')[0] || 'x';
  if (limited(ip)) return res(429, { error: 'slow down' });
  let p;
  try { p = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body); } catch (e) { return res(400, { error: 'json' }); }
  try {
    if (p.messages) return res(200, await chat(p.messages));
    if (!p.consent || !p.data || !p.data.phone) return res(400, { error: 'lead' });
    await lead(p);
    return res(200, { ok: true });
  } catch (e) {
    console.error(e);
    return res(502, { error: 'upstream' });
  }
};
