"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelineYear } from "@/lib/analytics/timeline";
import { useSettings } from "@/components/SettingsProvider";
import { accentPalette } from "@/lib/accent";

/** Mantém o mesmo visual dos outros gráficos do Paladar. */
const C = {
  blue: "#74b9ff",
  violet: "#b48ef1",
  neutral: "#6b655c",
  grid: "rgba(255,245,221,0.08)",
  axis: "#8c857e",
} as const;

const AXIS_TICK = { fill: C.axis, fontSize: 11, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: C.grid } as const;

type TooltipRow = { label: string; value: string; color?: string };
function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="surface-raised rounded-xl px-3.5 py-2.5 text-xs shadow-xl">
      <p className="max-w-[13rem] truncate font-black text-white">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-6">
            <span className="text-slate-500">{row.label}</span>
            <span className="font-bold tabular-nums" style={{ color: row.color ?? "#fde68a" }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nota e diferença para o público por ano

/** Nota média à esquerda e distância do público à direita. */
export function RatingLeanTrend({ years }: { years: TimelineYear[] }) {
  const accent = accentPalette(useSettings().settings.accentColor);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={years} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis yAxisId="rating" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
        <YAxis yAxisId="lean" orientation="right" domain={[-2, 2]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${value}`} />
        <ReferenceLine yAxisId="lean" y={0} stroke={C.grid} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ stroke: C.grid, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const year = payload[0].payload as TimelineYear;
            return (
              <ChartTooltip
                title={String(year.year)}
                rows={[
                  { label: "Nota média", value: year.averageRating != null ? `${year.averageRating.toFixed(2)}★` : "—", color: accent.base },
                  { label: "Vs. público", value: year.tasteLean != null ? `${year.tasteLean > 0 ? "+" : ""}${year.tasteLean.toFixed(2)}★` : "—", color: C.blue },
                  { label: "Sessões", value: String(year.sessions) },
                ]}
              />
            );
          }}
        />
        <Line yAxisId="rating" dataKey="averageRating" stroke={accent.base} strokeWidth={2.5} dot={{ r: 3, fill: accent.base, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        <Line yAxisId="lean" dataKey="tasteLean" stroke={C.blue} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: C.blue, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Época dos filmes por ano

/** Ano médio de lançamento dos filmes vistos em cada período. */
export function EraDrift({ years }: { years: TimelineYear[] }) {
  const accent = accentPalette(useSettings().settings.accentColor);
  const values = years.map((year) => year.averageFilmYear).filter((value): value is number => value != null);
  const min = values.length ? Math.floor((Math.min(...values) - 4) / 10) * 10 : 1900;
  const max = values.length ? Math.ceil((Math.max(...values) + 4) / 10) * 10 : 2030;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={years} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis domain={[min, max]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: C.grid, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const year = payload[0].payload as TimelineYear;
            return (
              <ChartTooltip
                title={String(year.year)}
                rows={[
                  { label: "Época média", value: year.averageFilmYear != null ? String(Math.round(year.averageFilmYear)) : "—", color: accent.base },
                  { label: "Sessões", value: String(year.sessions) },
                ]}
              />
            );
          }}
        />
        <Line dataKey="averageFilmYear" stroke={accent.base} strokeWidth={2.5} dot={{ r: 3, fill: accent.base, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Participação dos gêneros por ano

type GenreDriftRow = { year: number; [genre: string]: number | null };

/** Participação dos principais gêneros em cada ano. */
export function GenreShareDrift({ years, genres }: { years: TimelineYear[]; genres: string[] }) {
  const accent = accentPalette(useSettings().settings.accentColor);
  const GENRE_COLORS = [accent.base, C.blue, accent.soft, C.violet, C.neutral];
  const rows: GenreDriftRow[] = years.map((year) => {
    const row: GenreDriftRow = { year: year.year };
    const shares = new Map(year.genreShares.map((item) => [item.genre, item.share]));
    for (const genre of genres) {
      // Sem dados vira lacuna; com dados e sem o gênero vira 0%.
      row[genre] = year.genreShares.length ? Math.round((shares.get(genre) ?? 0) * 100) : null;
    }
    return row;
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(value: number) => `${value}%`} />
          <Tooltip
            cursor={{ stroke: C.grid, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <ChartTooltip
                  title={String(label)}
                  rows={payload
                    .filter((item) => item.value != null)
                    .map((item) => ({ label: String(item.dataKey), value: `${item.value}%`, color: String(item.stroke) }))}
                />
              );
            }}
          />
          {genres.map((genre, index) => (
            <Line
              key={genre}
              dataKey={genre}
              stroke={GENRE_COLORS[index % GENRE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2.5, fill: GENRE_COLORS[index % GENRE_COLORS.length], strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-[11px] font-bold text-slate-500">
        {genres.map((genre, index) => (
          <span key={genre} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GENRE_COLORS[index % GENRE_COLORS.length] }} />
            {genre}
          </span>
        ))}
      </div>
    </div>
  );
}
