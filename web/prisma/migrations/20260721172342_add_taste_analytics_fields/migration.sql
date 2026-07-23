-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "countries" TEXT[],
ADD COLUMN     "directorId" INTEGER,
ADD COLUMN     "directorName" TEXT,
ADD COLUMN     "originalLanguage" TEXT;

-- CreateTable
CREATE TABLE "Genre" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GenreToMovie" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GenreToMovie_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_KeywordToMovie" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_KeywordToMovie_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GenreToMovie_B_index" ON "_GenreToMovie"("B");

-- CreateIndex
CREATE INDEX "_KeywordToMovie_B_index" ON "_KeywordToMovie"("B");

-- AddForeignKey
ALTER TABLE "_GenreToMovie" ADD CONSTRAINT "_GenreToMovie_A_fkey" FOREIGN KEY ("A") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToMovie" ADD CONSTRAINT "_GenreToMovie_B_fkey" FOREIGN KEY ("B") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KeywordToMovie" ADD CONSTRAINT "_KeywordToMovie_A_fkey" FOREIGN KEY ("A") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KeywordToMovie" ADD CONSTRAINT "_KeywordToMovie_B_fkey" FOREIGN KEY ("B") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
