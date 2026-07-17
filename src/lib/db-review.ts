import { prisma } from "./prisma";

// Shared logic for the admin database-review surface. Used both by the
// /admin/database page (direct call) and the /api/admin/db-review route (JSON).

export type ReviewSample = { id: string; label: string };

export type IntegrityIssue = {
  key: string;
  label: string;
  count: number;
  samples: ReviewSample[];
  severity: "ok" | "warn" | "fail";
};

export type ReadinessStatus = "ok" | "warn" | "fail";
export type ReadinessItem = { label: string; status: ReadinessStatus; detail: string };

export type SchemaField = { field: string; type: string; required: boolean; description: string };
export type SchemaModel = { model: string; fields: SchemaField[] };

export type DatabaseReview = {
  summary: {
    totalMovies: number;
    totalLogs: number;
    ratedLogs: number;
    moviesWithoutTmdb: number;
    watchlistMovies: number;
    favoriteMovies: number;
    users: number;
    logsWithUser: number;
  };
  integrity: IntegrityIssue[];
  schema: SchemaModel[];
  readiness: ReadinessItem[];
};

const SCHEMA: SchemaModel[] = [
  {
    model: "Movie",
    fields: [
      { field: "id", type: "String (cuid)", required: true, description: "Identificador único do filme" },
      { field: "tmdbId", type: "Int?", required: false, description: "ID no TMDB (único) para sincronização de metadados" },
      { field: "title", type: "String", required: true, description: "Título do filme" },
      { field: "year", type: "Int?", required: false, description: "Ano de lançamento" },
      { field: "posterPath", type: "String?", required: false, description: "Caminho do pôster no TMDB" },
      { field: "backdropPath", type: "String?", required: false, description: "Caminho da imagem de fundo" },
      { field: "overview", type: "String?", required: false, description: "Sinopse" },
      { field: "runtime", type: "Int?", required: false, description: "Duração em minutos" },
      { field: "genres", type: "String?", required: false, description: "Gêneros separados por vírgula" },
      { field: "directors", type: "String?", required: false, description: "Diretores separados por vírgula" },
      { field: "cast", type: "String?", required: false, description: "Elenco principal separado por vírgula" },
      { field: "tmdbRating", type: "Float?", required: false, description: "Nota média no TMDB" },
    ],
  },
  {
    model: "LogEntry",
    fields: [
      { field: "id", type: "String (cuid)", required: true, description: "Identificador único da entrada de diário" },
      { field: "movieId", type: "String", required: true, description: "Filme relacionado (FK → Movie)" },
      { field: "userId", type: "String?", required: false, description: "Usuário dono da entrada (FK → User)" },
      { field: "sourceKey", type: "String", required: true, description: "Chave de origem única (idempotência de importação)" },
      { field: "dedupeKey", type: "String?", required: false, description: "Identidade do evento de exibição (deduplicação)" },
      { field: "watchedAt", type: "DateTime?", required: false, description: "Data em que o filme foi assistido" },
      { field: "rating", type: "Float?", required: false, description: "Nota atribuída (0,5 a 5)" },
      { field: "review", type: "String?", required: false, description: "Texto da resenha" },
      { field: "rewatch", type: "Boolean", required: true, description: "Se foi uma reexibição" },
    ],
  },
  {
    model: "User",
    fields: [
      { field: "id", type: "String (cuid)", required: true, description: "Identificador único do usuário" },
      { field: "username", type: "String", required: true, description: "Nome de usuário (único)" },
      { field: "email", type: "String", required: true, description: "E-mail (único)" },
      { field: "passwordHash", type: "String", required: true, description: "Hash da senha (PBKDF2 com salt)" },
      { field: "displayName", type: "String?", required: false, description: "Nome de exibição" },
      { field: "role", type: "String", required: true, description: 'Papel do usuário (ex.: "OWNER", "USER")' },
    ],
  },
];

