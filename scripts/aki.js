import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProjectsColumnOrder() {
  try {
    console.log('🔧 Corrigindo estrutura da tabela projects...\n');

    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, schemaName: true, name: true }
    });

    console.log(`📊 Encontrados ${tenants.length} tenants ativos\n`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Processando: ${tenant.name} (${tenant.schemaName})`);

      try {
        // Verificar se tabela existe
        const tableCheck = await prisma.$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = '${tenant.schemaName}'
            AND table_name = 'projects'
          ) as exists
        `);

        if (!tableCheck[0]?.exists) {
          console.log('  ⏭️  Tabela projects não existe, pulando...');
          continue;
        }

        // Recriar tabela com estrutura correta
        await prisma.$executeRawUnsafe(`
          DO $$ 
          BEGIN
            -- Backup dos dados existentes
            CREATE TEMP TABLE projects_backup AS 
            SELECT * FROM "${tenant.schemaName}".projects;

            -- Drop tabela antiga
            DROP TABLE "${tenant.schemaName}".projects CASCADE;

            -- Criar tabela com estrutura correta
            CREATE TABLE "${tenant.schemaName}".projects (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              title VARCHAR NOT NULL,
              description TEXT,
              client_id UUID,
              client_name VARCHAR NOT NULL,
              organization VARCHAR,
              address TEXT,
              budget DECIMAL(15,2),
              currency VARCHAR(3) DEFAULT 'BRL',
              status VARCHAR DEFAULT 'contacted',
              priority VARCHAR DEFAULT 'medium',
              progress INTEGER DEFAULT 0,
              start_date DATE NOT NULL,
              due_date DATE NOT NULL,
              completed_at TIMESTAMP,
              tags JSONB DEFAULT '[]'::jsonb,
              assigned_to JSONB DEFAULT '[]'::jsonb,
              notes TEXT,
              contacts JSONB DEFAULT '[]'::jsonb,
              created_by UUID NOT NULL,
              is_active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            -- Criar índices
            CREATE INDEX idx_projects_title ON "${tenant.schemaName}".projects(title);
            CREATE INDEX idx_projects_status ON "${tenant.schemaName}".projects(status);
            CREATE INDEX idx_projects_client_id ON "${tenant.schemaName}".projects(client_id);
            CREATE INDEX idx_projects_priority ON "${tenant.schemaName}".projects(priority);
            CREATE INDEX idx_projects_created_by ON "${tenant.schemaName}".projects(created_by);
            CREATE INDEX idx_projects_active ON "${tenant.schemaName}".projects(is_active);

            -- Restaurar dados (se houver)
            INSERT INTO "${tenant.schemaName}".projects (
              id, title, description, client_id, client_name, organization, address,
              budget, currency, status, priority, progress, start_date, due_date,
              completed_at, tags, assigned_to, notes, contacts, created_by,
              is_active, created_at, updated_at
            )
            SELECT 
              COALESCE(id::uuid, gen_random_uuid()),
              title,
              description,
              client_id::uuid,
              client_name,
              organization,
              address,
              budget,
              COALESCE(currency, 'BRL'),
              COALESCE(status, 'contacted'),
              COALESCE(priority, 'medium'),
              COALESCE(progress, 0),
              COALESCE(start_date, CURRENT_DATE),
              COALESCE(due_date, CURRENT_DATE + INTERVAL '30 days'),
              completed_at,
              COALESCE(tags, '[]'::jsonb),
              COALESCE(assigned_to, '[]'::jsonb),
              notes,
              COALESCE(contacts, '[]'::jsonb),
              created_by::uuid,
              COALESCE(is_active, true),
              COALESCE(created_at, NOW()),
              COALESCE(updated_at, NOW())
            FROM projects_backup;

            -- Limpar backup
            DROP TABLE projects_backup;

            RAISE NOTICE 'Tabela projects corrigida com sucesso';
          EXCEPTION 
            WHEN OTHERS THEN
              RAISE NOTICE 'Erro: %', SQLERRM;
          END $$;
        `);

        console.log('  ✅ Estrutura corrigida com sucesso');

      } catch (error) {
        console.error(`  ❌ Erro ao processar ${tenant.schemaName}:`, error.message);
      }
    }

    console.log('\n✅ Correção concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixProjectsColumnOrder();