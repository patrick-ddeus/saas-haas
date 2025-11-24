import { prisma } from '../config/database';

export class CodiloService {
  private baseUrl = process.env.CODILO_API_URL || 'https://api.codilo.com.br';

  private async getApiKey(tenantId: string): Promise<string | null> {
    const config = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
    if (!config || !config.codiloApiKey || config.isActive === false) return null;
    return config.codiloApiKey;
  }

  async searchProcessesByOAB(tenantId: string, oabNumber: string, uf: string): Promise<any[]> {
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Codilo API key not configured for tenant');

    const url = `${this.baseUrl}/consulta`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ oab: oabNumber, uf }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Codilo request failed: ${res.status} ${text}`);
    }
    const data: any = await res.json().catch(() => []);
    if (Array.isArray(data)) return data;
    return data?.results || data?.processos || [];
  }

  async getProcessDetails(tenantId: string, codigoCnj: string): Promise<any> {
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Codilo API key not configured for tenant');
    const url = `${this.baseUrl}/processo`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ cnj: codigoCnj }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Codilo request failed: ${res.status} ${text}`);
    }
    return await res.json().catch(() => ({}));
  }
}

export const codiloService = new CodiloService();