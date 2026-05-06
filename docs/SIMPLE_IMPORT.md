# Fast Setup For webvibe-lead.fun

Use this URL for n8n:

```text
https://n8n.webvibe-lead.fun
```

## 1. DNS

In your domain DNS panel create this record:

```text
Type: A
Name: n8n
Value: 178.104.253.76
TTL: Auto
```

Check:

```bash
nslookup n8n.webvibe-lead.fun
```

It should return `178.104.253.76`.

## 2. VPS Commands

SSH:

```bash
ssh root@178.104.253.76
```

Install Caddy:

```bash
apt update
apt install -y caddy
```

Create Caddy config:

```bash
cat >/etc/caddy/Caddyfile <<'EOF'
n8n.webvibe-lead.fun {
    reverse_proxy 127.0.0.1:5678
}
EOF
```

Reload Caddy:

```bash
systemctl reload caddy
systemctl status caddy --no-pager
```

Restart project:

```bash
cd /opt/leadgen
docker compose up -d
```

Open:

```text
https://n8n.webvibe-lead.fun
```

## 3. Import Workflow

1. Delete or deactivate old Telegram workflows with `Interval`, `Get Updates`, or `telegram_offset.txt`.
2. Import `n8n/Telegram Bot - Command Router.json`.
3. Activate it.

## 4. Set Telegram Webhook

Run:

```bash
curl -X POST "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook?url=https://n8n.webvibe-lead.fun/webhook/telegram-bot"
```

Check:

```bash
curl "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/getWebhookInfo"
```

Expected URL:

```text
https://n8n.webvibe-lead.fun/webhook/telegram-bot
```

## 5. Clean Old Polling

```bash
rm -f /tmp/telegram_offset.txt
pkill -f "scripts/telegram/bot.js" || true
```

Then send `/status` to the bot.
