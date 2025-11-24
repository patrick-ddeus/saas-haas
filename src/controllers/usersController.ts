import { Request, Response } from 'express';
import { prisma } from '../config/database';
import * as z from 'zod';

const listCollaboratorsQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
  accountType: z.enum(['SIMPLES', 'COMPOSTA', 'GERENCIAL']).optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional(),
});

export const usersController = {
  async getCollaborators(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      console.log("🚀 ~ user:", user)
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'Tenant context not found' });
      }

      const query = listCollaboratorsQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ error: 'Invalid query params', details: query.error.flatten() });
      }
      const { status, accountType, search, limit, page } = query.data;

      const where: any = {
        tenantId: user.tenantId,
      };
      if (status && status !== 'all') {
        where.isActive = status === 'active';
      }
      if (accountType) {
        where.accountType = accountType;
      }
      if (search && search.trim()) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const take = Math.max(parseInt(limit || '100', 10), 1);
      const pageNum = Math.max(parseInt(page || '1', 10), 1);
      const skip = (pageNum - 1) * take;

      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            accountType: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { name: 'asc' },
          take,
          skip,
        }),
        prisma.user.count({ where }),
      ]);

      return res.json({
        collaborators: rows,
        pagination: { total, page: pageNum, limit: take },
      });
    } catch (error) {
      console.error('[UsersController] getCollaborators error:', error);
      return res.status(500).json({ error: 'Failed to fetch collaborators' });
    }
  },
};