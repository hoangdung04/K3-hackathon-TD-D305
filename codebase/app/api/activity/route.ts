import {
  actorHash,
  ensureTutorSchema,
  getD1,
  listActivity,
  saveActivity,
  type ActivityEvent,
} from "../../../db/tutor-store";

export const runtime = "edge";

const EVENT_TYPES = new Set<ActivityEvent["type"]>([
  "selection_created",
  "question_submitted",
  "llm_response",
  "llm_error",
]);
const localActivity = new Map<string, ActivityEvent[]>();

export async function GET(request: Request) {
  try {
    const actor = await actorHash(request);
    const db = await getD1();
    if (!db) return Response.json({ items: localActivity.get(actor) ?? [], storage: "memory" });
    await ensureTutorSchema(db);
    return Response.json({ items: await listActivity(db, actor), storage: "d1" });
  } catch {
    return Response.json({ items: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ActivityEvent>;
    if (
      !EVENT_TYPES.has(body.type as ActivityEvent["type"]) ||
      !Number.isInteger(body.page) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 300
    ) {
      return Response.json({ error: "Dữ liệu log không hợp lệ." }, { status: 400 });
    }
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      type: body.type as ActivityEvent["type"],
      page: body.page,
      message: body.message.trim(),
      createdAt: Date.now(),
    };
    const actor = await actorHash(request);
    const db = await getD1();
    if (db) {
      await ensureTutorSchema(db);
      await saveActivity(db, actor, event);
    } else {
      localActivity.set(actor, [event, ...(localActivity.get(actor) ?? [])].slice(0, 30));
    }
    return Response.json({ item: event, persisted: true, storage: db ? "d1" : "memory" });
  } catch {
    return Response.json({ error: "Chưa thể ghi log lúc này." }, { status: 500 });
  }
}
