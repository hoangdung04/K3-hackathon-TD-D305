import {
  actorHash,
  ensureTutorSchema,
  getD1,
  listHistory,
} from "../../../db/tutor-store";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const db = await getD1();
    if (!db) return Response.json({ items: [] });
    await ensureTutorSchema(db);
    const actor = await actorHash(request);
    return Response.json({ items: await listHistory(db, actor) });
  } catch {
    return Response.json({ items: [] });
  }
}
