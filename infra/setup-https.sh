#!/usr/bin/env bash
set -euo pipefail

# HTTPS setup for SupiChat behind Nginx + Certbot (domain or IP)
# Usage: sudo bash infra/setup-https.sh <domain-or-ip>

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0 <domain-or-ip>"; exit 1; fi

HOST="${1:-}"
if [ -z "$HOST" ]; then echo "Usage: $0 <domain-or-ip>"; exit 1; fi

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx openssl

mkdir -p /var/www/certbot

cat >/etc/nginx/sites-available/supichat <<NGINX
server {
  listen 80;
  server_name $HOST;

  location /.well-known/acme-challenge/ { root /var/www/certbot; }

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

IPV4_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
IPV6_REGEX=':'

if [[ "$HOST" =~ $IPV4_REGEX || "$HOST" =~ $IPV6_REGEX ]]; then
  echo "Attempting Let's Encrypt IP certificate (short-lived) for $HOST..."
  # Issue short-lived IP cert using webroot challenge. Note: per Let's Encrypt, IP certs are short-lived (~6 days)
  # See: https://letsencrypt.org/2025/07/01/issuing-our-first-ip-address-certificate
  read -r -p "Admin email for Let’s Encrypt (optional): " EMAIL || true
  if [ -n "$EMAIL" ]; then
    certbot certonly --webroot -w /var/www/certbot -d "$HOST" --agree-tos -m "$EMAIL" --non-interactive || true
  else
    certbot certonly --webroot -w /var/www/certbot -d "$HOST" --agree-tos --register-unsafely-without-email --non-interactive || true
  fi
  CRT_DIR="/etc/letsencrypt/live/$HOST"
  if [ -f "$CRT_DIR/fullchain.pem" ]; then
    cat >/etc/nginx/sites-available/supichat <<NGINX
server { listen 80; server_name $HOST; location /.well-known/acme-challenge/ { root /var/www/certbot; } return 301 https://\$host\$request_uri; }

server {
  listen 443 ssl;
  server_name $HOST;
  ssl_certificate $CRT_DIR/fullchain.pem;
  ssl_certificate_key $CRT_DIR/privkey.pem;

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
    nginx -t && systemctl reload nginx

    # Auto-renew every 5 days for short-lived IP certs
    cat >/etc/systemd/system/supichat-ip-renew.service <<SVC
[Unit]
Description=SupiChat IP certificate renewal

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot certonly --webroot -w /var/www/certbot -d $HOST --agree-tos --non-interactive --register-unsafely-without-email
ExecStartPost=/bin/systemctl reload nginx
SVC

    cat >/etc/systemd/system/supichat-ip-renew.timer <<TMR
[Unit]
Description=Renew IP certificate every 5 days

[Timer]
OnUnitActiveSec=5d
Persistent=true

[Install]
WantedBy=timers.target
TMR
    systemctl daemon-reload
    systemctl enable --now supichat-ip-renew.timer
  else
    echo "\nWarning: IP certificate not found at $CRT_DIR."
    echo "This likely means your ACME client (certbot) does not yet support IP certificates with the short-lived profile."
    echo "See: https://letsencrypt.org/2025/07/01/issuing-our-first-ip-address-certificate"

    read -r -p "Generate a self-signed certificate for $HOST instead? [y/N]: " SS || true
    if [[ "${SS,,}" == "y" ]]; then
      mkdir -p /etc/ssl/supichat
      openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/supichat/selfsigned.key \
        -out /etc/ssl/supichat/selfsigned.crt \
        -subj "/CN=$HOST" >/dev/null 2>&1

      cat >/etc/nginx/sites-available/supichat <<NGINX
server { listen 80; server_name $HOST; location /.well-known/acme-challenge/ { root /var/www/certbot; } return 301 https://\$host\$request_uri; }

server {
  listen 443 ssl;
  server_name $HOST;
  ssl_certificate /etc/ssl/supichat/selfsigned.crt;
  ssl_certificate_key /etc/ssl/supichat/selfsigned.key;

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
      nginx -t && systemctl reload nginx
      echo "Self-signed HTTPS configured. Modern browsers will show a warning until you trust the cert."
      echo "When Let's Encrypt IP certs are fully supported by your client, re-run this script to switch."
    else
      echo "Keeping HTTP-only for now. You can run this script later with a domain or after client updates."
      exit 2
    fi
  fi
else
  certbot --nginx -d "$HOST"
fi

echo "HTTPS set up. Visit: https://$HOST/supichat"


