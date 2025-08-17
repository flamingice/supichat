#!/usr/bin/env bash
set -e
pm2 stop supichat-web || true
pm2 stop supichat-signaling || true
pm2 delete supichat-web || true
pm2 delete supichat-signaling || true
