/* Посредник для заявок MIAU: Яндекс-функция → этот скрипт Google → Telegram.
   Нужен, потому что из российских дата-центров api.telegram.org недоступен.
   Вставь свои значения в три строки ниже, затем «Развернуть» → «Новое развёртывание» → «Веб-приложение»,
   «Кто имеет доступ: Все». Полученную ссылку впиши в функцию как RELAY_URL, а SECRET — как RELAY_SECRET. */
var TG_TOKEN = 'ВСТАВЬ_ТОКЕН_БОТА';
var TG_CHAT = '847899123';
var SECRET = 'ПРИДУМАЙ_ДЛИННОЕ_СЛОВО';

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (d.secret !== SECRET) return out({ ok: false, error: 'secret' });
  if (d.ping) {
    var me = UrlFetchApp.fetch('https://api.telegram.org/bot' + TG_TOKEN + '/getMe', { muteHttpExceptions: true });
    return out({ ok: me.getResponseCode() === 200, code: me.getResponseCode() });
  }
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: TG_CHAT, text: String(d.text || '').slice(0, 4000), disable_web_page_preview: true })
  });
  return out({ ok: r.getResponseCode() === 200, code: r.getResponseCode(), tg: r.getContentText().slice(0, 200) });
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
