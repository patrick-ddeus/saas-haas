/**
 * TENANT HELPERS - Utilitários para Isolamento de Dados
 * =====================================================
 *
 * ✅ ISOLAMENTO GARANTIDO: Todas as operações usam schema correto do tenant
 * ✅ PREVENÇÃO SQL INJECTION: Parâmetros preparados em todas as queries
 * ✅ REUTILIZAÇÃO: Helpers padronizados para todos os services
 *
 * Melhorias aplicadas:
 * - Serializa automaticamente objetos e arrays para JSON (JSONB) no INSERT e UPDATE
 * - Faz cast para ::jsonb sempre que o valor for objeto/array
 * - Faz cast para ::uuid quando detectar strings com formato UUID
 * - Detecta Date (instâncias) e strings ISO date / datetime e faz cast apropriado (::date / ::timestamptz)
 * - Evita enviar arrays JS ao driver (que virariam text[] no Postgres)
 */

import { TenantDatabase } from '../config/database';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/; // starts with YYYY-MM-DDTHH:MM:SS

/**
 * Executa query SELECT no schema do tenant
 *
 * @param tenantDB - TenantDatabase instance
 * @param query - SQL query com placeholder ${schema}
 * @param params - Parâmetros da query
 */
export async function queryTenantSchema<T = any>(
  tenantDB: TenantDatabase,
  query: string,
  params: any[] = []
): Promise<T[]> {
  if (!tenantDB || typeof tenantDB.executeInTenantSchema !== 'function') {
    throw new Error('Invalid TenantDatabase instance provided to queryTenantSchema');
  }
  return await tenantDB.executeInTenantSchema<T>(query, params);
}

/**
 * Insere dados no schema do tenant
 *
 * @param tenantDB - TenantDatabase instance
 * @param tableName - Nome da tabela
 * @param data - Dados para inserir
 */
export async function insertInTenantSchema<T = any>(
  tenantDB: TenantDatabase,
  tableName: string,
  data: Record<string, any>
): Promise<T> {
  if (!tenantDB || typeof tenantDB.getSchemaName !== 'function') {
    throw new Error('Invalid TenantDatabase instance provided to insertInTenantSchema');
  }

  const schemaName = await tenantDB.getSchemaName();

  const columns = Object.keys(data);
  if (columns.length === 0) {
    throw new Error('No data provided to insertInTenantSchema');
  }

  const rawValues = Object.values(data);
  const mappedValues: any[] = [];

  // Construir placeholders com casting inteligente
  const placeholders = rawValues
    .map((val, idx) => {
      const paramIndex = idx + 1;

      // null/undefined -> enviar como NULL (sem cast especial)
      if (val === null || val === undefined) {
        mappedValues.push(null);
        return `$${paramIndex}`;
      }

      // Date instance -> timestamptz
      if (val instanceof Date) {
        // envia ISO e cast para timestamptz
        mappedValues.push(val.toISOString());
        return `$${paramIndex}::timestamptz`;
      }

      // Strings que representam date-only (YYYY-MM-DD) -> date
      if (typeof val === 'string' && isoDateRegex.test(val)) {
        mappedValues.push(val);
        return `$${paramIndex}::date`;
      }

      // Strings que representam datetime ISO -> timestamptz
      if (typeof val === 'string' && isoDateTimeRegex.test(val)) {
        mappedValues.push(val);
        return `$${paramIndex}::timestamptz`;
      }

      // Objetos e arrays -> JSONB
      if (typeof val === 'object') {
        mappedValues.push(JSON.stringify(val));
        return `$${paramIndex}::jsonb`;
      }

      // Strings que parecem UUID -> cast para uuid
      if (typeof val === 'string' && uuidRegex.test(val)) {
        mappedValues.push(val);
        return `$${paramIndex}::uuid`;
      }

      // Demais casos -> sem cast
      mappedValues.push(val);
      return `$${paramIndex}`;
    })
    .join(', ');

  const columnsJoined = columns.join(', ');

  console.log('[insertInTenantSchema] Inserting into', schemaName, '.', tableName);
  console.log('[insertInTenantSchema] Columns:', columns);
  // Não logar valores sensíveis em produção; útil em dev
  console.log('[insertInTenantSchema] Mapped values (for params):', mappedValues);

  const query = `
    INSERT INTO ${schemaName}.${tableName} (${columnsJoined})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await queryTenantSchema<T>(tenantDB, query, mappedValues);
  console.log('[insertInTenantSchema] Insert successful, result:', result?.[0] ?? null);
  return result[0];
}

/**
 * Atualiza dados no schema do tenant
 *
 * @param tenantDB - TenantDatabase instance
 * @param tableName - Nome da tabela
 * @param id - ID do registro
 * @param data - Dados para atualizar
 */
export async function updateInTenantSchema<T = any>(
  tenantDB: TenantDatabase,
  tableName: string,
  id: string,
  data: Record<string, any>
): Promise<T | null> {
  if (!tenantDB || typeof tenantDB.getSchemaName !== 'function') {
    throw new Error('Invalid TenantDatabase instance provided to updateInTenantSchema');
  }

  const schema = await tenantDB.getSchemaName();

  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new Error('No data provided to updateInTenantSchema');
  }

  // Montar SET clause com casts inteligentes
  const setClauses = keys.map((key, index) => {
    const val = data[key];

    if (val === null || val === undefined) {
      return `${key} = $${index + 1}`;
    }

    // Date instance -> timestamptz
    if (val instanceof Date) {
      return `${key} = $${index + 1}::timestamptz`;
    }

    // Strings date-only -> date
    if (typeof val === 'string' && isoDateRegex.test(val)) {
      return `${key} = $${index + 1}::date`;
    }

    // Strings datetime -> timestamptz
    if (typeof val === 'string' && isoDateTimeRegex.test(val)) {
      return `${key} = $${index + 1}::timestamptz`;
    }

    // Objetos e arrays -> jsonb
    if (typeof val === 'object') {
      return `${key} = $${index + 1}::jsonb`;
    }

    // Strings uuid -> uuid
    if (typeof val === 'string' && uuidRegex.test(val)) {
      return `${key} = $${index + 1}::uuid`;
    }

    return `${key} = $${index + 1}`;
  });

  const values = keys.map(k => {
    const v = data[k];
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString(); // timestamptz expects ISO
    if (typeof v === 'object') return JSON.stringify(v); // serializar arrays/objetos
    return v;
  });

  // id param é o último (com cast uuid)
  const idParamIndex = values.length + 1;
  const query = `
    UPDATE ${schema}.${tableName}
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $${idParamIndex}::uuid AND is_active = TRUE
    RETURNING *
  `;

  const params = [...values, id];
  const result = await queryTenantSchema<T>(tenantDB, query, params);
  return result[0] || null;
}

/**
 * Soft delete no schema do tenant
 *
 * @param tenantDB - TenantDatabase instance
 * @param tableName - Nome da tabela
 * @param id - ID do registro
 */
export async function softDeleteInTenantSchema<T = any>(
  tenantDB: TenantDatabase,
  tableName: string,
  id: string
): Promise<T | null> {
  if (!tenantDB || typeof tenantDB.getSchemaName !== 'function') {
    throw new Error('Invalid TenantDatabase instance provided to softDeleteInTenantSchema');
  }

  const schema = await tenantDB.getSchemaName();

  const query = `
    UPDATE ${schema}.${tableName}
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1::uuid AND is_active = TRUE
    RETURNING *
  `;

  const result = await queryTenantSchema<T>(tenantDB, query, [id]);
  return result[0] || null;
}
