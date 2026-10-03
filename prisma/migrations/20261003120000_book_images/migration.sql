-- Several pictures per book (a series shows each volume).
-- Book.imageUrl stays as the cover; existing covers are copied in as picture 0.

CREATE TABLE "BookImage" (
    "id"        TEXT NOT NULL,
    "bookId"    TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookImage_bookId_position_idx" ON "BookImage"("bookId", "position");

ALTER TABLE "BookImage"
  ADD CONSTRAINT "BookImage_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BookImage" ("id", "bookId", "url", "position")
SELECT gen_random_uuid()::text, "id", "imageUrl", 0
FROM "Book"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> '';
