import { NextResponse } from "next/server";
import { getTasteData } from "@/lib/recommendations";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Faça login para ver recomendações." }, { status: 401 });
    }
    const url = new URL(request.url);
    const data = await getTasteData({ refresh: url.searchParams.get("refresh") === "1", userId: user.id });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Recommendation refresh failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar sua curadoria no momento." }, { status: 503 });
  }
}
