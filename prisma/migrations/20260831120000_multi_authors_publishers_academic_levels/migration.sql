-- Multi-author / multi-publisher support + academic linking at every level
-- + a dedicated "additional information" field on Book.
--
-- Existing single author/publisher values are copied into the new join tables
-- BEFORE the old columns are dropped, so no data is lost.

-- ─────────────────────────────────────────────────────────
-- 1. Book.notes — additional cataloguing info (edition, volumes, binding…)
-- ─────────────────────────────────────────────────────────
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- ─────────────────────────────────────────────────────────
-- 2. BookAuthor
-- ─────────────────────────────────────────────────────────
CREATE TABLE "BookAuthor" (
    "bookId"   TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookAuthor_pkey" PRIMARY KEY ("bookId", "authorId")
);
CREATE INDEX "BookAuthor_authorId_idx" ON "BookAuthor"("authorId");
CREATE INDEX "BookAuthor_bookId_position_idx" ON "BookAuthor"("bookId", "position");

ALTER TABLE "BookAuthor"
  ADD CONSTRAINT "BookAuthor_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookAuthor"
  ADD CONSTRAINT "BookAuthor_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every book that had an author keeps it as primary (position 0).
INSERT INTO "BookAuthor" ("bookId", "authorId", "position")
SELECT "id", "authorId", 0 FROM "Book" WHERE "authorId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 3. BookPublisher
-- ─────────────────────────────────────────────────────────
CREATE TABLE "BookPublisher" (
    "bookId"      TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "position"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookPublisher_pkey" PRIMARY KEY ("bookId", "publisherId")
);
CREATE INDEX "BookPublisher_publisherId_idx" ON "BookPublisher"("publisherId");
CREATE INDEX "BookPublisher_bookId_position_idx" ON "BookPublisher"("bookId", "position");

ALTER TABLE "BookPublisher"
  ADD CONSTRAINT "BookPublisher_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookPublisher"
  ADD CONSTRAINT "BookPublisher_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BookPublisher" ("bookId", "publisherId", "position")
SELECT "id", "publisherId", 0 FROM "Book" WHERE "publisherId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 4. Drop the now-redundant single-value columns
-- ─────────────────────────────────────────────────────────
ALTER TABLE "Book" DROP CONSTRAINT IF EXISTS "Book_authorId_fkey";
ALTER TABLE "Book" DROP CONSTRAINT IF EXISTS "Book_publisherId_fkey";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "authorId";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "publisherId";

-- ─────────────────────────────────────────────────────────
-- 5. Academic linking above subject level
--    Root cause of "book assigned to a speciality never appears":
--    a book could only ever be attached to a Subject.
-- ─────────────────────────────────────────────────────────
CREATE TABLE "BookOnField" (
    "bookId"  TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    CONSTRAINT "BookOnField_pkey" PRIMARY KEY ("bookId", "fieldId")
);
CREATE INDEX "BookOnField_fieldId_idx" ON "BookOnField"("fieldId");
ALTER TABLE "BookOnField"
  ADD CONSTRAINT "BookOnField_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookOnField"
  ADD CONSTRAINT "BookOnField_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookOnYear" (
    "bookId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    CONSTRAINT "BookOnYear_pkey" PRIMARY KEY ("bookId", "yearId")
);
CREATE INDEX "BookOnYear_yearId_idx" ON "BookOnYear"("yearId");
ALTER TABLE "BookOnYear"
  ADD CONSTRAINT "BookOnYear_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookOnYear"
  ADD CONSTRAINT "BookOnYear_yearId_fkey"
  FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "BookOnSubject_subjectId_idx" ON "BookOnSubject"("subjectId");
