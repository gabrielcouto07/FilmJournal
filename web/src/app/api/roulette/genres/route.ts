import { NextResponse } from "next/server";
import { getTmdbGenres, TmdbError } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const genres = await getTmdbGenres("pt-BR");
    const response = NextResponse.json({ genres });
    // A lista muda pouco, então pode ficar bastante tempo em cache.
    response.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return response;
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
