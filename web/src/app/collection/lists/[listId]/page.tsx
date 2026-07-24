"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ArtworkImage from "@/components/ArtworkImage";
import { getPosterUrl } from "@/lib/tmdb";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  preferredPosterPath: string | null;
};

type List = {
  name: string;
  description: string | null;
  movies: Array<{
    movie: Movie;
  }>;
};

export default function MovieListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState("");
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadList() {
      const { listId } = await params;
      setCurrentListId(listId);
      const response = await fetch(`/api/lists/${listId}`);

      if (!response.ok) {
        setError("Lista não encontrada.");
        return;
      }

      const data = await response.json();
      setList(data.list);
    }

    loadList();
  }, [params]);

  async function removeMovie(movieId: string) {
    if (!currentListId) return;

    setRemovingId(movieId);
    const response = await fetch(
      `/api/lists/${currentListId}/movies?movieId=${encodeURIComponent(movieId)}`,
      { method: "DELETE" },
    );

    if (response.ok) {
      setList((current) => current
        ? { ...current, movies: current.movies.filter(({ movie }) => movie.id !== movieId) }
        : current);
    }

    setRemovingId(null);
  }

  if (error) {
    return <main className="page-shell">{error}</main>;
  }

  if (!list) {
    return <main className="page-shell">Carregando lista…</main>;
  }

  return (
    <main className="page-shell max-w-6xl space-y-8">
      <Link
        href="/collection/lists"
        className="text-sm font-bold text-amber-300"
      >
        ← Voltar para minhas listas
      </Link>

      <header>
        <p className="eyebrow">Lista pessoal</p>
        <h1 className="display-title mt-2 text-4xl">{list.name}</h1>

        {list.description && (
          <p className="mt-3 text-slate-400">{list.description}</p>
        )}

        <p className="mt-3 text-sm text-slate-500">
          {list.movies.length} filmes
        </p>
      </header>

      {list.movies.length === 0 ? (
        <p className="surface rounded-2xl p-6 text-slate-400">
          Esta lista ainda não tem filmes.
        </p>
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {list.movies.map(({ movie }) => (
            <article key={movie.id} className="surface overflow-hidden rounded-xl transition hover:border-amber-300/40">
              <Link href={`/film/${movie.id}`} className="block">
                <div className="aspect-[2/3] bg-white/[0.04]">
                  <ArtworkImage
                    src={getPosterUrl(movie.preferredPosterPath)}
                    fallbackSrc={getPosterUrl(movie.posterPath)}
                    movieId={movie.id}
                    alt={`Pôster de ${movie.title}`}
                    title={movie.title}
                    className="h-full w-full"
                    sizes="(max-width: 640px) 45vw, 190px"
                  />
                </div>
                <div className="p-3">
                  <h2 className="truncate font-bold text-white">{movie.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{movie.year ?? "Ano desconhecido"}</p>
                </div>
              </Link>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void removeMovie(movie.id);
                  }}
                  disabled={removingId === movie.id}
                  className="w-full border-t border-white/[0.07] px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {removingId === movie.id ? "Removendo…" : "Remover da lista"}
                </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
