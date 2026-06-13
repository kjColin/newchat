# NewChat Deployment

This document records the current production deployment contract for `newchat.clnkj.de`.

## Runtime Layout

The active deployment uses the `chat-app` workspace:

- Backend working directory: `/root/.openclaw/workspace/chat-app/src/backend`
- Frontend working directory: `/root/.openclaw/workspace/chat-app/src/frontend`
- Backend listen address: `127.0.0.1:3101`
- Frontend preview address: `127.0.0.1:4173`
- Public entrypoint: `https://newchat.clnkj.de`

The backend build output entrypoint is:

```text
/root/.openclaw/workspace/chat-app/src/backend/dist/src/main.js
```

Do not point systemd at `dist/main.js`; the current Nest build emits `dist/src/main.js`.

## Build

Run these commands before restarting services:

```bash
cd /root/.openclaw/workspace/chat-app/src/backend
npm run build

cd /root/.openclaw/workspace/chat-app/src/frontend
npm run build
```

Recommended pre-deploy verification:

```bash
cd /root/.openclaw/workspace/chat-app/src/frontend
npm test
npm run build

cd /root/.openclaw/workspace/chat-app/src/backend
npm run build
npm run test:e2e
```

## systemd

Tracked templates live in:

- `deploy/systemd/newchat-backend.service`
- `deploy/systemd/newchat-frontend.service`

Install or refresh them with:

```bash
cp deploy/systemd/newchat-backend.service /etc/systemd/system/newchat-backend.service
cp deploy/systemd/newchat-frontend.service /etc/systemd/system/newchat-frontend.service
systemctl daemon-reload
systemctl enable newchat-backend.service newchat-frontend.service
systemctl restart newchat-backend.service newchat-frontend.service
```

Check status:

```bash
systemctl is-active newchat-backend.service newchat-frontend.service
ss -ltnp | grep -E ':(3101|4173)\b'
```

## Nginx

The tracked Nginx template is:

- `deploy/nginx/newchat.clnkj.de.conf`

Install it with:

```bash
cp deploy/nginx/newchat.clnkj.de.conf /etc/nginx/sites-available/newchat.clnkj.de
ln -sfn /etc/nginx/sites-available/newchat.clnkj.de /etc/nginx/sites-enabled/newchat.clnkj.de
nginx -t
systemctl reload nginx
```

## Smoke Checks

Frontend:

```bash
curl -k -I https://newchat.clnkj.de
```

Expected: `HTTP/2 200`.

API reachability:

```bash
curl -k https://newchat.clnkj.de/api/notifications/push/public-key
```

Expected for an anonymous request: `401 Unauthorized`. This confirms Nginx reaches the backend and the auth pipeline is active.

Backend logs:

```bash
journalctl -u newchat-backend.service -n 80 --no-pager
```

Expected startup line:

```text
Server running on http://127.0.0.1:3101
```
