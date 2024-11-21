/*
  Warnings:

  - You are about to drop the `_FriendshipToUser` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `receiverId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Friendship` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_FriendshipToUser" DROP CONSTRAINT "_FriendshipToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_FriendshipToUser" DROP CONSTRAINT "_FriendshipToUser_B_fkey";

-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "receiverId" INTEGER NOT NULL,
ADD COLUMN     "senderId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "_FriendshipToUser";

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
