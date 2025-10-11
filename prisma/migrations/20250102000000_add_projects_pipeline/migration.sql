-- migration.sql CORRIGIDO E FINAL

-- Habilita a função para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- (RECOMENDADO) Cria tipos ENUM para garantir a integridade dos dados
CREATE TYPE project_status AS ENUM ('contacted', 'proposal', 'won', 'lost');
CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high');

-- Cria a tabela de projetos com os tipos de dados corretos
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
    "status" project_status DEFAULT 'contacted',
    "priority" project_priority DEFAULT 'medium',
    "progress" INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    "start_date" TIMESTAMPTZ(3) NOT NULL, -- MUDADO PARA TIMESTAMPTZ
    "due_date" TIMESTAMPTZ(3) NOT NULL,   -- MUDADO PARA TIMESTAMPTZ
    "completed_at" TIMESTAMPTZ(3),        -- MUDADO PARA TIMESTAMPTZ
    "tags" JSONB DEFAULT '[]'::jsonb,
    "assigned_to" JSONB DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "contacts" JSONB DEFAULT '[]'::jsonb,
    "created_by" VARCHAR NOT NULL, -- Removido DEFAULT 'system' para ser obrigatório pela aplicação
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS "idx_projects_title" ON "projects"("title");
CREATE INDEX IF NOT EXISTS "idx_projects_status" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "idx_projects_client_id" ON "projects"("client_id");

-- Função e Trigger para atualizar 'updated_at' automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON "projects"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();