ALTER TABLE "conversation_feedback"
  ALTER COLUMN "query" DROP NOT NULL,
  ALTER COLUMN "answer" DROP NOT NULL,
  ALTER COLUMN "session_id" DROP NOT NULL,
  ADD COLUMN "message_id" TEXT,
  ADD COLUMN "comment" TEXT;

CREATE UNIQUE INDEX "conversation_feedback_message_id_key"
  ON "conversation_feedback"("message_id");

ALTER TABLE "conversation_feedback"
  ADD CONSTRAINT "conversation_feedback_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
