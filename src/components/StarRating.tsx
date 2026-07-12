"use client";

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
      {fill !== "empty" && <span className="absolute inset-0 text-emerald-300" style={fill === "half" ? { clipPath: "inset(0 50% 0 0)" } : undefined}>★</span>}
    </span>
  );
}

export default function StarRating({ value = 0, onChange, readOnly = false, size = "md", showValue = false }: StarRatingProps) {
  const rating = value ?? 0;

  return (
    <div className={`flex items-center gap-1 ${sizes[size]}`} aria-label={`Rating: ${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fullValue = index + 1;
        const fill = rating >= fullValue ? "full" : rating >= fullValue - 0.5 ? "half" : "empty";
        if (readOnly) return <Star key={fullValue} fill={fill} />;

        return (
          <button
            key={fullValue}
            type="button"
            className="relative rounded-sm transition hover:scale-110"
            aria-label={`Set rating to ${fullValue - 0.5} or ${fullValue} stars`}
            onClick={(event) => {
              if (!onChange) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              onChange(event.clientX - bounds.left < bounds.width / 2 ? fullValue - 0.5 : fullValue);
            }}
          >
            <Star fill={fill} />
          </button>
        );
      })}
      {showValue && <span className="ml-1 text-xs font-bold tabular-nums text-emerald-200">{rating.toFixed(1)}</span>}
    </div>
  );
}
