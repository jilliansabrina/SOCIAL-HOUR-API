/*
  Warnings:

  - The `duration` column on the `Exercise` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "duration",
ADD COLUMN     "duration" DECIMAL(65,30);
