// Minimal in-process TTL cache replacing Next.js's `unstable_cache`, which was
// tied to the Next.js request/route cache and isn't available outside it.
// Same call shape (fn, keyParts, { revalidate, tags }) so ported call sites
// barely change, including tag-based invalidation via `revalidateTag`.

type CacheOptions = { revalidate: number; tags?: string[] };

type Entry = { value: unknown; expiresAt: number; tags: string[] };

const store = new Map<string, Entry>();

export function unstableCache<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  keyParts: string[],
  options: CacheOptions,
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const key = [...keyParts, ...args.map((arg) => String(arg))].join(":");
    const now = Date.now();
    const cached = store.get(key);
    if (cached && cached.expiresAt > now) return cached.value as T;
    const value = await fn(...args);
    store.set(key, { value, expiresAt: now + options.revalidate * 1000, tags: options.tags ?? [] });
    return value;
  };
}

/** Evicts every cached entry tagged with `tag` — mirrors Next's `revalidateTag`. */
export function revalidateTag(tag: string): void {
  for (const [key, entry] of store) {
    if (entry.tags.includes(tag)) store.delete(key);
  }
}
