-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Stroke_roomId_idx" ON "Stroke"("roomId");

-- CreateIndex
CREATE INDEX "Stroke_roomId_createdAt_idx" ON "Stroke"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "Stroke_roomId_isUndone_createdAt_idx" ON "Stroke"("roomId", "isUndone", "createdAt");
