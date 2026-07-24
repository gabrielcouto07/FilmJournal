# Publicando o FilmJournal (arquitetura separada)

Três peças, três lugares:

```
┌─────────────┐  HTTPS   ┌──────────────┐  Postgres  ┌────────┐
│  web (Next) │ ───────► │ api (Fastify)│ ─────────► │  Neon  │
│   Vercel    │          │  host Node   │            │ sa-east│
└─────────────┘          └──────────────┘            └────────┘
```

A ordem importa: **primeiro a api** (para ter a URL), **depois o web**.

***

## 1. Banco — Neon (já existe)

Nada muda: é o mesmo banco de sempre. Só confirme que as migrações estão aplicadas
(a última, `20260723000000_drop_show_adult_content`, já foi aplicada localmente):

```bash
cd api
npx prisma migrate deploy
```

## 2. API — host Node com o Dockerfile pronto

A `api/` é um servidor Fastify persistente — **não** roda na Vercel. Ela já tem
`Dockerfile`, então qualquer host de containers serve. Duas boas opções:

- **Fly.io (recomendado)** — tem região **GRU (São Paulo)**, a mesma do seu Neon
  (`sa-east-1`): latência mínima entre API e banco.
  ```bash
  cd api
  fly launch --no-deploy      # detecta o Dockerfile; escolha a região gru
  fly secrets set DATABASE_URL="..." DIRECT_URL="..." JWT_SECRET="..." \
    CORS_ORIGIN="https://SEU-APP.vercel.app" TMDB_API_KEY="..." \
    APP_OWNER_USERNAME="..." APP_OWNER_PASSWORD="..." \
    RESEND_API_KEY="..." EMAIL_FROM="FilmJournal <onboarding@resend.dev>"
  fly deploy
  ```
- **Render / Railway** — mais simples ainda (conecta o repo e pronto), mas sem
  região na América do Sul. Em Render: *New Web Service* → repo → Root Directory
  `api` → Runtime Docker → cadastre as mesmas variáveis acima.

Variáveis da API em produção:

| Variável | Valor em produção |
|---|---|
| `DATABASE_URL` | URL *pooled* do Neon |
| `DIRECT_URL` | URL direta do Neon (migrações) |
| `JWT_SECRET` | **Gere um novo** para produção: `openssl rand -base64 32` |
| `CORS_ORIGIN` | Domínio do web na Vercel (ex.: `https://filmjournal.vercel.app`). Aceita lista separada por vírgula se tiver domínio próprio também |
| `TMDB_API_KEY` | A mesma chave de sempre |
| `APP_OWNER_USERNAME` / `APP_OWNER_PASSWORD` | Conta principal (bootstrap do primeiro login) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Código de confirmação da troca de senha |
| `PORT` | O host geralmente define sozinho; o padrão é 4000 |

Teste: `https://SUA-API/health` deve responder `{"status":"ok"}`.

> As chamadas de navegador usam `Authorization: Bearer` (sem cookies cross-site),
> então o CORS é simples — basta o `CORS_ORIGIN` apontar para o domínio do web.

## 3. Web — Vercel

1. Importe o repositório na [vercel.com](https://vercel.com).
2. **Root Directory: `web`** (Settings → General). Framework: Next.js (detecta sozinho).
3. Variáveis de ambiente — só existe **uma**:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | URL pública da API, **sem barra no final** (ex.: `https://filmjournal-api.fly.dev`) |

4. **Apague as variáveis antigas** se o projeto já existia na Vercel
   (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
   `TMDB_API_KEY`, `APP_OWNER_*`, `RESEND_API_KEY`) — o frontend não usa mais nenhuma.
5. Deploy. Como `NEXT_PUBLIC_API_URL` é embutida no build, **mudar a URL da API
   exige novo deploy** do web.

## 4. Amarração final

1. Copie o domínio gerado pela Vercel e confira o `CORS_ORIGIN` da API.
2. Abra o site → página pública deve mostrar os populares da semana (prova de que
   o web alcança a API).
3. Faça login → o painel do veredito deve carregar (prova do fluxo autenticado:
   cookie → Bearer → API → Neon).

### Checklist de problemas comuns

| Sintoma | Causa provável |
|---|---|
| Página pública sem os filmes populares | `NEXT_PUBLIC_API_URL` errada ou API fora do ar (`/health`) |
| Login falha com erro de rede | Mesmo motivo acima (o proxy `/api/auth/login` chama a API por dentro da Vercel) |
| Login ok, mas dados não carregam no navegador | `CORS_ORIGIN` na API não bate com o domínio da Vercel |
| Sessão cai depois de 15 min | Cookie `fj_refresh` ausente — confira se o login foi feito no domínio final (cookies não migram entre domínios de preview) |

> **Previews da Vercel:** cada preview tem domínio próprio (`*-git-*.vercel.app`).
> Para testá-los logado, adicione o domínio do preview ao `CORS_ORIGIN`
> (lista separada por vírgula) ou teste apenas no domínio de produção.
