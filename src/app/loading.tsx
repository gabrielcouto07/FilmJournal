export default function Loading() {
  return (
    <div className="page-shell space-y-14 animate-pulse">
      {/* Hero skeleton */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.45fr)]">
        <div className="skeleton-bg surface min-h-[31rem] rounded-[2rem]" />
        <div className="surface rounded-[2rem] skeleton-bg" />
      </div>
      {/* Section skeleton rows */}
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-4">
          <div className="h-6 w-48 rounded-full skeleton-bg" />
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-52 w-36 shrink-0 rounded-2xl skeleton-bg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
