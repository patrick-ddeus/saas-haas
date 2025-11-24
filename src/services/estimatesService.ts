import { TenantDatabase } from '../config/database';
import {
  queryTenantSchema,
  insertInTenantSchema,
  updateInTenantSchema,
  softDeleteInTenantSchema,
} from '../utils/tenantHelpers';

export interface EstimateItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax?: number;
}

export interface Estimate {
  id: string;
  number: string;
  title: string;
  description?: string;
  client_id?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'pending' | 'cancelled';
  date: string; 
  valid_until?: string;
  items: EstimateItem[];
  tags: string[];
  notes?: string;
  converted_to_invoice: boolean;
  invoice_id?: string;
  email_sent: boolean;
  email_sent_at?: string;
  reminders_sent: number;
  last_reminder_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CreateEstimateData {
  number: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  amount: number;
  currency?: 'BRL' | 'USD' | 'EUR';
  status?: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'pending' | 'cancelled';
  date: string; 
  validUntil?: string;
  items?: EstimateItem[];
  tags?: string[];
  notes?: string;
}

export interface UpdateEstimateData extends Partial<CreateEstimateData> {
  convertedToInvoice?: boolean;
  invoiceId?: string;
}

export interface EstimateFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  tags?: string[];
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

class EstimatesService {
  private tableName = 'estimates';

  private async ensureTables(tenantDB: TenantDatabase): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \${schema}.${this.tableName} (
        id VARCHAR PRIMARY KEY,
        number VARCHAR NOT NULL UNIQUE,
        title VARCHAR NOT NULL,
        description TEXT,
        client_id VARCHAR,
        client_name VARCHAR NOT NULL,
        client_email VARCHAR,
        client_phone VARCHAR,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'BRL',
        status VARCHAR DEFAULT 'draft',
        date DATE NOT NULL,
        valid_until DATE,
        items JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        notes TEXT,
        converted_to_invoice BOOLEAN DEFAULT FALSE,
        invoice_id VARCHAR,
        email_sent BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP,
        reminders_sent INTEGER DEFAULT 0,
        last_reminder_at TIMESTAMP,
        created_by VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `;
    await queryTenantSchema(tenantDB, createTableQuery);

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_number ON \${schema}.${this.tableName}(number)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_client_name ON \${schema}.${this.tableName}(client_name)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status ON \${schema}.${this.tableName}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_date ON \${schema}.${this.tableName}(date)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_valid_until ON \${schema}.${this.tableName}(valid_until)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_active ON \${schema}.${this.tableName}(is_active)`
    ];
    for (const q of indexes) {
      try {
        await queryTenantSchema(tenantDB, q);
      } catch (e: any) {
        const msg = e?.meta?.message || e?.message || '';
        if (msg.includes('already exists')) {
          continue;
        }
        throw e;
      }
    }
  }

