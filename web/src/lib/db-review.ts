/** Tipos da resposta de GET /admin/db-review (a auditoria roda no backend). */

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
