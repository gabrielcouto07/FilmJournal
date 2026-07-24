# 🎬 FilmJournal

Uma ferramenta pessoal que transforma seu histórico de filmes num autorretrato do seu gosto.

Você registra o que assiste e dá suas notas. O app faz o resto: abre com um **veredito** — uma frase que resume que tipo de espectador você é — e, ao rolar a página, mostra como seu gosto se comporta, como ele mudou com o tempo e o que você ainda não descobriu no cinema.

O projeto é dividido em três partes independentes:

| Pasta | O que é | Stack |
|---|---|---|
| [`web/`](web) | Frontend (interface) | Next.js 15 · React 19 · TypeScript · Tailwind CSS · Recharts |
| [`api/`](api) | Backend (regras, dados, auth JWT) | Fastify 5 · Prisma · Zod · TypeScript |
| Banco | PostgreSQL gerenciado | Neon (ou qualquer Postgres) |

O `web` não fala com o banco: toda leitura e escrita passa pela `api`. Detalhes do backend em **[api/README.md](api/README.md)** · guia de publicação em **[DEPLOY.md](DEPLOY.md)**.

***

## O que ele faz

Tudo parte dos filmes que você registra e avalia — nada de configuração manual.

### 🪞 Veredito (página inicial)
A porta de entrada. Em vez de uma lista de filmes, o app abre com uma frase sobre você: se seu paladar é generoso ou exigente diante do público, em que década ele mora, qual gênero domina e qual diretor você sempre revisita. É o resumo mais humano do seu gosto — e, logo abaixo, começam os gráficos.

### 👅 Paladar
O aprofundamento do veredito. Quais décadas, países e gêneros dominam seus filmes. Quais diretores você sempre revisita. E o mais divertido: a que distância suas notas ficam da opinião do público — os filmes que você ama e o mundo não, e vice-versa.

### 📈 Evolução
Mostra como seu gosto mudou ano a ano. Se suas notas ficaram mais generosas ou mais exigentes. Se você mergulhou em filmes antigos ou ficou mais contemporâneo. Quais gêneros ganharam e perderam espaço. O app ainda escreve, em uma frase, a maior mudança de cada ano. E os seus filmes favoritos revelam temas que se repetem — os "motivos recorrentes" do seu gosto.

### 🧭 Descobrir + Roleta
Mostra o que você está deixando de ver. O Descobrir compara seu histórico com o cinema em geral e aponta seus pontos cegos: décadas, países e gêneros que faltam no seu mapa — sempre explicando por que cada sugestão apareceu. E quando bater a indecisão, a Roleta sorteia o próximo filme por você.

### 🎮 Jogar — Cine-Detetive
Um jogo de dedução no estilo *Wordle*/Spotle: você tem **10 palpites** para descobrir o filme secreto. A cada tentativa, três tipos de pista se combinam — o **elenco** aparece nome a nome (do coadjuvante ao protagonista), o **pôster** vai saindo do desfoque e **seis quadros comparativos** dizem, em cores, o que seu palpite acertou (🟩), chegou perto (🟨) ou errou (⬜) em ano, gêneros, direção, estúdio, nota e elenco. Dicas opcionais liberam no meio do jogo. Jogue com os seus filmes, com os populares do TMDB ou no **modo Filme do Dia** — o mesmo desafio para todo mundo, um por dia.

***

## Como funciona por baixo

Sem segredo:

