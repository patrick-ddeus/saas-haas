/**
 * PUBLICATIONS SERVICE - Gestão de Publicações Jurídicas
 * =======================================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa TenantDatabase e helpers de isolamento
 * ✅ ISOLAMENTO POR USUÁRIO: Publicações são isoladas por usuário (diferente de outros módulos)
 * ✅ SEM DADOS MOCK: Operações reais no PostgreSQL
 */

import { TenantDatabase } from '../config/database';
import {
  queryTenantSchema,
  insertInTenantSchema,
  updateInTenantSchema,
  softDeleteInTenantSchema
} from '../utils/tenantHelpers';

export interface Publication {
  id: string;
  user_id: string;
  oab_number: string;
  process_number?: string;
  publication_date: string;
  content: string;
  source: 'CNJ-DATAJUD' | 'Codilo' | 'JusBrasil';
  external_id?: string;
  status: 'nova' | 'pendente' | 'atribuida' | 'finalizada' | 'descartada';
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CreatePublicationData {
  oabNumber: string;
  processNumber?: string;
  publicationDate: string;
  content: string;
  source: 'CNJ-DATAJUD' | 'Codilo' | 'JusBrasil';
  externalId?: string;
  status?: 'nova' | 'pendente' | 'atribuida' | 'finalizada' | 'descartada';
}

export interface UpdatePublicationData extends Partial<CreatePublicationData> {
  urgencia?: 'baixa' | 'media' | 'alta';
  responsavel?: string;
  varaComarca?: string;
  nomePesquisado?: string;
  diario?: string;
  observacoes?: string;
  atribuidaParaId?: string;
  atribuidaParaNome?: string;
  dataAtribuicao?: string | Date;
  tarefasVinculadas?: string[];
}

export interface PublicationFilters {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class PublicationsService {
  private tableName = 'publications';

  /**
   * Cria as tabelas necessárias se não existirem
   */
  private async ensureTables(tenantDB: TenantDatabase): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \${schema}.${this.tableName} (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        oab_number VARCHAR NOT NULL,
        process_number VARCHAR,
        publication_date DATE NOT NULL,
        content TEXT NOT NULL,
        source VARCHAR NOT NULL CHECK (source IN ('CNJ-DATAJUD', 'Codilo', 'JusBrasil')),
        external_id VARCHAR,
        status VARCHAR DEFAULT 'nova',
        urgencia VARCHAR DEFAULT 'media',
        responsavel VARCHAR,
        vara_comarca VARCHAR,
        nome_pesquisado VARCHAR,
        diario VARCHAR,
        observacoes TEXT,
        atribuida_para_id VARCHAR,
        atribuida_para_nome VARCHAR,
        data_atribuicao TIMESTAMP,
        tarefas_vinculadas JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(user_id, external_id)
      )
    `;
    
    await queryTenantSchema(tenantDB, createTableQuery);
    
    const alterColumns = [
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS urgencia VARCHAR DEFAULT 'media'`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS responsavel VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS vara_comarca VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS nome_pesquisado VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS diario VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS observacoes TEXT`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS atribuida_para_id VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS atribuida_para_nome VARCHAR`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS data_atribuicao TIMESTAMP`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS tarefas_vinculadas JSONB DEFAULT '[]'`,
      `ALTER TABLE \${schema}.${this.tableName} ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`,
      `ALTER TABLE \${schema}.${this.tableName} ALTER COLUMN status SET DEFAULT 'nova'`
    ];
    for (const stmt of alterColumns) {
      await queryTenantSchema(tenantDB, stmt);
    }
    
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON \${schema}.${this.tableName}(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_oab_number ON \${schema}.${this.tableName}(oab_number)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status ON \${schema}.${this.tableName}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_date ON \${schema}.${this.tableName}(publication_date)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_responsavel ON \${schema}.${this.tableName}(responsavel)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_urgencia ON \${schema}.${this.tableName}(urgencia)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_active ON \${schema}.${this.tableName}(is_active)`
    ];
    
    for (const indexQuery of indexes) {
      await queryTenantSchema(tenantDB, indexQuery);
    }
  }

  /**
   * Busca publicações do usuário (isolamento por usuário)
   */
  async getPublications(tenantDB: TenantDatabase, userId: string, filters: PublicationFilters = {}): Promise<{
    publications: Publication[];
    pagination: any;
  }> {
    await this.ensureTables(tenantDB);
    
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['is_active = TRUE', 'user_id = $1'];
    let queryParams: any[] = [userId];
    let paramIndex = 2;
    
    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }
    
    if (filters.source) {
      whereConditions.push(`source = $${paramIndex}`);
      queryParams.push(filters.source);
      paramIndex++;
    }
    
    if (filters.search) {
      whereConditions.push(`(content ILIKE $${paramIndex} OR process_number ILIKE $${paramIndex})`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    if (filters.dateFrom) {
      whereConditions.push(`publication_date >= $${paramIndex}`);
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }
    
    if (filters.dateTo) {
      whereConditions.push(`publication_date <= $${paramIndex}`);
      queryParams.push(filters.dateTo);
      paramIndex++;
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const publicationsQuery = `
      SELECT * FROM \${schema}.${this.tableName}
      ${whereClause}
      ORDER BY publication_date DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM \${schema}.${this.tableName} ${whereClause}`;
    
    const [publications, countResult] = await Promise.all([
      queryTenantSchema<Publication>(tenantDB, publicationsQuery, [...queryParams, limit, offset]),
      queryTenantSchema<{total: string}>(tenantDB, countQuery, queryParams)
    ]);
    
    const total = parseInt(countResult[0]?.total || '0');
    const totalPages = Math.ceil(total / limit);
    
    return {
      publications,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
    };
  }

  /**
   * Busca publicação por ID (com validação de usuário)
   */
  async getPublicationById(tenantDB: TenantDatabase, userId: string, publicationId: string): Promise<Publication | null> {
    await this.ensureTables(tenantDB);
    
    const query = `
      SELECT * FROM \${schema}.${this.tableName}
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
    `;
    
    const result = await queryTenantSchema<Publication>(tenantDB, query, [publicationId, userId]);
    return result[0] || null;
  }

  /**
   * Cria nova publicação
   */
  async createPublication(tenantDB: TenantDatabase, userId: string, publicationData: CreatePublicationData): Promise<Publication> {
    await this.ensureTables(tenantDB);
    
    const publicationId = `publication_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const data = {
      id: publicationId,
      user_id: userId,
      oab_number: publicationData.oabNumber,
      process_number: publicationData.processNumber || null,
      publication_date: publicationData.publicationDate,
      content: publicationData.content,
      source: publicationData.source,
      external_id: publicationData.externalId || null,
      status: publicationData.status || 'nova'
    };
    
    return await insertInTenantSchema<Publication>(tenantDB, this.tableName, data);
  }

