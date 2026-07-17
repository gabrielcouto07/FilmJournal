import { NextResponse } from "next/server";
import { searchTmdbPeople, TmdbError } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ people: [] });
  }

  try {
    const people = await searchTmdbPeople(query, "pt-BR");
    return NextResponse.json({
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        department: person.known_for_department ?? null,
        knownFor: (person.known_for ?? [])
          .map((item) => item.title || item.name)
          .filter(Boolean)
          .slice(0, 2),
      })),
    });
  } catch (error) {
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message, status: error.status }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível. Tente novamente.", status: 502 },
      { status: 502 },
    );
  }
}
