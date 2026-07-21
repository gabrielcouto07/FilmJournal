"use client";

import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type {
  ContrarianPoint,
  CountryCount,
  DecadeBucket,
  GenreCount,
  RuntimeBucket,
} from "@/lib/analytics/palate";

/**
 * Shared chart theme. Sequential magnitude uses the app's gold accent; the
 * contrarian scatter is diverging — warm gold when you out-rate the crowd, cool
 * blue when you under-rate it, neutral when you agree. Axes, grid and tooltip
 * are themed to the surface tokens (never default Recharts).
 */
const C = {
  gold: "#f5c518",
  goldSoft: "#f8c970",
  blue: "#74b9ff",
  neutral: "#6b655c",
  grid: "rgba(255,245,221,0.08)",
  axis: "#8c857e",
} as const;

const AXIS_TICK = { fill: C.axis, fontSize: 11, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: C.grid } as const;

/** The film-country codes we can name; everything else shows its raw ISO code. */
const COUNTRY_NAMES: Record<string, string> = {
  US: "Estados Unidos", GB: "Reino Unido", FR: "França", JP: "Japão", KR: "Coreia do Sul",
  BR: "Brasil", DE: "Alemanha", IT: "Itália", ES: "Espanha", CA: "Canadá", AU: "Austrália",
  CN: "China", HK: "Hong Kong", IN: "Índia", SE: "Suécia", DK: "Dinamarca", RU: "Rússia",
  MX: "México", AR: "Argentina", IE: "Irlanda", NZ: "Nova Zelândia", BE: "Bélgica",
  NL: "Países Baixos", NO: "Noruega", PL: "Polônia", TW: "Taiwan", TH: "Tailândia",
  IR: "Irã", FI: "Finlândia", CZ: "Chéquia", AT: "Áustria", PT: "Portugal",
};
const countryLabel = (code: string) => COUNTRY_NAMES[code] ?? code;

type TooltipRow = { label: string; value: string };
function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="surface-raised rounded-xl px-3.5 py-2.5 text-xs shadow-xl">
      <p className="max-w-[13rem] truncate font-black text-white">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-6">
            <span className="text-slate-500">{row.label}</span>
            <span className="font-bold tabular-nums text-amber-200">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------- contrarian scatter

/** Diverging color by how far a film sits from the agreement line. */
function contrarianColor(delta: number): string {
  if (delta >= 0.5) return C.gold;
  if (delta <= -0.5) return C.blue;
  return C.neutral;
}

export function ContrarianScatter({ points }: { points: ContrarianPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
        <ReferenceLine
          segment={[{ x: 0, y: 0 }, { x: 5, y: 5 }]}
          stroke={C.axis}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          ifOverflow="hidden"
        />
        <XAxis
          type="number"
          dataKey="crowdRating"
          domain={[0, 5]}
          ticks={[0, 1, 2, 3, 4, 5]}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
          label={{ value: "Nota do público (0–5)", position: "bottom", offset: 12, fill: C.axis, fontSize: 11, fontWeight: 700 }}
        />
        <YAxis
          type="number"
          dataKey="userRating"
          domain={[0, 5]}
          ticks={[0, 1, 2, 3, 4, 5]}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
          label={{ value: "Sua nota", angle: -90, position: "insideLeft", offset: 16, fill: C.axis, fontSize: 11, fontWeight: 700 }}
        />
        <ZAxis range={[46, 46]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: C.grid }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as ContrarianPoint;
            const gap = point.delta > 0 ? `+${point.delta}` : `${point.delta}`;
            return (
              <ChartTooltip
                title={`${point.title}${point.year ? ` (${point.year})` : ""}`}
                rows={[
                  { label: "Sua nota", value: point.userRating.toFixed(1) },
                  { label: "Público", value: point.crowdRating.toFixed(1) },
                  { label: "Diferença", value: gap },
                ]}
              />
            );
          }}
        />
        <Scatter data={points} fillOpacity={0.82} isAnimationActive={false}>
          {points.map((point) => (
            <Cell key={point.id} fill={contrarianColor(point.delta)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------- decade histogram

export function DecadeHistogram({ data }: { data: DecadeBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const bucket = payload[0].payload as DecadeBucket;
            return <ChartTooltip title={bucket.label} rows={[{ label: "Filmes", value: String(bucket.count) }]} />;
          }}
        />
        <Bar dataKey="count" fill={C.gold} radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------- country spread

export function CountrySpread({ data }: { data: CountryCount[] }) {
  const height = Math.max(200, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="code"
          tickFormatter={countryLabel}
          tick={{ ...AXIS_TICK, fill: "#c8c2b4" }}
          axisLine={AXIS_LINE}
          tickLine={false}
          width={116}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as CountryCount;
            return <ChartTooltip title={countryLabel(row.code)} rows={[{ label: "Filmes", value: String(row.count) }]} />;
          }}
        />
        <Bar dataKey="count" fill={C.gold} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------- genre radar

export function GenreRadar({ data }: { data: GenreCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }} outerRadius="72%">
        <PolarGrid stroke={C.grid} />
        <PolarAngleAxis dataKey="genre" tick={{ fill: "#c8c2b4", fontSize: 11, fontWeight: 700 }} />
        <PolarRadiusAxis tick={false} axisLine={false} tickCount={4} angle={90} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as GenreCount;
            return <ChartTooltip title={row.genre} rows={[{ label: "Filmes", value: String(row.count) }]} />;
          }}
        />
        <Radar dataKey="count" stroke={C.gold} fill={C.gold} fillOpacity={0.28} strokeWidth={2} isAnimationActive={false} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------ runtime distribution

export function RuntimeDistribution({ data }: { data: RuntimeBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const bucket = payload[0].payload as RuntimeBucket;
            return (
              <ChartTooltip
                title={`${bucket.label} min`}
                rows={[
                  { label: "Filmes", value: String(bucket.count) },
                  ...(bucket.sweetSpot ? [{ label: "Faixa preferida", value: "★" }] : []),
                ]}
              />
            );
          }}
        />
        {/* The modal bucket keeps the gold accent; the rest recede to muted. */}
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
          {data.map((bucket) => (
            <Cell key={bucket.label} fill={bucket.sweetSpot ? C.gold : "rgba(248,201,112,0.28)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
