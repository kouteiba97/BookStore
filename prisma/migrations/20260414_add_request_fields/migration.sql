-- Add new required columns with temporary defaults for existing rows
ALTER TABLE "Request"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastName"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "phone"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "wilaya"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "address"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bookId"    TEXT;

-- Copy existing phone data from userPhone → phone
UPDATE "Request" SET "phone" = "userPhone" WHERE "phone" = '';

-- Drop default constraints now that data is populated
ALTER TABLE "Request"
  ALTER COLUMN "firstName" DROP DEFAULT,
  ALTER COLUMN "lastName"  DROP DEFAULT,
  ALTER COLUMN "phone"     DROP DEFAULT,
  ALTER COLUMN "wilaya"    DROP DEFAULT,
  ALTER COLUMN "address"   DROP DEFAULT;

-- Drop old columns no longer in schema
ALTER TABLE "Request"
  DROP COLUMN IF EXISTS "userPhone",
  DROP COLUMN IF EXISTS "userType";
