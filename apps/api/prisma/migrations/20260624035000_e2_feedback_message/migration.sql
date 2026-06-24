ALTER TABLE "conversation_feedback"
  DROP COLUMN "query",
  DROP COLUMN "answer",
  DROP COLUMN "session_id",
  ADD COLUMN "message_id" TEXT,
  ADD COLUMN "comment" TEXT;

CREATE UNIQUE INDEX "conversation_feedback_message_id_key"
  ON "conversation_feedback"("message_id");

ALTER TABLE "conversation_feedback"
  ADD CONSTRAINT "conversation_feedback_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
