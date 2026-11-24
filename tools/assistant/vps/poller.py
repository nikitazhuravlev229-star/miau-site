#!/usr/bin/env python3
"""MIAU: забирает заявки из Яндекс-функции и отправляет в Telegram (работает на зарубежном VPS).
Из России до Telegram не достучаться, поэтому направление обратное: сервер сам ходит в Яндекс.
Заявка удаляется из очереди ({ack}) только после того, как Telegram подтвердил доставку."""
import json, os, socket, time, urllib.request, urllib.error

_gai = socket.getaddrinfo  # IPv6 до Telegram с этого сервера зависает — только IPv4
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: _gai(host, port, socket.AF_INET, type, proto, flags)

FN = os.environ['MIAU_FUNCTION_URL']
SECRET = os.environ['RELAY_SECRET']

def post(url, payload, timeout=20):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return e.code, {'raw': e.read().decode()[:200]}

def tick():
    code, data = post(FN, {'pull': True, 'secret': SECRET})
    if code != 200:
        print('pull', code, data, flush=True)
        return
    done = []
    for lead in data.get('leads', []):
        c, res = post(f"https://api.telegram.org/bot{data['token']}/sendMessage",
                      {'chat_id': str(data['chat']), 'text': lead['text'][:4000], 'disable_web_page_preview': True})
        if c == 200 and res.get('ok'):
            done.append(lead['key'])
        else:
            print('telegram', c, str(res)[:200], flush=True)  # без токена
            if c == 429:
                time.sleep(int(res.get('parameters', {}).get('retry_after', 5)))
            break
    if done:
        post(FN, {'ack': done, 'secret': SECRET})
        print('отправлено заявок:', len(done), flush=True)

while True:
    try:
        tick()
    except Exception as e:
        print('ошибка:', str(e)[:200], flush=True)
    time.sleep(10)
