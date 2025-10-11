/**
 * PROJECTS SERVICE - Gestão de Projetos/Casos
 * ============================================
 *
 * ✅ ISOLAMENTO TENANT: Usa TenantDatabase e helpers de isolamento
 * ✅ SEM DADOS MOCK: Operações reais no PostgreSQL
 * ✅ ID AUTOMÁTICO: PostgreSQL gen_random_uuid()
 * ✅ CAST EXPLÍCITO: JSONB e DATE fields (tratados pelos helpers)
 *
 * Observação importante:
 * - NÃO usar JSON.stringify em campos JSON (tags, assigned_to, contacts, etc).
 *   Deixe o tenantHelpers serializar e aplicar ::jsonb automaticamente.
 */

import { TenantDatabase } from '../config/database';
import {
  queryTenantSchema,
  insertInTenantSchema,
  updateInTenantSchema,
  softDeleteInTenantSchema
} from '../utils/tenantHelpers';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Project {
  id: string;
  title: string;
  description?: string;
  client_id?: string;
  client_name: string;
  organization?: string;
  address?: string;
  budget?: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: 'contacted' | 'proposal' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high';
  progress: number;
  start_date: string;
  due_date: string;
  completed_at?: string;
  tags: string[];
  assigned_to: string[]; // array de user ids / objetos
  notes?: string;
  contacts: any[];
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  clientId?: string;
  clientName: string;
  organization?: string;
  address?: string;
  budget?: number;
  currency?: 'BRL' | 'USD' | 'EUR';
  status?: 'contacted' | 'proposal' | 'won' | 'lost';
  priority?: 'low' | 'medium' | 'high';
  progress?: number;
  startDate: string; // 'YYYY-MM-DD' ou ISO
  dueDate: string;   // 'YYYY-MM-DD' ou ISO
  tags?: string[];
  assignedTo?: string[]; // passar array (não string)
  notes?: string;
  contacts?: any[];      // passar array/obj (não string)
}

export interface UpdateProjectData extends Partial<CreateProjectData> {}

