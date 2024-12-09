/*
  Warnings:

  - You are about to drop the column `postId` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `subcategory` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `workoutType` on the `Post` table. All the data in the column will be lost.
  - Added the required column `name` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workoutId` to the `Exercise` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('STRENGTH', 'CARDIO', 'FLEXIBILITY', 'OTHER');

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_postId_fkey";

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "postId",
DROP COLUMN "subcategory",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "workoutId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "workoutType";


-- DropEnum
DROP TYPE "ExerciseType";

-- CreateTable
CREATE TABLE "Workout" (
    "id" SERIAL NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "subtype" TEXT,
    "postId" INTEGER NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
