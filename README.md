# 🎬 FilmJournal

Uma ferramenta pessoal que transforma seu histórico de filmes num autorretrato do seu gosto.

Você registra o que assiste e dá suas notas. O app faz o resto: mostra que tipo de espectador você é, como seu gosto mudou com o tempo e o que você ainda não descobriu no cinema.

Feito com **Next.js 15** · **TypeScript** · **Tailwind CSS** · **Prisma** · **PostgreSQL** · **NextAuth.js**

***

## O que ele faz

O app tem quatro partes. Todas funcionam sozinhas, a partir dos filmes que você registra e avalia.

### 👅 Paladar
Mostra quem você é como espectador. Quais décadas, países e gêneros dominam seus filmes. Quais diretores você sempre revisita. E o mais divertido: a que distância suas notas ficam da opinião do público — os filmes que você ama e o mundo não, e vice-versa.

### 📈 Evolução
Mostra como seu gosto mudou ano a ano. Se suas notas ficaram mais generosas ou mais exigentes. Se você mergulhou em filmes antigos ou ficou mais contemporâneo. Quais gêneros ganharam e perderam espaço. O app ainda escreve, em uma frase, a maior mudança de cada ano. E os seus filmes favoritos revelam temas que se repetem — os "motivos recorrentes" do seu gosto.

### 🧭 Descobrir + Roleta
Mostra o que você está deixando de ver. O Descobrir compara seu histórico com o cinema em geral e aponta seus pontos cegos: décadas, países e gêneros que faltam no seu mapa — sempre explicando por que cada sugestão apareceu. E quando bater a indecisão, a Roleta sorteia o próximo filme por você.

### 🎮 Jogar
Um jogo rápido: adivinhe o filme pelo elenco. Os nomes aparecem aos poucos e você tenta acertar o título com o mínimo de dicas. Dá para jogar com os seus próprios filmes ou com filmes populares.

***

## Como funciona por baixo

Sem segredo:

