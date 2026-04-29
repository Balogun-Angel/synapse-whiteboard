/*
  Warnings:

  - You are about to drop the column `prevX` on the `Stroke` table. All the data in the column will be lost.
  - You are about to drop the column `prevY` on the `Stroke` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Stroke` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Stroke` table. All the data in the column will be lost.
  - You are about to alter the column `brushSize` on the `Stroke` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Stroke" DROP COLUMN "prevX",
DROP COLUMN "prevY",
DROP COLUMN "x",
DROP COLUMN "y",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "brushSize" SET DATA TYPE INTEGER,
ALTER COLUMN "points" DROP DEFAULT;
