-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "accentColor" TEXT NOT NULL DEFAULT '#f5c518',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "region" TEXT NOT NULL DEFAULT 'BR',
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "defaultRatingScale" INTEGER NOT NULL DEFAULT 5,
    "allowHalfStars" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" TEXT NOT NULL DEFAULT 'private',
    "showAdultContent" BOOLEAN NOT NULL DEFAULT false,
    "defaultLandingPage" TEXT NOT NULL DEFAULT '/',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