- **Dois caminhos para começar.** Quem já usa o Letterboxd importa o histórico completo de uma vez (com teste prévio, sem risco). Quem está começando do zero faz um tour guiado e escolhe 5 filmes favoritos — o suficiente para as primeiras análises acenderem.
- **De onde vêm os dados dos filmes.** As informações de cada filme (pôster, elenco, gênero, país, notas do público) vêm do [TMDB](https://www.themoviedb.org/), um banco de dados aberto de cinema. Suas notas e seu histórico são só seus.
- **Tudo é privado.** O app é feito para uma pessoa: você. Não há feed, seguidores nem páginas públicas. Ninguém vê seus dados além de você.

***

## Como rodar localmente

Passos para ter o app funcionando no seu computador.

### 1. Baixar o código e instalar as dependências
```bash
git clone https://github.com/gabrielcouto07/FilmJournal
cd FilmJournal
npm install
```

### 2. Configurar as variáveis de ambiente
Copie o arquivo de exemplo e preencha com os seus valores:
```bash
cp .env.example .env.local
```

O que cada variável significa:

- `DATABASE_URL` — endereço do seu banco de dados PostgreSQL
- `DIRECT_URL` — endereço direto (sem pool) do mesmo banco
- `NEXTAUTH_URL` — endereço do app (localmente, `http://localhost:3000`)
- `NEXTAUTH_SECRET` — chave secreta do login (gere com `openssl rand -base64 32`)
- `TMDB_API_KEY` — chave gratuita do [TMDB](https://www.themoviedb.org/settings/api)
- `APP_OWNER_USERNAME` — nome de usuário da conta principal
- `APP_OWNER_PASSWORD` — senha da conta principal

O Next.js lê o `.env.local`. Se o Prisma na sua máquina ler apenas `.env`, duplique os mesmos valores num `.env` local. Nunca envie esses arquivos para o git — os dois já são ignorados.

**Sem banco de dados? Suba um com Docker:**
```bash
docker run -d --name filmjournal-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=filmjournal \
  -p 5432:5432 postgres:16
```
E use `DATABASE_URL="postgresql://postgres:dev@localhost:5432/filmjournal"` no `.env.local`.

### 3. Criar as tabelas no banco
```bash
npm run db:push
```

### 4. Ligar o app
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) e entre em `/login` com o usuário e a senha configurados acima. No primeiro login, a conta principal é criada automaticamente.

***

## Publicar na internet (Vercel + Neon, de graça)

1. Crie um banco PostgreSQL gratuito no [neon.tech](https://neon.tech).
2. Importe este repositório no [vercel.com](https://vercel.com).
3. No painel da Vercel, cadastre as mesmas variáveis de ambiente da seção anterior — usando o endereço *pooled* do Neon em `DATABASE_URL` e o endereço direto em `DIRECT_URL`.
4. Com um banco novo, crie as tabelas uma única vez a partir do seu terminal (com as variáveis do Neon carregadas):
```bash
npx prisma migrate deploy
```

Para um banco antigo que foi criado com `db push`, marque a base uma vez e depois aplique o resto:
```bash
npx prisma migrate resolve --applied 20260721000000_init
npx prisma migrate deploy
```

`APP_OWNER_USERNAME` e `APP_OWNER_PASSWORD` servem só para criar a conta principal na primeira vez. Depois disso, a senha de bootstrap pode ser trocada ou removida — mantenha apenas o `APP_OWNER_USERNAME` configurado.

***

## Importar seu histórico do Letterboxd

A importação é segura: dá para testar antes sem gravar nada, e rodar de novo não duplica registros.

1. **Exporte no Letterboxd:** Settings → Data → *Export your data*. Baixe o ZIP e descompacte.
2. **Coloque os arquivos CSV na raiz do projeto.** O importador aceita qualquer subconjunto destes (os que faltarem são ignorados): `diary.csv` · `reviews.csv` · `ratings.csv` · `watched.csv` · `watchlist.csv` · `profile.csv` · `likes/films.csv` (mantenha a subpasta `likes/`).
3. **Teste primeiro, sem gravar nada.** Mostra em qual banco vai gravar e o que *seria* criado:
```bash
npm run import:letterboxd:dry
```
4. **Rode a importação de verdade.** Ela exige confirmação explícita:
```bash
npm run import:letterboxd -- --yes
```
5. **Confira o resultado** (só leitura, compara o banco com o export):
```bash
npm run validate:letterboxd
```
6. **Apague os CSVs da raiz do projeto** quando terminar.

> ⚠️ **Nunca envie os CSVs do export para o git** — eles contêm dados pessoais. O `.gitignore` já os exclui, mas confira o `git status` antes de commitar. Antes da primeira importação real, tire um snapshot/branch do banco no Neon por segurança.

***

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Liga o app localmente |
| `npm run build` | Gera a versão de produção |
| `npm test` | Roda os testes automáticos |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run db:push` | Sincroniza o esquema com o banco (desenvolvimento) |
| `npm run db:migrate` | Aplica as migrações (produção) |
| `npm run db:studio` | Abre uma interface visual do banco |

***

## Como foi construído

Três decisões guiam o código:

- **Três camadas bem separadas.** Toda a matemática das análises vive em módulos "puros" — funções que só recebem dados e devolvem resultados, sem tocar em banco ou internet. Uma camada de dados fala com o banco (com cache). E as páginas só exibem o que recebem. Isso deixa cada parte simples de entender e de testar.
- **Testes de verdade.** `npm test` roda 52 testes automáticos em 7 suítes: importação do Letterboxd, deduplicação do histórico, paladar, pontos cegos, pontuação do jogo, evolução no tempo e motivos recorrentes. Toda a lógica de análise é coberta.
- **O banco nunca anda para trás.** As migrações do banco de dados só *adicionam* — nunca apagam uma coluna com dados. Uma versão nova do app nunca destrói o histórico de ninguém.

E sobre segurança, em resumo: senhas guardadas com hash `scrypt`, cadastro com limite de tentativas por IP, ações sensíveis exigem a senha atual, e as rotas que alteram dados rejeitam requisições de outros sites (proteção CSRF).
