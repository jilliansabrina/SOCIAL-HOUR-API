/*
  Warnings:

  - You are about to drop the `ExerciseType` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `Exercise` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_typeId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "type" TEXT NOT NULL;

-- DropTable
DROP TABLE "ExerciseType";
