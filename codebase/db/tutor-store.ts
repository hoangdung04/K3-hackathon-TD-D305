export type StoredAnalysis = {
  regionTitle: string;
  confidence: number;
  needsConfirmation: boolean;
  answerTitle: string;
  answer: string;
  evidence: string;
};

type DatabaseEnv = { DB?: D1Database };

export async function getD1(): Promise<D1Database | null> {
  try {
    const workerBindings = await import("cloudflare:workers");
    return (workerBindings.env as unknown as DatabaseEnv).DB ?? null;
  } catch {
    return null;
  }
}

export async function actorHash(request: Request): Promise<string> {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const session = request.headers.get("x-vlearn-session") || "anonymous";
  const bytes = new TextEncoder().encode(`${ip}:${session}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function ensureTutorSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS tutor_requests (
        id TEXT PRIMARY KEY NOT NULL,
        actor_hash TEXT NOT NULL,
        page INTEGER NOT NULL,
        question TEXT NOT NULL,
        region_title TEXT NOT NULL,
        confidence_permille INTEGER NOT NULL,
        needs_confirmation INTEGER NOT NULL,
        answer_title TEXT NOT NULL,
        answer TEXT NOT NULL,
        evidence TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS tutor_requests_actor_created_idx
       ON tutor_requests (actor_hash, created_at)`,
    ),
  ]);
}

export async function countToday(db: D1Database, actor: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM tutor_requests WHERE actor_hash = ? AND created_at >= ?",
    )
    .bind(actor, start.getTime())
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function saveAnalysis(
  db: D1Database,
  actor: string,
  page: number,
  question: string,
  analysis: StoredAnalysis,
) {
  await db
    .prepare(
      `INSERT INTO tutor_requests
       (id, actor_hash, page, question, region_title, confidence_permille,
        needs_confirmation, answer_title, answer, evidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      actor,
      page,
      question,
      analysis.regionTitle,
      Math.round(analysis.confidence * 1000),
      analysis.needsConfirmation ? 1 : 0,
      analysis.answerTitle,
      analysis.answer,
      analysis.evidence,
      Date.now(),
    )
    .run();
}

export async function listHistory(db: D1Database, actor: string) {
  const result = await db
    .prepare(
      `SELECT id, page, question, region_title AS regionTitle,
              confidence_permille AS confidencePermille,
              answer_title AS answerTitle, answer, evidence, created_at AS createdAt
       FROM tutor_requests
       WHERE actor_hash = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .bind(actor)
    .all();
  return result.results;
}
