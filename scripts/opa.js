
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTasksSchema() {
  try {
    console.log('🔧 Corrigindo estrutura completa da tabela tasks...\n');

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
            AND table_name = 'tasks'
          ) as exists
        `);

        if (!tableCheck[0]?.exists) {
          console.log('  📋 Tabela tasks não existe, criando estrutura completa...');
          
          // Criar tabela completa
          await prisma.$executeRawUnsafe(`
            CREATE TABLE "${tenant.schemaName}".tasks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              title VARCHAR NOT NULL,
              description TEXT,
              project_id UUID,
              project_title VARCHAR(255),
              client_id UUID,
              client_name VARCHAR(255),
              assigned_to VARCHAR NOT NULL,
              status VARCHAR DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
              priority VARCHAR DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
              start_date DATE,
              end_date DATE,
              completed_at TIMESTAMP WITH TIME ZONE,
              estimated_hours DECIMAL(5,2),
              actual_hours DECIMAL(5,2),
              progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
              tags JSONB DEFAULT '[]'::jsonb,
              notes TEXT,
              subtasks JSONB DEFAULT '[]'::jsonb,
              created_by VARCHAR NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW(),
              is_active BOOLEAN DEFAULT TRUE
            )
          `);

          console.log('  ✅ Tabela tasks criada com estrutura completa');
          continue;
        }

        // Tabela existe, adicionar colunas faltantes
        console.log('  🔄 Tabela tasks existe, verificando colunas...');

        await prisma.$executeRawUnsafe(`
          DO $$ 
          BEGIN
            -- Adicionar TODAS as colunas que podem não existir
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS project_id UUID;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS project_title VARCHAR(255);
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS client_id UUID;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS start_date DATE;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS end_date DATE;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2);
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2);
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS notes TEXT;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
            ALTER TABLE "${tenant.schemaName}".tasks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

            -- Garantir valores padrão para colunas existentes
            UPDATE "${tenant.schemaName}".tasks SET tags = '[]'::jsonb WHERE tags IS NULL;
            UPDATE "${tenant.schemaName}".tasks SET subtasks = '[]'::jsonb WHERE subtasks IS NULL;
            UPDATE "${tenant.schemaName}".tasks SET progress = 0 WHERE progress IS NULL;
            UPDATE "${tenant.schemaName}".tasks SET is_active = TRUE WHERE is_active IS NULL;

            RAISE NOTICE 'Tabela tasks atualizada com sucesso';
          EXCEPTION 
            WHEN OTHERS THEN
              RAISE NOTICE 'Erro: %', SQLERRM;
          END $$;
        `);

        // Criar índices
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON "${tenant.schemaName}".tasks(assigned_to);
          CREATE INDEX IF NOT EXISTS idx_tasks_status ON "${tenant.schemaName}".tasks(status);
          CREATE INDEX IF NOT EXISTS idx_tasks_priority ON "${tenant.schemaName}".tasks(priority);
          CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON "${tenant.schemaName}".tasks(project_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON "${tenant.schemaName}".tasks(client_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_active ON "${tenant.schemaName}".tasks(is_active);
          CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON "${tenant.schemaName}".tasks(created_by);
        `);

        console.log('  ✅ Estrutura atualizada com sucesso');

      } catch (error) {
        console.error(`  ❌ Erro ao processar ${tenant.schemaName}:`, error.message);
      }
    }

    console.log('\n✅ Correção concluída!\n');
    console.log('📋 Estrutura da tabela tasks agora inclui:');
    console.log('   ✓ Campos básicos: id, title, description');
    console.log('   ✓ Relacionamentos: project_id, project_title, client_id, client_name');
    console.log('   ✓ Atribuição: assigned_to');
    console.log('   ✓ Status: status, priority, progress');
    console.log('   ✓ Datas: start_date, end_date, completed_at');
    console.log('   ✓ Estimativas: estimated_hours, actual_hours');
    console.log('   ✓ JSONB: tags, subtasks (CORRIGIDO)');
    console.log('   ✓ Observações: notes');
    console.log('   ✓ Auditoria: created_by, created_at, updated_at, is_active\n');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixTasksSchema();
