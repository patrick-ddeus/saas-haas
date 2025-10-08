
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProjectsSchemaAlignment() {
  try {
    console.log('🔧 Alinhando tabela projects com schema Prisma...\n');

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

        // REMOVER colunas antigas que não existem no schema Prisma
        const columnsToRemove = ['name', 'contact_name', 'mobile', 'estimated_value', 'stage', 'end_date'];
        
        for (const column of columnsToRemove) {
          try {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "${tenant.schemaName}".projects 
              DROP COLUMN IF EXISTS ${column}
            `);
            console.log(`  ✅ Coluna removida: ${column}`);
          } catch (e) {
            console.log(`  ⚠️  Coluna ${column} já não existe ou erro: ${e.message}`);
          }
        }

        // ADICIONAR/CORRIGIR colunas necessárias
        const alterations = [
          { column: 'title', type: 'VARCHAR', constraint: 'NOT NULL', default: null },
          { column: 'client_name', type: 'VARCHAR', constraint: 'NOT NULL', default: null },
          { column: 'status', type: 'VARCHAR', constraint: 'DEFAULT \'contacted\'', default: null },
          { column: 'priority', type: 'VARCHAR', constraint: 'DEFAULT \'medium\'', default: null },
          { column: 'start_date', type: 'DATE', constraint: null, default: 'CURRENT_DATE' },
          { column: 'due_date', type: 'DATE', constraint: null, default: 'CURRENT_DATE + INTERVAL \'30 days\'' },
          { column: 'completed_at', type: 'TIMESTAMP', constraint: null, default: null },
          { column: 'contacts', type: 'JSONB', constraint: 'DEFAULT \'[]\'::jsonb', default: null },
          { column: 'assigned_to', type: 'JSONB', constraint: 'DEFAULT \'[]\'::jsonb', default: null }
        ];

        for (const { column, type, constraint, default: defaultValue } of alterations) {
          try {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "${tenant.schemaName}".projects 
              ADD COLUMN IF NOT EXISTS ${column} ${type} ${constraint || ''}
            `);
            
            // Preencher valores default se necessário
            if (defaultValue && column === 'start_date') {
              await prisma.$executeRawUnsafe(`
                UPDATE "${tenant.schemaName}".projects 
                SET start_date = ${defaultValue}
                WHERE start_date IS NULL
              `);
            }
            if (defaultValue && column === 'due_date') {
              await prisma.$executeRawUnsafe(`
                UPDATE "${tenant.schemaName}".projects 
                SET due_date = ${defaultValue}
                WHERE due_date IS NULL
              `);
            }
            
            console.log(`  ✅ Coluna verificada/adicionada: ${column}`);
          } catch (e) {
            console.log(`  ⚠️  Erro na coluna ${column}: ${e.message}`);
          }
        }

        // GARANTIR constraints NOT NULL
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "${tenant.schemaName}".projects 
            ALTER COLUMN start_date SET NOT NULL,
            ALTER COLUMN due_date SET NOT NULL
          `);
          console.log('  ✅ Constraints NOT NULL aplicadas');
        } catch (e) {
          console.log(`  ⚠️  Erro ao aplicar constraints: ${e.message}`);
        }

        console.log(`  ✅ Schema alinhado com sucesso!`);

      } catch (error) {
        console.error(`  ❌ Erro ao processar ${tenant.schemaName}:`, error.message);
      }
    }

    console.log('\n✅ Alinhamento concluído!');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProjectsSchemaAlignment();
