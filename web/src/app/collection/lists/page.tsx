"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import ArtworkImage from "@/components/ArtworkImage";
import { getPosterUrl } from "@/lib/tmdb";

type MovieList = {
  id: string;
  name: string;
  description: string | null;
  _count: {
    movies: number;
  };
  movies: Array<{
    movie: {
      id: string;
      title: string;
      posterPath: string | null;
      preferredPosterPath: string | null;
    };
  }>;
};

export default function ListsPage() {
  const [lists, setLists] = useState<MovieList[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function loadLists() {
    const response = await fetch("/api/lists");
    const data = await response.json();
    setLists(data.lists ?? []);
  }

  useEffect(() => {
    loadLists();
  }, []);

  async function createList(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) return;

    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) return;

    setName("");
    setDescription("");
    await loadLists();
  }

  return (
    <main className="page-shell max-w-5xl space-y-8">
      <nav
        className="flex flex-wrap gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1"
        aria-label="Seções da coleção"
      >
        <Link
          href="/collection"
          className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 transition hover:text-white"
        >
          ★ Favoritos
        </Link>
        <Link
          href="/collection?tab=assistir"
          className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 transition hover:text-white"
        >
          ▸ Para assistir
        </Link>
        <Link
          href="/collection/lists"
          aria-current="page"
          className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1a1400]"
        >
          ▣ Coleções
        </Link>
      </nav>

      <header>
        <p className="eyebrow">Coleção pessoal</p>
        <h1 className="display-title mt-2 text-4xl">Coleções</h1>
      </header>

      <form onSubmit={createList} className="surface space-y-4 rounded-2xl p-5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome da lista"
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white"
        />

        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descrição opcional"
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white"
        />

        <button type="submit" className="accent-button">
          Criar lista
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/collection/lists/${list.id}`}
            className="surface rounded-2xl p-5 transition hover:border-amber-300/40"
          >
            <h2 className="text-xl font-black text-white">{list.name}</h2>
            {list.description && (
              <p className="mt-2 text-sm text-slate-400">{list.description}</p>
            )}
            {list.movies.length > 0 && (
              <div className="mt-4 flex -space-x-3">
                {list.movies.map(({ movie }) => (
                  <span
                    key={movie.id}
                    className="h-16 w-11 overflow-hidden rounded-lg border-2 border-[#141414] bg-white/[0.04]"
                    title={movie.title}
                  >
                    <ArtworkImage
                      src={getPosterUrl(movie.preferredPosterPath)}
                      fallbackSrc={getPosterUrl(movie.posterPath)}
                      movieId={movie.id}
                      alt={`Pôster de ${movie.title}`}
                      title={movie.title}
                      className="h-full w-full"
                      sizes="44px"
                    />
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-slate-500">
              {list._count.movies} filmes
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
