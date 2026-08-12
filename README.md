# Epsync

Plataforma de entretenimento, tracking e sincronização de séries, filmes e animes em tempo real.

Domínio oficial: [https://epsync.com.br/](https://epsync.com.br/)

## Estrutura

- Frontend: pasta raiz (`src`) com React, Vite, TypeScript e CSS moderno.
- Backend: [server](server) com Express e TypeScript.

## Requisitos

- Node.js 20+
- npm 10+

## Setup Local

1. Instale dependências:
   - `npm install`
   - `npm install --prefix server`
2. Configure variáveis de ambiente:
   - Copie [.env.example](.env.example) para `.env` na raiz.
   - Copie [server/.env.example](server/.env.example) para `server/.env`.
3. Execute em desenvolvimento:
   - `npm run dev`

## Scripts

- `npm run dev`: sobe frontend + backend.
- `npm run build`: build de produção do frontend.
- `npm run build --prefix server`: build do backend.
- `npm run test:server`: testes do backend.
