-- customer_ref remains an external identifier until the E4 customer model is introduced.
ALTER TABLE "proposals"
DROP CONSTRAINT IF EXISTS "proposals_customer_ref_fkey";

-- Draft requirements do not have generated proposal content yet.
ALTER TABLE "proposals"
ALTER COLUMN "content_json" DROP NOT NULL;
