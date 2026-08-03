# ShowTime

Aplicacao de tracking de series e filmes com frontend React/Vite e backend Express/TypeScript.

## Estrutura

- Frontend: pasta raiz (`src`).
- Backend: [server](server).

## Requisitos

- Node.js 20+
- npm 10+

## Setup Local

1. Instale dependencias:
   - `npm install`
   - `npm install --prefix server`
2. Configure variaveis de ambiente:
   - Copie [.env.example](.env.example) para `.env` na raiz.
   - Copie [server/.env.example](server/.env.example) para `server/.env`.
3. Rode em desenvolvimento:
   - `npm run dev`

## Scripts

- `npm run dev`: sobe frontend + backend.
- `npm run build`: build do frontend.
- `npm run build --prefix server`: build do backend.
- `npm run test:server`: testes backend.

## Hardening Aplicado

- JWT validado com `issuer`, `audience` e algoritmo fixo (`HS256`).
- CORS por whitelist (`CORS_ORIGINS`), sem wildcard em producao.
- `helmet` habilitado no backend.
- Rate limiting global e especifico para rotas de auth.
- Limite de payload JSON/form para reduzir abuso.
- Validacoes de payload mais estritas em comments/reactions/lists/auth.
- Seed de usuario demo desabilitado por padrao.

## Checklist de Producao

1. Defina `NODE_ENV=production` no backend.
2. Configure `JWT_SECRET` com ao menos 32 caracteres aleatorios.
3. Configure `CORS_ORIGINS` com domínios reais.
4. Garanta `SEED_DEMO_USER=false`.
5. Ative logs centralizados e monitoramento de erros.
6. Rode `npm audit` periodicamente nos dois pacotes.

## Performance

- App usa code splitting por telas com `React.lazy`.
- Vite configurado com `manualChunks` para bibliotecas principais.