export interface ProjectFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  tags?: string[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class ProjectsService {
  private tableName = 'projects';

  /**
   * Garante que a tabela tenha todas as colunas necessárias
   */
  private async ensureTables(tenantDB: TenantDatabase): Promise<void> {
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = '\${schema}'
        AND table_name = '${this.tableName}'
      )
    `;

    const tableExists = await queryTenantSchema<{ exists: boolean }>(tenantDB, checkTableQuery);

    if (!tableExists || tableExists.length === 0 || !tableExists[0].exists) {
      console.log('Table projects does not exist in tenant schema');
      return;
    }

    // Adicionar colunas opcionais se não existirem (IF NOT EXISTS)
    const alterStatements = [
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS organization VARCHAR(255)`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS address VARCHAR(255)`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL'`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS assigned_to JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE \${schema}.projects ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb`
    ];

    for (const stmt of alterStatements) {
      try {
        await tenantDB.executeInTenantSchema(stmt);
      } catch (e) {
        console.log('Alter table statement failed (ignored):', e);
      }
    }

    // Migrações e preenchimentos seguros (com try/catch)
    try {
      await tenantDB.executeInTenantSchema(`
        UPDATE \${schema}.projects 
        SET due_date = end_date 
        WHERE due_date IS NULL AND end_date IS NOT NULL
      `);
    } catch (e) {
      console.log('Error migrating end_date to due_date:', e);
    }

    try {
      await tenantDB.executeInTenantSchema(`
        UPDATE \${schema}.projects 
        SET start_date = created_at 
        WHERE start_date IS NULL
      `);
    } catch (e) {
      console.log('Error filling NULL start_date:', e);
    }

    try {
      await tenantDB.executeInTenantSchema(`
        UPDATE \${schema}.projects 
        SET due_date = created_at + INTERVAL '30 days' 
        WHERE due_date IS NULL
      `);
    } catch (e) {
      console.log('Error filling NULL due_date:', e);
    }

    // Garantir NOT NULL (aplicar com cuidado)
    try {
      await tenantDB.executeInTenantSchema(`
        ALTER TABLE \${schema}.projects 
        ALTER COLUMN start_date SET NOT NULL
      `);
    } catch (e) {
      // pode já estar NOT NULL ou schema antigo
      console.log('Column start_date already NOT NULL or error:', e);
    }

    try {
      await tenantDB.executeInTenantSchema(`
        ALTER TABLE \${schema}.projects 
        ALTER COLUMN due_date SET NOT NULL
      `);
    } catch (e) {
      console.log('Column due_date already NOT NULL or error:', e);
    }
  }

  /**
   * Lista projetos com paginação e filtros
   */
  async getProjects(tenantDB: TenantDatabase, filters: ProjectFilters = {}): Promise<{
    projects: Project[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    await this.ensureTables(tenantDB);

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereConditions = ['is_active = TRUE'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.priority) {
      whereConditions.push(`priority = $${paramIndex}`);
      queryParams.push(filters.priority);
      paramIndex++;
    }

    if (filters.search) {
      whereConditions.push(`(
        title ILIKE $${paramIndex} OR 
        client_name ILIKE $${paramIndex} OR 
        organization ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`tags ?| $${paramIndex}`);
      queryParams.push(filters.tags);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const projectsQuery = `
      SELECT 
        id::text,
        title,
        COALESCE(description, '') as description,
        COALESCE(client_id::text, NULL) as client_id,
        client_name,
        COALESCE(organization, '') as organization,
        COALESCE(address, '') as address,
        COALESCE(budget::numeric, 0) as budget,
        COALESCE(currency, 'BRL') as currency,
        status,
        priority,
        COALESCE(progress, 0) as progress,
        to_char(start_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as start_date,
        to_char(due_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as due_date,
        CASE WHEN completed_at IS NOT NULL 
          THEN to_char(completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ELSE NULL 
        END as completed_at,
        COALESCE(tags::jsonb, '[]'::jsonb) as tags,
        COALESCE(assigned_to::jsonb, '[]'::jsonb) as assigned_to,
        COALESCE(notes, '') as notes,
        COALESCE(contacts::jsonb, '[]'::jsonb) as contacts,
        created_by VARCHAR NOT NULL,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
        is_active
      FROM \${schema}.${this.tableName}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM \${schema}.${this.tableName}
      WHERE ${whereClause}
    `;

    const [projects, countResult] = await Promise.all([
      queryTenantSchema<Project>(tenantDB, projectsQuery, [...queryParams, limit, offset]),
      queryTenantSchema<{ total: string }>(tenantDB, countQuery, queryParams)
    ]);

    const total = parseInt(countResult[0]?.total || '0');
    const totalPages = Math.ceil(total / limit);

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Busca projeto por ID
   */
  async getProjectById(tenantDB: TenantDatabase, projectId: string): Promise<Project | null> {
    await this.ensureTables(tenantDB);

    const query = `
      SELECT 
        id::text,
        title,
        COALESCE(description, '') as description,
        COALESCE(client_id::text, NULL) as client_id,
        client_name,
        COALESCE(organization, '') as organization,
        COALESCE(address, '') as address,
        COALESCE(budget::numeric, 0) as budget,
        COALESCE(currency, 'BRL') as currency,
        status,
        priority,
        COALESCE(progress, 0) as progress,
        to_char(start_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as start_date,
        to_char(due_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as due_date,
        CASE WHEN completed_at IS NOT NULL 
          THEN to_char(completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ELSE NULL 
        END as completed_at,
        COALESCE(tags::jsonb, '[]'::jsonb) as tags,
        COALESCE(assigned_to::jsonb, '[]'::jsonb) as assigned_to,
        COALESCE(notes, '') as notes,
        COALESCE(contacts::jsonb, '[]'::jsonb) as contacts,
        created_by VARCHAR NOT NULL,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
        is_active
      FROM \${schema}.${this.tableName}
      WHERE id::text = $1 AND is_active = TRUE
    `;

    const result = await queryTenantSchema<Project>(tenantDB, query, [projectId]);
    return result[0] || null;
  }

  /**
   * Cria novo projeto
   */
  async createProject(tenantDB: TenantDatabase, projectData: CreateProjectData, createdBy: string): Promise<Project> {
  await this.ensureTables(tenantDB);

  // Validações explícitas para clareza
  if (!projectData.title) throw new Error('Título é obrigatório');
  if (!projectData.clientName) throw new Error('Nome do cliente é obrigatório');
  if (!projectData.startDate) throw new Error('Data de início é obrigatória');
  if (!projectData.dueDate) throw new Error('Data de vencimento é obrigatória');
  if (!createdBy) throw new Error('Usuário criador não identificado');

  /**
   * ESTE OBJETO É A SOLUÇÃO DEFINITIVA.
   * A ordem e a completude das propriedades aqui correspondem EXATAMENTE
   * à ordem das colunas no seu arquivo `migration.sql`.
   */
  const data: Record<string, any> = {
    title: projectData.title,
    description: projectData.description || null,
    client_name: projectData.clientName,
    organization: projectData.organization || null,
    address: projectData.address || null,
    budget: projectData.budget ?? 0,
    currency: projectData.currency || 'BRL',
    status: projectData.status || 'contacted',
    priority: projectData.priority || 'medium',
    progress: projectData.progress ?? 0,
    start_date: projectData.startDate,
    due_date: projectData.dueDate,
    completed_at: null,
    tags: projectData.tags || [],
    assigned_to: projectData.assignedTo || [],
    notes: projectData.notes || null,
    contacts: projectData.contacts || [],
    created_by: createdBy,
  };
  if (projectData.clientId) {
    data.client_id = projectData.clientId;
  }

  // Executa a inserção no schema do tenant
  return await insertInTenantSchema<Project>(tenantDB, this.tableName, data);
}

  /**
   * Atualiza projeto existente
   */
  async updateProject(tenantDB: TenantDatabase, projectId: string, updateData: UpdateProjectData): Promise<Project | null> {
    await this.ensureTables(tenantDB);

    const data: Record<string, any> = {};

    if (updateData.title !== undefined) data.title = updateData.title;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.clientId !== undefined) data.client_id = updateData.clientId;
    if (updateData.clientName !== undefined) data.client_name = updateData.clientName;
    if (updateData.organization !== undefined) data.organization = updateData.organization;
    if (updateData.address !== undefined) data.address = updateData.address;
    if (updateData.budget !== undefined) data.budget = updateData.budget;
    if (updateData.currency !== undefined) data.currency = updateData.currency;
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.priority !== undefined) data.priority = updateData.priority;
    if (updateData.progress !== undefined) data.progress = updateData.progress;
    if (updateData.startDate !== undefined) data.start_date = updateData.startDate;
    if (updateData.dueDate !== undefined) data.due_date = updateData.dueDate;
    if (updateData.tags !== undefined) data.tags = updateData.tags;
    // NÃO serializar — passar array diretamente
    if (updateData.assignedTo !== undefined) data.assigned_to = updateData.assignedTo;
    if (updateData.notes !== undefined) data.notes = updateData.notes;
    if (updateData.contacts !== undefined) data.contacts = updateData.contacts;

    if (Object.keys(data).length === 0) {
      throw new Error('No fields to update');
    }

    return await updateInTenantSchema<Project>(tenantDB, this.tableName, projectId, data);
  }

  /**
   * Deleta projeto (soft delete)
   */
  async deleteProject(tenantDB: TenantDatabase, projectId: string): Promise<boolean> {
    await this.ensureTables(tenantDB);
    const project = await softDeleteInTenantSchema<Project>(tenantDB, this.tableName, projectId);
    return !!project;
  }

  /**
   * Estatísticas de projetos
   */
  async getProjectsStats(tenantDB: TenantDatabase): Promise<{
    total: number;
    avgProgress: number;
    overdue: number;
    revenue: number;
    byStatus: {
      contacted: number;
      proposal: number;
      won: number;
      lost: number;
    };
    byPriority: {
      low: number;
      medium: number;
      high: number;
    };
  }> {
    await this.ensureTables(tenantDB);

    const query = `
      SELECT 
        COUNT(*) as total,
        COALESCE(AVG(progress), 0) as avg_progress,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('won', 'lost')) as overdue,
        COALESCE(SUM(CASE WHEN status = 'won' THEN budget ELSE 0 END), 0) as revenue,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE status = 'proposal') as proposal,
        COUNT(*) FILTER (WHERE status = 'won') as won,
        COUNT(*) FILTER (WHERE status = 'lost') as lost,
        COUNT(*) FILTER (WHERE priority = 'low') as priority_low,
        COUNT(*) FILTER (WHERE priority = 'medium') as priority_medium,
        COUNT(*) FILTER (WHERE priority = 'high') as priority_high
      FROM \${schema}.${this.tableName}
      WHERE is_active = TRUE
    `;

    const result = await queryTenantSchema<any>(tenantDB, query);
    const stats = result[0];

    return {
      total: parseInt(stats.total || '0'),
      avgProgress: Math.round(parseFloat(stats.avg_progress || '0')),
      overdue: parseInt(stats.overdue || '0'),
      revenue: parseFloat(stats.revenue || '0'),
      byStatus: {
        contacted: parseInt(stats.contacted || '0'),
        proposal: parseInt(stats.proposal || '0'),
        won: parseInt(stats.won || '0'),
        lost: parseInt(stats.lost || '0')
      },
      byPriority: {
        low: parseInt(stats.priority_low || '0'),
        medium: parseInt(stats.priority_medium || '0'),
        high: parseInt(stats.priority_high || '0')
      }
    };
  }
}

export const projectsService = new ProjectsService();
