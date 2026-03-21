-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'FIELD_TECH');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PoleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "EquipType" AS ENUM ('SPLITTER', 'TERMINATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FIELD_TECH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "prismId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING',
    "totalPassings" INTEGER NOT NULL DEFAULT 0,
    "sourceFilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pole" (
    "id" TEXT NOT NULL,
    "poleNumber" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "streetName" TEXT,
    "status" "PoleStatus" NOT NULL DEFAULT 'PLANNED',
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Pole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiberSegment" (
    "id" TEXT NOT NULL,
    "lengthFt" DOUBLE PRECISION NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromPoleId" TEXT NOT NULL,
    "toPoleId" TEXT NOT NULL,

    CONSTRAINT "FiberSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "equipType" "EquipType" NOT NULL,
    "portCount" INTEGER,
    "poleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pole" ADD CONSTRAINT "Pole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberSegment" ADD CONSTRAINT "FiberSegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberSegment" ADD CONSTRAINT "FiberSegment_fromPoleId_fkey" FOREIGN KEY ("fromPoleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberSegment" ADD CONSTRAINT "FiberSegment_toPoleId_fkey" FOREIGN KEY ("toPoleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
