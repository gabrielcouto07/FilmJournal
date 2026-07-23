import type { LogEntry, Movie } from "@prisma/client";

export type MovieWithLogs = Movie & { logs: LogEntry[] };
export type LogWithMovie = LogEntry & { movie: Movie };
