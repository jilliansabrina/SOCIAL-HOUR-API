/*
  Warnings:

  - You are about to drop the column `typeId` on the `Exercise` table. All the data in the column will be lost.
  - Changed the type of `type` on the `Exercise` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('STRENGTH', 'CARDIO', 'FLEXIBILITY', 'OTHER');

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "typeId",
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "weight" DECIMAL(65,30),
DROP COLUMN "type",
ADD COLUMN     "type" "ExerciseType" NOT NULL;
