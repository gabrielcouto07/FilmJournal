# FilmJournal — web

Frontend do FilmJournal: **Next.js 15 · React 19 · TypeScript · Tailwind CSS · Recharts**.

É só interface — não acessa banco de dados. Toda leitura e escrita passa pela [`api/`](../api) (Fastify), autenticada com JWT:

- O login guarda o **access token** num cookie legível (`fj_access`, enviado como `Authorization: Bearer`) e o **refresh token** num cookie `httpOnly` (`fj_refresh`).
- As únicas rotas internas (`src/app/api/auth/*`) são proxies finos de login/registro/refresh/logout que gerenciam esses cookies.
- O `middleware.ts` renova a sessão de forma transparente e protege as páginas privadas.
- Server Components leem dados com `apiGet` (`src/lib/api-server.ts`); componentes de cliente usam `apiFetch` (`src/lib/api.ts`), que renova o token e repete a chamada uma vez em caso de 401.

## Rodar

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL (padrão: http://localhost:4000)
npm install
npm run dev                  # http://localhost:3000 — requer a api rodando
```

Guia completo de execução e publicação: [README da raiz](../README.md) · [DEPLOY.md](../DEPLOY.md).
