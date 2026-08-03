# ShowTime Backend

Backend Express/TypeScript para autenticacao e tracking.

## Ambiente

Copie [server/.env.example](.env.example) para `server/.env` e preencha os valores.

Variaveis obrigatorias em producao:
- `NODE_ENV=production`
- `JWT_SECRET` (minimo 32 chars)
- `CORS_ORIGINS`

## Scripts

- `npm run dev`: compila e sobe servidor.
- `npm run build`: compila TypeScript.
- `npm run start`: inicia build compilado.
- `npm run test`: roda testes com Jest (ESM).

## Seguranca

- Helmet ativo.
- Rate limit global e para auth.
- CORS restrito por whitelist.
- JWT com issuer/audience/algorithm.
- Limite de payload em requests.

## Observacoes

- `SEED_DEMO_USER` deve ficar `false` fora de ambiente local.
- Firebase Admin e carregado sob demanda para verificar tokens Firebase.
