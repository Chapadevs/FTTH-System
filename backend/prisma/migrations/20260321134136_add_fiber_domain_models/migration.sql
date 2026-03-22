-- CreateEnum
CREATE TYPE "EndpointRole" AS ENUM ('START', 'END');

-- CreateEnum
CREATE TYPE "FiberColor" AS ENUM ('BLUE', 'ORANGE', 'GREEN', 'BROWN', 'SLATE', 'WHITE', 'RED', 'BLACK', 'YELLOW', 'VIOLET', 'PINK', 'AQUA');

-- CreateEnum
CREATE TYPE "FiberDirection" AS ENUM ('FORWARD', 'RETURN');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('FUSION', 'DARK');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'DARK', 'INCONSISTENT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "importMetadata" JSONB;

-- CreateTable
CREATE TABLE "Sheath" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sheath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheathEndpoint" (
    "id" TEXT NOT NULL,
    "sheathId" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,
    "role" "EndpointRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheathEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiberRecord" (
    "id" TEXT NOT NULL,
    "sheathId" TEXT NOT NULL,
    "bufferColor" "FiberColor" NOT NULL,
    "fiberColor" "FiberColor" NOT NULL,
    "bufferIndex" INTEGER NOT NULL,
    "fiberIndex" INTEGER NOT NULL,
    "direction" "FiberDirection",
    "wavelength" DOUBLE PRECISION,
    "connectionType" "ConnectionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiberRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiberAssignment" (
    "id" TEXT NOT NULL,
    "fiberRecordId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "deviceName" TEXT,
    "portName" TEXT,
    "status" "AssignmentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiberAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sheath_projectId_idx" ON "Sheath"("projectId");

-- CreateIndex
CREATE INDEX "SheathEndpoint_sheathId_idx" ON "SheathEndpoint"("sheathId");

-- CreateIndex
CREATE INDEX "SheathEndpoint_poleId_idx" ON "SheathEndpoint"("poleId");

-- CreateIndex
CREATE UNIQUE INDEX "SheathEndpoint_sheathId_poleId_role_key" ON "SheathEndpoint"("sheathId", "poleId", "role");

-- CreateIndex
CREATE INDEX "FiberRecord_sheathId_idx" ON "FiberRecord"("sheathId");

-- CreateIndex
CREATE UNIQUE INDEX "FiberRecord_sheathId_bufferIndex_fiberIndex_key" ON "FiberRecord"("sheathId", "bufferIndex", "fiberIndex");

-- CreateIndex
CREATE INDEX "FiberAssignment_fiberRecordId_idx" ON "FiberAssignment"("fiberRecordId");

-- CreateIndex
CREATE INDEX "FiberAssignment_equipmentId_idx" ON "FiberAssignment"("equipmentId");

-- AddForeignKey
ALTER TABLE "Sheath" ADD CONSTRAINT "Sheath_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheathEndpoint" ADD CONSTRAINT "SheathEndpoint_sheathId_fkey" FOREIGN KEY ("sheathId") REFERENCES "Sheath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheathEndpoint" ADD CONSTRAINT "SheathEndpoint_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberRecord" ADD CONSTRAINT "FiberRecord_sheathId_fkey" FOREIGN KEY ("sheathId") REFERENCES "Sheath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberAssignment" ADD CONSTRAINT "FiberAssignment_fiberRecordId_fkey" FOREIGN KEY ("fiberRecordId") REFERENCES "FiberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberAssignment" ADD CONSTRAINT "FiberAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