export async function getDatabaseReview(): Promise<DatabaseReview> {
  const [
    totalMovies,
    totalLogs,
    ratedLogs,
    moviesWithoutTmdb,
    watchlistMovies,
    favoriteMovies,
    users,
    logsWithUser,
    nullPosterCount,
    nullPosterSample,
    nullTmdbSample,
    nullWatchedCount,
    nullWatchedSample,
    nullRatingCount,
    duplicateDedupe,
  ] = await Promise.all([
    prisma.movie.count(),
    prisma.logEntry.count(),
    prisma.logEntry.count({ where: { rating: { not: null } } }),
    prisma.movie.count({ where: { tmdbId: null } }),
    prisma.userMovie.count({ where: { watchlist: true } }),
    prisma.userMovie.count({ where: { favoriteRank: { not: null } } }),
    prisma.user.count(),
    prisma.logEntry.count({ where: { userId: { not: null } } }),
    prisma.movie.count({ where: { posterPath: null } }),
    prisma.movie.findMany({ where: { posterPath: null }, select: { id: true, title: true, year: true }, take: 5 }),
    prisma.movie.findMany({ where: { tmdbId: null }, select: { id: true, title: true, year: true }, take: 5 }),
    prisma.logEntry.count({ where: { watchedAt: null } }),
    prisma.logEntry.findMany({ where: { watchedAt: null }, select: { id: true, movie: { select: { title: true } } }, take: 5 }),
    prisma.logEntry.count({ where: { rating: null } }),
    prisma.logEntry.groupBy({
      by: ["dedupeKey"],
      where: { dedupeKey: { not: null } },
      _count: { dedupeKey: true },
      having: { dedupeKey: { _count: { gt: 1 } } },
    }),
  ]);

  const integrity: IntegrityIssue[] = [
    {
      key: "nullPoster",
      label: "Filmes sem pôster (posterPath nulo)",
      count: nullPosterCount,
      severity: nullPosterCount > 0 ? "warn" : "ok",
      samples: nullPosterSample.map((m) => ({ id: m.id, label: `${m.title}${m.year ? ` (${m.year})` : ""}` })),
    },
    {
      key: "nullTmdb",
      label: "Filmes sem TMDB ID (não sincronizáveis)",
      count: moviesWithoutTmdb,
      severity: moviesWithoutTmdb > 0 ? "warn" : "ok",
      samples: nullTmdbSample.map((m) => ({ id: m.id, label: `${m.title}${m.year ? ` (${m.year})` : ""}` })),
    },
    {
      key: "nullWatchedAt",
      label: "Entradas de diário sem data (watchedAt nulo)",
      count: nullWatchedCount,
      severity: nullWatchedCount > 0 ? "warn" : "ok",
      samples: nullWatchedSample.map((l) => ({ id: l.id, label: l.movie?.title ?? "—" })),
    },
    {
      key: "nullRating",
      label: "Entradas de diário sem nota (rating nulo)",
      count: nullRatingCount,
      severity: nullRatingCount > 0 ? "warn" : "ok",
      samples: [],
    },
    {
      key: "duplicateDedupe",
      label: "Violações de dedupeKey duplicado (esperado: 0)",
      count: duplicateDedupe.length,
      severity: duplicateDedupe.length > 0 ? "fail" : "ok",
      samples: duplicateDedupe.slice(0, 5).map((d) => ({ id: d.dedupeKey ?? "—", label: d.dedupeKey ?? "—" })),
    },
  ];

  const migrated = users > 0 && watchlistMovies + favoriteMovies > 0;
  const allLogsLinked = totalLogs === 0 || logsWithUser === totalLogs;

  const readiness: ReadinessItem[] = [
    { label: "Modelo User com senha protegida (PBKDF2)", status: "ok", detail: "Implementado em src/lib/password.ts (PBKDF2 + salt)." },
    { label: "Sessões com NextAuth v5", status: "ok", detail: "Credentials provider + JWT (src/auth.ts, src/auth.config.ts)." },
    { label: "/admin protegido por middleware", status: "ok", detail: "src/middleware.ts redireciona não autenticados para /login." },
    {
      label: "Vínculo de usuário em UserMovie e LogEntry",
      status: migrated && allLogsLinked ? "ok" : "warn",
      detail: migrated && allLogsLinked
        ? `${logsWithUser} de ${totalLogs} entradas de diário vinculadas a um usuário.`
        : "Pendente: rodar migrate-user-data.ts para popular UserMovie e vincular LogEntry.",
    },
    {
      label: "Rota de importação Letterboxd com guarda de autenticação",
      status: "warn",
      detail: "Pendente: /api/import/letterboxd ainda está com TODO de proteção (scaffold da Fase 2).",
    },
    { label: "Registro público de usuários", status: "fail", detail: "Não implementado (intencional nesta fase)." },
    {
      label: "Isolamento de biblioteca por usuário",
      status: migrated ? "warn" : "fail",
      detail: migrated
        ? "Estrutura pronta (UserMovie por usuário); modo multiusuário público ainda não habilitado."
        : "Não implementado até a migração de userId ser executada.",
    },
  ];

  return {
    summary: {
      totalMovies,
      totalLogs,
      ratedLogs,
      moviesWithoutTmdb,
      watchlistMovies,
      favoriteMovies,
      users,
      logsWithUser,
    },
    integrity,
    schema: SCHEMA,
    readiness,
  };
}