  async getEstimates(tenantDB: TenantDatabase, filters: EstimateFilters = {}) {
    await this.ensureTables(tenantDB);

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const where: string[] = ['is_active = TRUE'];
    const params: any[] = [];
    let i = 1;

    if (filters.status) {
      where.push(`status = $${i}`); params.push(filters.status); i++;
    }
    if (filters.search) {
      where.push(`(number ILIKE $${i} OR title ILIKE $${i} OR client_name ILIKE $${i})`);
      params.push(`%${filters.search}%`); i++;
    }
    if (filters.clientId) {
      where.push(`client_id = $${i}`); params.push(filters.clientId); i++;
    }
    if (filters.tags && filters.tags.length) {
      where.push(`tags ?| $${i}`); params.push(filters.tags); i++;
    }
    if (filters.dateFrom) {
      where.push(`date >= $${i}`); params.push(filters.dateFrom); i++;
    }
    if (filters.dateTo) {
      where.push(`date <= $${i}`); params.push(filters.dateTo); i++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listQuery = `
      SELECT * FROM \${schema}.${this.tableName}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const countQuery = `SELECT COUNT(*) AS total FROM \${schema}.${this.tableName} ${whereClause}`;

    const [rows, countRows] = await Promise.all([
      queryTenantSchema<Estimate>(tenantDB, listQuery, [...params, limit, offset]),
      queryTenantSchema<{ total: string }>(tenantDB, countQuery, params),
    ]);

    const total = parseInt(countRows[0]?.total || '0');
    return {
      estimates: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getEstimateById(tenantDB: TenantDatabase, id: string): Promise<Estimate | null> {
    await this.ensureTables(tenantDB);
    const q = `SELECT * FROM \${schema}.${this.tableName} WHERE id = $1 AND is_active = TRUE`;
    const r = await queryTenantSchema<Estimate>(tenantDB, q, [id]);
    return r[0] || null;
  }

  async createEstimate(tenantDB: TenantDatabase, data: CreateEstimateData, createdBy: string): Promise<Estimate> {
    await this.ensureTables(tenantDB);

    const estimateId = `estimate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    // Garantir client_name quando só clientId é fornecido
    let clientName = data.clientName;
    if ((!clientName || clientName.trim() === '') && data.clientId) {
      try {
        const r = await queryTenantSchema<{ name: string }>(tenantDB, `SELECT name FROM \${schema}.clients WHERE id = $1 LIMIT 1`, [ data.clientId ]);
        clientName = r[0]?.name || '';
      } catch {}
    }
    if (!clientName || clientName.trim() === '') clientName = 'Cliente';

    const record = {
      id: estimateId,
      number: data.number,
      title: data.title,
      description: data.description,
      client_id: data.clientId || null,
      client_name: clientName,
      client_email: data.clientEmail,
      client_phone: data.clientPhone,
      amount: data.amount,
      currency: data.currency || 'BRL',
      status: data.status || 'draft',
      date: data.date,
      valid_until: data.validUntil,
      items: data.items || [],
      tags: data.tags || [],
      notes: data.notes,
      converted_to_invoice: false,
      invoice_id: null,
      email_sent: false,
      reminders_sent: 0,
      created_by: createdBy,
    };

    const inserted = await insertInTenantSchema<Estimate>(tenantDB, this.tableName, record);
    return inserted;
  }

  async updateEstimate(tenantDB: TenantDatabase, id: string, payload: UpdateEstimateData): Promise<Estimate | null> {
    await this.ensureTables(tenantDB);

    const data: any = {};
    if (payload.number !== undefined) data.number = payload.number;
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.clientId !== undefined) data.client_id = payload.clientId;
    if (payload.clientName !== undefined) data.client_name = payload.clientName;
    if (payload.clientEmail !== undefined) data.client_email = payload.clientEmail;
    if (payload.clientPhone !== undefined) data.client_phone = payload.clientPhone;
    if (payload.amount !== undefined) data.amount = payload.amount;
    if (payload.currency !== undefined) data.currency = payload.currency;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.date !== undefined) data.date = payload.date;
    if (payload.validUntil !== undefined) data.valid_until = payload.validUntil;
    if (payload.items !== undefined) data.items = payload.items;
    if (payload.tags !== undefined) data.tags = payload.tags;
    if (payload.notes !== undefined) data.notes = payload.notes;
    if (payload.convertedToInvoice !== undefined) data.converted_to_invoice = payload.convertedToInvoice;
    if (payload.invoiceId !== undefined) data.invoice_id = payload.invoiceId;

    if (Object.keys(data).length === 0) {
      throw new Error('No fields to update');
    }

    const updated = await updateInTenantSchema<Estimate>(tenantDB, this.tableName, id, data);
    return updated || null;
  }

  async deleteEstimate(tenantDB: TenantDatabase, id: string): Promise<boolean> {
    await this.ensureTables(tenantDB);
    return await softDeleteInTenantSchema(tenantDB, this.tableName, id);
  }

  async getEstimatesStats(tenantDB: TenantDatabase): Promise<{
    total: number;
    draft: number;
    pending: number;
    sent: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    thisMonth: number;
  }> {
    await this.ensureTables(tenantDB);

    const q = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW())), 0) AS this_month
      FROM \${schema}.${this.tableName}
      WHERE is_active = TRUE
    `;
    const r = await queryTenantSchema<any>(tenantDB, q);
    const s = r[0];

    return {
      total: parseInt(s.total || '0'),
      draft: parseInt(s.draft || '0'),
      pending: parseInt(s.pending || '0'),
      sent: parseInt(s.sent || '0'),
      approved: parseInt(s.approved || '0'),
      rejected: parseInt(s.rejected || '0'),
      totalAmount: parseFloat(s.total_amount || '0'),
      thisMonth: parseFloat(s.this_month || '0'),
    };
  }
}

export const estimatesService = new EstimatesService();