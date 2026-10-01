#!/usr/bin/env bash
# Com o servidor rodando (npm start), execute: bash demo.sh
B=http://localhost:${PORT:-3000}
echo "== 1) Sem token (short-circuit no auth) =="; curl -s -i $B/pedidos | sed -n '1p;$p'; echo
echo "== 2) Token válido (chega ao controller/service) =="; curl -s -H "Authorization: Bearer token-valido" $B/pedidos; echo; echo
echo "== 3) Erro de negócio vindo do service (404) =="; curl -s -H "Authorization: Bearer token-valido" $B/pedidos/99; echo; echo
echo "== 4) Erro de negócio (403) =="; curl -s -H "Authorization: Bearer token-valido" $B/pedidos/3; echo
