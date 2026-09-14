CREATE TABLE "ShortLink" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "userId" UUID,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShortLink_slug_key" ON "ShortLink"("slug");
CREATE INDEX "ShortLink_userId_createdAt_idx" ON "ShortLink"("userId", "createdAt");
CREATE INDEX "ShortLink_expiresAt_idx" ON "ShortLink"("expiresAt");
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
