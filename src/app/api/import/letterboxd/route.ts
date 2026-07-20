import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { unzipSync } from "fflate";
import { getCurrentUser } from "@/lib/auth";
import { CATALOG_TAG, userTag } from "@/lib/data";
import { importLetterboxdForUser } from "@/lib/letterboxd-persist";
import {
  LetterboxdImportValidationError,
  type LetterboxdFile,
  type LetterboxdFiles,
} from "@/lib/letterboxd-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Large libraries take a while to persist; ask Vercel for more headroom than the
// 10s default (honored on plans that allow it).
export const maxDuration = 60;

// Filenames Letterboxd puts in its export ZIP. Any subset is accepted.
const KNOWN_FILES: LetterboxdFile[] = [
  "diary.csv",
  "reviews.csv",
  "ratings.csv",
  "watched.csv",
  "watchlist.csv",
  "profile.csv",
  "likes/films.csv",
];

// Vercel Functions reject request bodies above 4.5 MB before this route runs.
// Leave room for multipart boundaries so users get our own actionable error.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function knownFileFromPath(path: string): LetterboxdFile | null {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return KNOWN_FILES.find((known) => normalized === known || normalized.endsWith(`/${known}`)) ?? null;
}

/** Pull only known Letterboxd CSVs out of a ZIP, ignoring any wrapping folder. */
function filesFromZip(bytes: Uint8Array): LetterboxdFiles {
  let expandedBytes = 0;
  let limitExceeded = false;
  const entries = unzipSync(bytes, {
    filter(file) {
      if (!knownFileFromPath(file.name)) return false;
      expandedBytes += file.originalSize;
      if (file.originalSize > MAX_UNCOMPRESSED_BYTES || expandedBytes > MAX_UNCOMPRESSED_BYTES) {
        limitExceeded = true;
        return false;
      }
      return true;
    },
  });
  if (limitExceeded) {
    throw new LetterboxdImportValidationError("O conteúdo descompactado excede o limite de 25 MB.");
  }

  const decoder = new TextDecoder("utf-8");
  const files: LetterboxdFiles = {};
  let actualBytes = 0;
  for (const [path, contents] of Object.entries(entries)) {
    const known = knownFileFromPath(path);
    if (!known || files[known]) continue;
    actualBytes += contents.byteLength;
    if (actualBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new LetterboxdImportValidationError("O conteúdo descompactado excede o limite de 25 MB.");
    }
    files[known] = decoder.decode(contents);
  }
  return files;
}

/**
 * Import a Letterboxd export into the signed-in user's journal.
 * Accepts either a single `.zip` (field `archive`/`zip`/`file`) or the individual
 * CSV files (field named after the file, e.g. `diary.csv` or bare `diary`).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return json({ error: "Faça login para importar seus dados do Letterboxd." }, 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "Envie um arquivo .zip do Letterboxd (ou os CSVs) como multipart/form-data." }, 400);
  }

  let form: FormData;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 128 * 1024) {
    return json({ error: "O envio excede o limite de 4 MB da importação web." }, 413);
  }
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Não foi possível ler o formulário enviado." }, 400);
  }

  let files: LetterboxdFiles = {};
  const errors: string[] = [];

  const archive = form.get("archive") ?? form.get("zip") ?? form.get("file");
  if (archive instanceof File && archive.size > 0) {
    if (!archive.name.toLowerCase().endsWith(".zip")) {
      return json({ error: "O arquivo principal precisa ser um .zip exportado pelo Letterboxd." }, 400);
    }
    if (archive.size > MAX_UPLOAD_BYTES) {
      return json({ error: "O arquivo excede o limite de 4 MB da importação web." }, 413);
    }
    try {
      files = filesFromZip(new Uint8Array(await archive.arrayBuffer()));
    } catch (error) {
      if (error instanceof LetterboxdImportValidationError) {
        return json({ error: error.message }, 413);
      }
      return json({ error: "Não foi possível ler o .zip. Verifique se é o export do Letterboxd." }, 400);
    }
  } else {
    // Individual CSV uploads: accept the exact filename or a bare field name.
    let totalBytes = 0;
    for (const known of KNOWN_FILES) {
      const bare = known.replace(/\.csv$/, "").replace("likes/", "");
      const entry = form.get(known) ?? form.get(bare);
      if (!(entry instanceof File) || entry.size === 0) continue;
      totalBytes += entry.size;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        return json({ error: "Os arquivos excedem o limite de 4 MB da importação web." }, 413);
      }
      try {
        files[known] = await entry.text();
      } catch {
        errors.push(`Falha ao ler ${known}.`);
      }
    }
  }

  if (Object.keys(files).length === 0) {
    return json({ error: "Nenhum arquivo reconhecido do Letterboxd foi encontrado.", errors }, 400);
  }

  try {
    const summary = await importLetterboxdForUser(user.id, files);
    // The import fills the user's journal and may add catalog movies — drop
    // every cached page so the freshly imported profile shows up immediately.
    revalidateTag(userTag(user.id));
    revalidateTag(CATALOG_TAG);
    return json({ ok: true, summary, errors });
  } catch (error) {
    if (error instanceof LetterboxdImportValidationError) {
      return json({ error: error.message, errors }, 422);
    }
    console.error("[import/letterboxd]", error);
    return json({ error: "Não foi possível concluir a importação. Tente novamente." }, 500);
  }
}
