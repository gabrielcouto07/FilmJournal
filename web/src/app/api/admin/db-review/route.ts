import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabaseReview } from "@/lib/db-review";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 401 });
  }

  try {
    const review = await getDatabaseReview();
    return NextResponse.json(review, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Database review failed", error);
    return NextResponse.json({ error: "Não foi possível gerar a revisão do banco de dados." }, { status: 500 });
  }
}
