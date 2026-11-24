#!/usr/bin/env python3
"""MIAU: пересыльщик заявок в Telegram (на зарубежном VPS).
Яндекс-функция -> https://<сервер>/miau-relay -> api.telegram.org.
Принимает JSON {secret, token, chat, text, ping}. Токен бота хранится в функции, здесь только общий секрет."""
import json, os, re, socket, urllib.request, urllib.error

# IPv6 до api.telegram.org с этого сервера зависает — ходим только по IPv4
_gai = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: _gai(host, port, socket.AF_INET, type, proto, flags)
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ['RELAY_SECRET']

def tg(token, method, payload=None):
    import time
    t0 = time.time()
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f'https://api.telegram.org/bot{token}/{method}', data=data,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            res = r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e:
        res = e.code, e.read().decode()[:300]
    except Exception as e:
        res = 0, str(e)[:200]
    print(f'{method} -> {res[0]} за {time.time() - t0:.1f} с {res[1][:150]}', flush=True)  # без токена
    return res

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n = min(int(self.headers.get('Content-Length', 0)), 20000)
            d = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.out(400, {'ok': False, 'error': 'json'})
        if d.get('secret') != SECRET:
            return self.out(403, {'ok': False, 'error': 'secret'})
        tok = str(d.get('token', ''))
        if not re.fullmatch(r'\d+:[\w-]+', tok):
            return self.out(400, {'ok': False, 'error': 'token'})
        if d.get('ping'):
            code, body = tg(tok, 'getMe')
        else:
            code, body = tg(tok, 'sendMessage', {'chat_id': str(d.get('chat', '')),
                                                 'text': str(d.get('text', ''))[:4000],
                                                 'disable_web_page_preview': True})
        self.out(200, {'ok': code == 200, 'code': code, 'tg': '' if code == 200 else body})

    def out(self, c, o):
        b = json.dumps(o, ensure_ascii=False).encode()
        self.send_response(c)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def log_message(self, *a):
        pass

ThreadingHTTPServer(('127.0.0.1', 8787), H).serve_forever()
