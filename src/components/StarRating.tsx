"use client";

import { useSettings } from "./SettingsProvider";

type StarRatingProps = {
  value?: number | null;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
};

const sizes = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };

function Star({ fill }: { fill: "empty" | "half" | "full" }) {
  return (
    <span className="relative inline-block h-[1em] w-[.95em] leading-none" aria-hidden="true">
      <span className="absolute inset-0 text-white/15">★</span>
      {fill !== "empty" && <span className="absolute inset-0" style={{ color: "var(--accent)", ...(fill === "half" ? { clipPath: "inset(0 50% 0 0)" } : {}) }}>★</span>}
    </span>
  );
}

export default function StarRating({ value = 0, onChange, readOnly = false, size = "md", showValue = false }: StarRatingProps) {
  const { settings } = useSettings();
  const rating = value ?? 0;

  return (
    <div className={`flex items-center gap-1 ${sizes[size]}`} aria-label={`Nota: ${rating.toFixed(1)} de 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fullValue = index + 1;
        const fill = rating >= fullValue ? "full" : rating >= fullValue - 0.5 ? "half" : "empty";
        if (readOnly) return <Star key={fullValue} fill={fill} />;

        return (
          <button
            key={fullValue}
            type="button"
            className="relative rounded-sm transition hover:scale-110"
            aria-label={settings.allowHalfStars ? `Definir nota como ${fullValue - 0.5} ou ${fullValue} estrelas` : `Definir nota como ${fullValue} estrelas`}
            onClick={(event) => {
              if (!onChange) return;
              if (!settings.allowHalfStars) { onChange(fullValue); return; }
              const bounds = event.currentTarget.getBoundingClientRect();
              onChange(event.clientX - bounds.left < bounds.width / 2 ? fullValue - 0.5 : fullValue);
            }}
          >
            <Star fill={fill} />
          </button>
        );
      })}
      {showValue && <span className="ml-1 text-xs font-bold tabular-nums" style={{ color: "var(--accent)" }}>{rating.toFixed(1)}</span>}
    </div>
  );
}
