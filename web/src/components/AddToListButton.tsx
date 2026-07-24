"use client";

import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type MovieList = {
  id: string;
  name: string;
  _count: {
    movies: number;
  };
  containsMovie: boolean;
};

export default function AddToListButton({
  movieId,
}: {
  movieId: string;
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MovieList[]>([]);
  const [message, setMessage] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function openLists() {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (bounds) {
      setMenuPosition({
        top: bounds.bottom + window.scrollY + 8,
        left: Math.max(16, bounds.right + window.scrollX - 256),
      });
    }

    setOpen(true);

    setMessage("");
    const response = await apiFetch(`/lists?movieId=${encodeURIComponent(movieId)}`);
    const data = await response.json();

    setLists(data.lists ?? []);
  }

  async function addToList(listId: string) {
    const list = lists.find((item) => item.id === listId);
    if (!list) return;

    if (list.containsMovie) {
      setMessage(`Filme já adicionado na ${list.name}.`);
      return;
    }

    const response = await apiFetch(`/lists/${listId}/movies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ movieId }),
    });

    const payload = await response.json() as { message?: string; error?: string };
    if (response.ok) {
      setLists((items) => items.map((item) => (
        item.id === listId
          ? { ...item, containsMovie: true, _count: { movies: item._count.movies + 1 } }
          : item
      )));
      setMessage(payload.message ?? `Filme adicionado na ${list.name}.`);
    } else {
      setMessage(payload.error ?? "Não foi possível adicionar o filme.");
    }
  }

  return (
    <div className="relative z-[70]">
      <button
        type="button"
        ref={buttonRef}
        onClick={openLists}
        className="quiet-button"
      >
        ＋ Adicionar à lista
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="absolute z-[100] w-64 rounded-2xl border border-white/10 bg-[#181818] p-4 shadow-2xl"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-white">Adicionar à lista</h3>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>

          {lists.length === 0 ? (
            <p className="text-sm text-slate-400">
              Você ainda não criou nenhuma lista.
            </p>
          ) : (
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => addToList(list.id)}
                  className="block w-full rounded-xl bg-white/5 px-3 py-2 text-left text-sm text-white hover:bg-amber-300/20"
                >
                  {list.name}
                </button>
              ))}
            </div>
          )}

          {message && (
            <p className="mt-3 text-xs text-amber-200">{message}</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
