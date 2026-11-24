/* Посредник для заявок MIAU: Яндекс-функция → этот скрипт Google → Telegram.
   Нужен, потому что из российских дата-центров api.telegram.org недоступен.
   Токен бота и id чата присылает сама функция (они хранятся в её переменных окружения),
   здесь только общий секрет — тот же, что RELAY_SECRET в функции.
   Развёртывание: «Начать развёртывание» → «Новое развёртывание» → «Веб-приложение», доступ «Все». */
var SECRET = 'ВПИШИ_СЕКРЕТ';

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (d.secret !== SECRET) return out({ ok: false, error: 'secret' });
  if (!/^\d+:[\w-]+$/.test(String(d.token || ''))) return out({ ok: false, error: 'token' });
  var base = 'https://api.telegram.org/bot' + d.token + '/';
  if (d.ping) {
    var me = UrlFetchApp.fetch(base + 'getMe', { muteHttpExceptions: true });
    return out({ ok: me.getResponseCode() === 200, code: me.getResponseCode() });
  }
  var r = UrlFetchApp.fetch(base + 'sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: String(d.chat), text: String(d.text || '').slice(0, 4000), disable_web_page_preview: true })
  });
  return out({ ok: r.getResponseCode() === 200, code: r.getResponseCode() });
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
