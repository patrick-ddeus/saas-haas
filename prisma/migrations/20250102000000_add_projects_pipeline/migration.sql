
-- CreateTable para Projetos (alinhado com schema Prisma)
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "client_id" TEXT,
    "client_name" VARCHAR NOT NULL,
    "organization" VARCHAR,
    "address" TEXT,
    "budget" DECIMAL(15,2),
    "currency" VARCHAR(3) DEFAULT 'BRL',
    "status" VARCHAR DEFAULT 'contacted',
    "priority" VARCHAR DEFAULT 'medium',
    "progress" INTEGER DEFAULT 0,
    "start_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "completed_at" TIMESTAMP,
    "tags" JSONB DEFAULT '[]'::jsonb,
    "assigned_to" JSONB DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "contacts" JSONB DEFAULT '[]'::jsonb,
    "created_by" VARCHAR NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_projects_title" ON "projects"("title");
CREATE INDEX IF NOT EXISTS "idx_projects_status" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "idx_projects_client_id" ON "projects"("client_id");
CREATE INDEX IF NOT EXISTS "idx_projects_priority" ON "projects"("priority");
CREATE INDEX IF NOT EXISTS "idx_projects_created_by" ON "projects"("created_by");
CREATE INDEX IF NOT EXISTS "idx_projects_active" ON "projects"("is_active");

-- AddForeignKey (opcional)
-- ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
