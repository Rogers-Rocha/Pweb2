# Gym — Frontend

Painel web (Vite + React) para a Gym API. Gerado com auxílio de IA (permitido pelo enunciado).
Telas por papel: **ADMIN** (membros, treinos, check-ins, usuários), **TRAINER** (membros, treinos, check-ins), **MEMBER** (perfil, treinos, check-in).
A listagem de treinos mostra o header `X-Cache` (HIT/MISS) devolvido pela API.

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:3000  (ou http://localhost:8080 com o compose)
npm install
npm run dev               # http://localhost:5173
```

Deploy na Vercel: veja `trabFinal/README.md` (Root Directory = `frontend`, variável `VITE_API_URL`).
