-- CreateEnum
CREATE TYPE "EndpointObservationState" AS ENUM ('ACTIVE', 'DARK', 'NEEDS_FUSION');

-- CreateTable
CREATE TABLE "FiberEndpointObservation" (
    "id" TEXT NOT NULL,
    "fiberRecordId" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,
    "role" "EndpointRole" NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "rawConnection" TEXT,
    "wavelength" DOUBLE PRECISION,
    "deviceName" TEXT,
    "portName" TEXT,
    "state" "EndpointObservationState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiberEndpointObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiberEndpointObservation_fiberRecordId_poleId_key" ON "FiberEndpointObservation"("fiberRecordId", "poleId");

-- CreateIndex
CREATE INDEX "FiberEndpointObservation_fiberRecordId_idx" ON "FiberEndpointObservation"("fiberRecordId");

-- CreateIndex
CREATE INDEX "FiberEndpointObservation_poleId_idx" ON "FiberEndpointObservation"("poleId");

-- CreateIndex
CREATE INDEX "FiberEndpointObservation_poleId_state_idx" ON "FiberEndpointObservation"("poleId", "state");

-- AddForeignKey
ALTER TABLE "FiberEndpointObservation" ADD CONSTRAINT "FiberEndpointObservation_fiberRecordId_fkey" FOREIGN KEY ("fiberRecordId") REFERENCES "FiberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberEndpointObservation" ADD CONSTRAINT "FiberEndpointObservation_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
