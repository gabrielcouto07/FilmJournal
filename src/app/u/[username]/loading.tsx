export default function PublicProfileLoading() {
  return (
    <main className="page-shell space-y-12" aria-busy="true" aria-label="Carregando perfil público">
      <div className="surface rounded-[2rem] p-7 sm:p-10">
        <div className="flex items-center gap-5">
          <div className="skeleton-bg h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton-bg h-3 w-24 rounded-full" />
            <div className="skeleton-bg h-10 w-1/2 rounded-2xl" />
            <div className="skeleton-bg h-4 w-32 rounded-full" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton-bg h-20 rounded-2xl" />)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => <div key={index} className="skeleton-bg aspect-[2/3] rounded-[1.15rem]" />)}
      </div>
    </main>
  );
}
