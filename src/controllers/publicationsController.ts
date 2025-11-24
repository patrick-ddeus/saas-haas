/**
 * PUBLICATIONS CONTROLLER - Gestão de Publicações Jurídicas
 * =========================================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa req.tenantDB para garantir isolamento por schema
 * ✅ ISOLAMENTO POR USUÁRIO: Publicações são isoladas por usuário (diferente de outros módulos)
 * ✅ SEM DADOS MOCK: Operações reais no banco de dados do tenant
 */

import { Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { publicationsService } from '../services/publicationsService';
import { codiloService } from '../services/codiloService';

const updatePublicationSchema = z.object({
  status: z.enum(['nova', 'pendente', 'atribuida', 'finalizada', 'descartada']).optional(),
  urgencia: z.enum(['baixa','media','alta']).optional(),
  responsavel: z.string().optional(),
  varaComarca: z.string().optional(),
  nomePesquisado: z.string().optional(),
  diario: z.string().optional(),
  observacoes: z.string().optional(),
  atribuidaParaId: z.string().optional(),
  atribuidaParaNome: z.string().optional(),
  dataAtribuicao: z.string().optional(),
  tarefasVinculadas: z.array(z.string()).optional(),
});

export class PublicationsController {
  async getPublications(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as string,
        source: req.query.source as string,
        search: req.query.search as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };

      const result = await publicationsService.getPublications(req.tenantDB, req.user.id, filters);
      
      res.json(result);
    } catch (error) {
      console.error('Get publications error:', error);
      res.status(500).json({
        error: 'Failed to fetch publications',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const publication = await publicationsService.getPublicationById(req.tenantDB, req.user.id, id);
      
      if (!publication) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({ publication });
    } catch (error) {
      console.error('Get publication error:', error);
      res.status(500).json({
        error: 'Failed to fetch publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updatePublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updatePublicationSchema.parse(req.body);
      const publication = await publicationsService.updatePublication(req.tenantDB, req.user.id, id, validatedData);
      
      if (!publication) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({
        message: 'Publication updated successfully',
        publication,
      });
    } catch (error) {
      console.error('Update publication error:', error);
      res.status(400).json({
        error: 'Failed to update publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deletePublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const success = await publicationsService.deletePublication(req.tenantDB, req.user.id, id);
      
      if (!success) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({
        message: 'Publication deleted successfully',
      });
    } catch (error) {
      console.error('Delete publication error:', error);
      res.status(500).json({
        error: 'Failed to delete publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPublicationsStats(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await publicationsService.getPublicationsStats(req.tenantDB, req.user.id);

      res.json(stats);
    } catch (error) {
      console.error('Get publications stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch publications statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async importFromCodilo(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        oabNumber: z.string().min(3),
        uf: z.string().min(2),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      });
      const body = schema.parse(req.body);

      const processes = await codiloService.searchProcessesByOAB(req.user.tenantId, body.oabNumber, body.uf);

      let created = 0;
      for (const p of processes) {
        const processNumber = p?.numero || p?.cnj || p?.codigo_cnj || '';
        const publicationDate = p?.data_publicacao || p?.data || new Date().toISOString().slice(0, 10);
        const content = p?.conteudo || p?.texto || JSON.stringify(p);
        const externalId = String(p?.id || p?.codigo || processNumber || Math.random());

        try {
          await publicationsService.createPublication(req.tenantDB, req.user.id, {
            oabNumber: body.oabNumber,
            processNumber,
            publicationDate,
            content,
            source: 'Codilo',
            externalId,
            status: 'nova',
          });
          created++;
        } catch (e) {
        }
      }

      res.json({ imported: created });
    } catch (error) {
      res.status(400).json({ error: 'Failed to import from Codilo', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async searchCodilo(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({ oabNumber: z.string().min(3), uf: z.string().min(2) });
      const query = schema.parse({ oabNumber: req.query.oabNumber as string, uf: req.query.uf as string });
      const results = await codiloService.searchProcessesByOAB(req.user.tenantId, query.oabNumber, query.uf);
      res.json({ results });
    } catch (error) {
      res.status(400).json({ error: 'Failed to search Codilo', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export const publicationsController = new PublicationsController();
