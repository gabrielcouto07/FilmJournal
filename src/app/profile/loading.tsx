export default function ProfileLoading() {
  return (
    <main className="page-shell max-w-5xl space-y-8" aria-busy="true" aria-label="Carregando perfil">
      <div className="surface rounded-[2rem] p-7 sm:p-10">
        <div className="skeleton-bg h-3 w-24 rounded-full" />
        <div className="skeleton-bg mt-5 h-12 w-2/3 rounded-2xl" />
        <div className="skeleton-bg mt-4 h-4 w-40 rounded-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton-bg h-9 w-28 rounded-full" />)}
      </div>
      <div className="surface rounded-[1.5rem] p-6 sm:p-8 space-y-5">
        <div className="skeleton-bg h-5 w-40 rounded-full" />
        <div className="skeleton-bg h-24 w-24 rounded-full" />
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton-bg h-11 w-full rounded-xl" />)}
      </div>
    </main>
  );
}
