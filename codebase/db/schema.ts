import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tutorRequests = sqliteTable(
  "tutor_requests",
  {
    id: text("id").primaryKey(),
    actorHash: text("actor_hash").notNull(),
    page: integer("page").notNull(),
    question: text("question").notNull(),
    regionTitle: text("region_title").notNull(),
    confidencePermille: integer("confidence_permille").notNull(),
    needsConfirmation: integer("needs_confirmation", { mode: "boolean" }).notNull(),
    answerTitle: text("answer_title").notNull(),
    answer: text("answer").notNull(),
    evidence: text("evidence").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("tutor_requests_actor_created_idx").on(table.actorHash, table.createdAt),
  ],
);
