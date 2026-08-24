/*
  Warnings:

  - Added the required column `contentId` to the `file_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "file_versions" ADD COLUMN     "contentId" TEXT NOT NULL;