- **Dois caminhos para começar.** Quem já usa o Letterboxd importa o histórico completo de uma vez (com teste prévio, sem risco). Quem está começando do zero faz um tour guiado e escolhe 5 filmes favoritos — o suficiente para as primeiras análises acenderem.
- **De onde vêm os dados dos filmes.** As informações de cada filme (pôster, elenco, gênero, país, notas do público) vêm do [TMDB](https://www.themoviedb.org/), um banco de dados aberto de cinema. Suas notas e seu histórico são só seus.
- **Tudo é privado.** O app é feito para uma pessoa: você. Não há feed, seguidores nem páginas públicas. Ninguém vê seus dados além de você.

***

## Como rodar localmente — tutorial

São **dois servidores em dois terminais**: a **api** (porta 4000) sobe primeiro, o **web** (porta 3000) depois. Requer **Node.js 20+** e um banco **PostgreSQL**.

### Primeira vez (configuração)

**1. Baixe o código**
```bash
git clone https://github.com/gabrielcouto07/FilmJournal
cd FilmJournal
```

**2. Configure e suba a API — terminal 1**
```bash
cd api
cp .env.example .env    # abra o .env e preencha com os seus valores
npm install             # já roda `prisma generate` no final
npm run db:migrate      # cria/atualiza as tabelas no banco
npm run dev
```
Deu certo quando aparecer `Server listening at http://0.0.0.0:4000`.
Teste rápido: abra [http://localhost:4000/health](http://localhost:4000/health) → deve responder `{"status":"ok"}`.

O que cada variável do `api/.env` significa:

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Endereço do PostgreSQL (use o *pooled* na Neon/serverless) |
| `DIRECT_URL` | Endereço direto, sem pool — usado só pelas migrações |
| `PORT` | Porta do servidor (padrão `4000`) |
| `CORS_ORIGIN` | Endereço do frontend (local: `http://localhost:3000`) |
| `JWT_SECRET` | Chave dos tokens de login — gere com `openssl rand -base64 32` |
| `TMDB_API_KEY` | Chave gratuita do [TMDB](https://www.themoviedb.org/settings/api) |
| `APP_OWNER_USERNAME` | Nome de usuário da conta principal |
| `APP_OWNER_PASSWORD` | Senha da conta principal (só no primeiro login) |
| `RESEND_API_KEY` | E-mails do código de troca de senha ([resend.com](https://resend.com)) |

**Sem banco? Suba um com Docker (dentro de `api/`):** `docker compose up -d`

**3. Configure e suba o frontend — terminal 2**
```bash
cd web
cp .env.example .env.local   # só tem NEXT_PUBLIC_API_URL; o padrão local já serve
npm install
npm run dev
```
Deu certo quando aparecer `Local: http://localhost:3000`.

**4. Entre no app**
Abra [http://localhost:3000](http://localhost:3000) → `/login` → usuário e senha configurados no `api/.env`. No primeiro login, a conta principal é criada automaticamente.

### No dia a dia

```bash
# terminal 1              # terminal 2
cd api && npm run dev     cd web && npm run dev
```
A ordem importa: **api primeiro, web depois**. Para parar, `Ctrl+C` nos dois.

### Se algo der errado

| Sintoma | Causa e solução |
|---|---|
| Terminal do web diz `Port 3000 is in use, using 3001` | Sobrou um processo Node antigo segurando a porta. Feche tudo e mate os processos: `taskkill /F /IM node.exe` (Windows) ou `pkill node` (Mac/Linux), e suba de novo. Use sempre a porta 3000 |
| "Failed to fetch" em tudo / páginas quebradas | A api não está de pé (confira `http://localhost:4000/health`) ou o web abriu em outra porta (caso acima) |
| API cai na hora com erro de `.env` | Falta variável obrigatória — confira `DATABASE_URL` e `JWT_SECRET` no `api/.env` |
| `EADDRINUSE: 4000` ao subir a api | Outra api já está rodando — mate os processos Node como acima |
| Erro de tabela/coluna inexistente | Migrações pendentes: `cd api && npm run db:migrate` |
| Login não funciona no primeiro uso | Confira `APP_OWNER_USERNAME`/`APP_OWNER_PASSWORD` no `api/.env` — a conta é criada no primeiro login com essas credenciais |

***

## Publicar na internet

O guia completo — Vercel para o `web`, um host Node para a `api`, Neon para o banco, com todas as variáveis — está em **[DEPLOY.md](DEPLOY.md)**.

***

## Importar seu histórico do Letterboxd

O caminho normal é **pela interface**: exporte seus dados no Letterboxd (Settings → Data → *Export your data*) e envie o ZIP em **Perfil → Importar do Letterboxd**. A importação é segura — reenviar o mesmo export não duplica registros.

Para importações grandes via terminal, os scripts continuam disponíveis dentro de `api/`:

```bash
cd api
npm run import:letterboxd:dry     # simula, sem gravar nada
npm run import:letterboxd -- --yes
npm run validate:letterboxd       # confere o resultado (só leitura)
```

> ⚠️ **Nunca envie os CSVs do export para o git** — eles contêm dados pessoais. Antes da primeira importação real, tire um snapshot/branch do banco no Neon por segurança.

***

## Comandos úteis

Na pasta **`api/`**:

| Comando | O que faz |
|---|---|
| `npm run dev` | Liga a API localmente (porta 4000) |
| `npm run build` / `npm start` | Compila e sobe a versão de produção |
| `npm test` | Roda os testes automáticos (71 testes, 8 suítes) |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run db:migrate` | Aplica as migrações no banco |
| `npm run db:studio` | Abre uma interface visual do banco |
| `npm run import:letterboxd:dry` | Simula a importação do Letterboxd, sem gravar |
| `npm run backfill:tmdb` | Preenche metadados que faltam a partir do TMDB |

Na pasta **`web/`**:

| Comando | O que faz |
|---|---|
| `npm run dev` | Liga o frontend localmente (porta 3000) |
| `npm run build` / `npm start` | Compila e sobe a versão de produção |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run lint` | Roda o ESLint |

***

## Como foi construído

Três decisões guiam o código:

- **Frontend e backend separados de verdade.** O `web` é só interface: autentica com JWT e consome a `api` por HTTP. Toda a matemática das análises vive em módulos "puros" no backend — funções que só recebem dados e devolvem resultados —, uma camada de dados fala com o banco (com cache) e as páginas só exibem o que recebem.
- **Testes de verdade.** `npm test` (em `api/`) roda **71 testes em 8 suítes**: importação do Letterboxd, deduplicação do histórico, paladar, pontos cegos, evolução no tempo, motivos recorrentes, o veredito e o jogo Cine-Detetive. Toda a lógica de análise é coberta.
- **O banco protege o histórico.** As migrações são aditivas por padrão — uma coluna só é removida quando o próprio recurso deixa de existir, nunca para "arrumar" dados. Uma versão nova do app não destrói o histórico de ninguém.

E sobre segurança, em resumo: senhas guardadas com hash `scrypt`, cadastro com limite de tentativas por IP, ações sensíveis exigem a senha atual, e as rotas que alteram dados rejeitam requisições de outros sites (proteção CSRF).

> Todos os detalhes técnicos — árvore de pastas, o formato das migrações, o esquema do banco tabela a tabela, o fluxo do jogo, e as armadilhas conhecidas (compilação em `dev`, portas presas no Windows, colunas órfãs) — estão em **[ARCHITECTURE.md](ARCHITECTURE.md)**.