  /**
   * Atualiza publicação (só do próprio usuário)
   */
  async updatePublication(tenantDB: TenantDatabase, userId: string, publicationId: string, updateData: UpdatePublicationData): Promise<Publication | null> {
    await this.ensureTables(tenantDB);

    const query = `
      UPDATE \${schema}.${this.tableName}
      SET 
        status = COALESCE($3, status),
        urgencia = COALESCE($4, urgencia),
        responsavel = COALESCE($5, responsavel),
        vara_comarca = COALESCE($6, vara_comarca),
        nome_pesquisado = COALESCE($7, nome_pesquisado),
        diario = COALESCE($8, diario),
        observacoes = COALESCE($9, observacoes),
        atribuida_para_id = COALESCE($10, atribuida_para_id),
        atribuida_para_nome = COALESCE($11, atribuida_para_nome),
        data_atribuicao = COALESCE($12::timestamptz, data_atribuicao),
        tarefas_vinculadas = COALESCE($13::jsonb, tarefas_vinculadas),
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
      RETURNING *
    `;

    const params = [
      publicationId,
      userId,
      updateData.status,
      updateData.urgencia,
      updateData.responsavel,
      updateData.varaComarca,
      updateData.nomePesquisado,
      updateData.diario,
      updateData.observacoes,
      updateData.atribuidaParaId,
      updateData.atribuidaParaNome,
      updateData.dataAtribuicao ? (updateData.dataAtribuicao instanceof Date ? updateData.dataAtribuicao.toISOString() : updateData.dataAtribuicao) : null,
      updateData.tarefasVinculadas ? JSON.stringify(updateData.tarefasVinculadas) : null,
    ];

    const result = await queryTenantSchema<Publication>(tenantDB, query, params);
    return result[0] || null;
  }

  /**
   * Remove publicação (soft delete - só do próprio usuário)
   */
  async deletePublication(tenantDB: TenantDatabase, userId: string, publicationId: string): Promise<boolean> {
    await this.ensureTables(tenantDB);
    
    const query = `
      UPDATE \${schema}.${this.tableName}
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
    `;
    
    const result = await queryTenantSchema(tenantDB, query, [publicationId, userId]);
    return result.length > 0;
  }

  /**
   * Obtém estatísticas das publicações do usuário
   */
  async getPublicationsStats(tenantDB: TenantDatabase, userId: string): Promise<{
    total: number;
    nova: number;
    pendente: number;
    atribuida: number;
    finalizada: number;
    descartada: number;
    thisMonth: number;
  }> {
    await this.ensureTables(tenantDB);
    
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'nova') as nova,
        COUNT(*) FILTER (WHERE status = 'pendente') as pendente,
        COUNT(*) FILTER (WHERE status = 'atribuida') as atribuida,
        COUNT(*) FILTER (WHERE status = 'finalizada') as finalizada,
        COUNT(*) FILTER (WHERE status = 'descartada') as descartada,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as this_month
      FROM \${schema}.${this.tableName}
      WHERE user_id = $1 AND is_active = TRUE
    `;
    
    const result = await queryTenantSchema<any>(tenantDB, query, [userId]);
    const stats = result[0];
    
    return {
      total: parseInt(stats.total || '0'),
      nova: parseInt(stats.nova || '0'),
      pendente: parseInt(stats.pendente || '0'),
      atribuida: parseInt(stats.atribuida || '0'),
      finalizada: parseInt(stats.finalizada || '0'),
      descartada: parseInt(stats.descartada || '0'),
      thisMonth: parseInt(stats.this_month || '0')
    };
  }
}

export const publicationsService = new PublicationsService();
