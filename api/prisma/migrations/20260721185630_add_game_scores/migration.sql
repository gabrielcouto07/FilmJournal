-- CreateTable
CREATE TABLE "GameScore" (
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "bestRounds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("userId","game","source")
);

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
