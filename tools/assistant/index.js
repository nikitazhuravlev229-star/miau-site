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
     NODE_EXTRA_CA_CERTS=./russian_trusted_root_ca.pem — сертификат НУЦ Минцифры, нужен для GigaChat
   Вместо GigaChat можно любую модель с OpenAI-совместимым API (например, Kie.ai) — тогда задать:
     LLM_URL   — полный адрес, например https://api.kie.ai/<модель>/v1/chat/completions (точный путь — в docs.kie.ai)
     LLM_KEY   — ключ API
     LLM_MODEL — имя модели, если провайдер просит его в теле запроса (Kie не просит: модель в адресе)
   Groq (бесплатный тариф, без карты): LLM_URL=https://api.groq.com/openai/v1/chat/completions, LLM_KEY=gsk_…, LLM_MODEL=openai/gpt-oss-120b
   FreeLLMAPI (свой сервер-агрегатор бесплатных лимитов): LLM_URL=https://<сервер>/v1/chat/completions,
     LLM_KEY=freellmapi-… (общий ключ из его панели), LLM_MODEL=одна конкретная модель (не auto — иначе ответы скачут по стилю)
   Если LLM_URL задан, GigaChat не используется. */
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

/* ключ: LLM_KEY, а если его нет — токен сервисного аккаунта функции (YandexGPT в том же облаке) */
function llmHeaders(context) {
  const h = { 'Content-Type': 'application/json' };
  const tok = process.env.LLM_KEY || (context && context.token && context.token.access_token);
  if (tok) h.Authorization = 'Bearer ' + tok;
  if (process.env.LLM_PROJECT) h['OpenAI-Project'] = process.env.LLM_PROJECT;
  return h;
}

