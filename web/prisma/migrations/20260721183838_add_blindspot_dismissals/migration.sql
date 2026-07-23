-- CreateTable
CREATE TABLE "BlindSpotDismissal" (
    "userId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "gapKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlindSpotDismissal_pkey" PRIMARY KEY ("userId","dimension","gapKey")
);

-- AddForeignKey
ALTER TABLE "BlindSpotDismissal" ADD CONSTRAINT "BlindSpotDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
