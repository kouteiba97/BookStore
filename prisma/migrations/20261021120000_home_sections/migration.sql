-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSectionBook" (
    "sectionId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeSectionBook_pkey" PRIMARY KEY ("sectionId","bookId")
);

-- CreateIndex
CREATE INDEX "HomeSection_storeId_position_idx" ON "HomeSection"("storeId", "position");

-- CreateIndex
CREATE INDEX "HomeSectionBook_bookId_idx" ON "HomeSectionBook"("bookId");

-- AddForeignKey
ALTER TABLE "HomeSection" ADD CONSTRAINT "HomeSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeSectionBook" ADD CONSTRAINT "HomeSectionBook_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeSectionBook" ADD CONSTRAINT "HomeSectionBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