async function chat(messages, context) {
  const msgs = (Array.isArray(messages) ? messages : []).slice(-12)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
  const all = [{ role: 'system', content: SYSTEM }, ...msgs];
  let r;
  if (process.env.LLM_URL) {
    const parts = /kie\.ai/.test(process.env.LLM_URL); /* Kie ждёт content массивом, остальные (FreeLLMAPI, OpenRouter…) — строкой */
    const body = { messages: all.map(m => ({ role: m.role, content: parts ? [{ type: 'text', text: m.content }] : m.content })), stream: false, max_tokens: 400 };
    if (process.env.LLM_MODEL) body.model = process.env.LLM_MODEL;
    r = await fetch(process.env.LLM_URL, { method: 'POST', headers: llmHeaders(context), body: JSON.stringify(body) });
  } else {
    r = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await gigaToken() },
      body: JSON.stringify({ model: 'GigaChat', temperature: 0.3, max_tokens: 400, messages: all })
    });
  }
  if (!r.ok) throw new Error('llm ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (!j.choices || !j.choices[0]) throw new Error('llm ' + JSON.stringify(j).slice(0, 200)); /* Kie отдаёт ошибки и с кодом 200 */
  let text = j.choices[0].message.content || '';
  if (Array.isArray(text)) text = text.map(p => p.text || '').join('');
  let out;
  try { out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch (e) { out = { reply: text }; }
  return {
    reply: String(out.reply || '').slice(0, 800),
    action: ['book', 'cert'].includes(out.action) ? out.action : 'none',
    dir: (out.dir || []).filter(d => DIRS.includes(d)),
    svc: (out.svc || []).filter(s => typeof s === 'string' && KB.includes(s))
  };
}

function lead(p, context) {
  const d = p.data || {}, L = [];
  const head = p.type === 'cert' ? '🎁 Сертификат' : '📝 Запись';
  L.push(`${head} ${p.source === 'chat' ? 'из чата' : 'с формы'}`);
  const add = (k, v) => { if (v) L.push(`${k}: ${String(v).slice(0, 300)}`); };
  if (p.type === 'cert') { add('Сумма', d.sum); add('Направление', dirName(d.dir)); add('Кому', d.to); add('От кого', d.from); add('Пожелание', d.wish); add('Получение', d.get); }
  else { add('Направления', dirName(d.dir)); add('Услуги', d.svc); add('День', d.date); add('Время', d.time === 'own' ? d.owntime : d.time); add('Специалист', d.master); }
  add('Имя', d.name); add('Телефон', d.phone); add('Связь', d.channel); add('Комментарий', d.comment);
  if (p.dialog) L.push('\nДиалог:\n' + String(p.dialog).slice(0, 2500));
  return process.env.LEADS_BUCKET ? queueLead(L.join('\n'), context) : sendTelegram(L.join('\n'));
}

/* из российских дата-центров api.telegram.org недоступен, поэтому можно слать через посредника
   (Google Apps Script, tools/assistant/relay.gs): RELAY_URL + RELAY_SECRET. Без них — напрямую в Telegram. */
async function sendTelegram(text, ping) {
  if (process.env.RELAY_URL) {
    const body = JSON.stringify({ secret: process.env.RELAY_SECRET, token: process.env.TG_TOKEN, chat: process.env.TG_CHAT, text, ping: !!ping });
    let r;
    for (let i = 0; ; i++) { /* связь Россия → зарубежный сервер иногда не устанавливается с первого раза — повторяем только неудачное подключение, чтобы не задвоить заявку */
      try { r = await fetch(process.env.RELAY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(18000) }); break; }
      catch (e) { const c = String(e.cause && e.cause.code || ''); if (i >= 1 || !/CONNECT|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/.test(c)) throw e; }
    }
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error('relay ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
    return j;
  }
  const r = await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/${ping ? 'getMe' : 'sendMessage'}`, ping ? { signal: AbortSignal.timeout(10000) } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_CHAT, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error('telegram ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

/* проверка связи: {"diag":true} — доступны ли модель и Telegram из функции */
async function diag(context) {
  const out = [];
  const t0 = Date.now();
  try { const a = await chat([{ role: 'user', content: 'Привет! Где вы находитесь?' }], context); out.push('llm: OK — ' + a.reply.slice(0, 100) + ' (' + (Date.now() - t0) + ' мс)'); }
  catch (e) { out.push('llm: ' + (e.cause && e.cause.code || e.message) + ' (' + (Date.now() - t0) + ' мс)'); }
  const t1 = Date.now();
  try { await sendTelegram('', true); out.push('telegram: OK (' + (Date.now() - t1) + ' мс)'); }
  catch (e) { out.push('telegram: ' + (e.cause && e.cause.code || (e.name === 'TimeoutError' ? 'timeout' : e.message)) + ' (' + (Date.now() - t1) + ' мс)'); }
  out.push('env: ' + ['LLM_URL', 'LLM_KEY', 'LLM_MODEL', 'LLM_PROJECT', 'RELAY_URL', 'RELAY_SECRET', 'TG_TOKEN', 'TG_CHAT', 'ALLOW_ORIGIN'].map(k => k + (process.env[k] ? '✓' : '–')).join(' ') + (context && context.token ? ' сервисный-аккаунт✓' : ' сервисный-аккаунт–'));
  return { diag: out.map(x => x.replace(/bot\d+:[\w-]+/g, 'bot***')) };
}

/* Очередь заявок в Object Storage (тот же Яндекс-облачный каталог).
   Из России до Telegram и до зарубежных серверов не достучаться, а зарубежный сервер до Яндекса — может.
   Поэтому функция кладёт заявку в закрытый бакет LEADS_BUCKET, а сервер (tools/assistant/vps/poller.py)
   раз в 10 секунд забирает её ({pull}) и после доставки в Telegram подтверждает ({ack}) — тогда заявка удаляется.
   Нужна роль storage.editor у сервисного аккаунта функции. */
const S3 = 'https://storage.yandexcloud.net/';
function s3(context, method, path, body) {
  return fetch(S3 + process.env.LEADS_BUCKET + '/' + path, {
    method, body,
    headers: Object.assign({ 'X-YaCloud-SubjectToken': context.token.access_token }, body ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}),
    signal: AbortSignal.timeout(10000)
  });
}
async function queueLead(text, context) {
  const key = 'leads/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.txt';
  const r = await s3(context, 'PUT', key, text);
  if (!r.ok) throw new Error('storage put ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
async function pullLeads(context) {
  const r = await s3(context, 'GET', '?list-type=2&prefix=leads/&max-keys=20');
  if (!r.ok) throw new Error('storage list ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const keys = [...(await r.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
  const leads = [];
  for (const key of keys) { const g = await s3(context, 'GET', key); if (g.ok) leads.push({ key, text: await g.text() }); }
  return { token: process.env.TG_TOKEN, chat: process.env.TG_CHAT, leads };
}
async function ackLeads(keys, context) {
  let n = 0;
  for (const key of (Array.isArray(keys) ? keys : []).filter(k => /^leads\/[\w.-]+$/.test(k))) { const d = await s3(context, 'DELETE', key); if (d.ok || d.status === 204) n++; }
  return { ok: true, deleted: n };
}

module.exports.handler = async function (event, context) {
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
    if (p.pull || p.ack) { if (!process.env.RELAY_SECRET || p.secret !== process.env.RELAY_SECRET) return res(403, { error: 'secret' }); return res(200, p.ack ? await ackLeads(p.ack, context) : await pullLeads(context)); }
    if (p.diag) return res(200, await diag(context));
    if (p.messages) return res(200, await chat(p.messages, context));
    if (!p.consent || !p.data || !p.data.phone) return res(400, { error: 'lead' });
    await lead(p, context);
    return res(200, { ok: true });
  } catch (e) {
    console.error(e);
    /* причина без ключей и токенов: код ответа и текст ошибки сервиса */
    return res(502, { error: 'upstream', detail: String(e && e.message || e).replace(/bot\d+:[\w-]+/g, 'bot***').slice(0, 300) });
  }
};
