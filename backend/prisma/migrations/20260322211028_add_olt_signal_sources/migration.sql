-- CreateTable
CREATE TABLE "Olt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Olt_projectId_idx" ON "Olt"("projectId");

-- CreateIndex
CREATE INDEX "Olt_sourcePoleId_idx" ON "Olt"("sourcePoleId");

-- AddForeignKey
ALTER TABLE "Olt" ADD CONSTRAINT "Olt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olt" ADD CONSTRAINT "Olt_sourcePoleId_fkey" FOREIGN KEY ("sourcePoleId") REFERENCES "Pole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
