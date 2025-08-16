#!/usr/bin/env bash
set -euo pipefail

# Simple HTTPS setup for SupiChat behind Nginx + Certbot
# Usage: sudo bash infra/setup-https.sh chat.example.com

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0 <domain>"; exit 1; fi

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then echo "Usage: $0 <domain>"; exit 1; fi

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

cat >/etc/nginx/sites-available/supichat <<NGINX
server {
  listen 80;
  server_name $DOMAIN;

  location /supichat/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location /supichat/socket.io/ {
    proxy_pass http://127.0.0.1:4001/supichat/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
  }
}
NGINX

ln -sf /etc/nginx/sites-available/supichat /etc/nginx/sites-enabled/supichat
nginx -t && systemctl reload nginx

certbot --nginx -d "$DOMAIN"

echo "HTTPS set up. Visit: https://$DOMAIN/supichat"


