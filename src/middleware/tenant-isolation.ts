
import { Request, Response, NextFunction } from 'express';

interface TenantRequest extends Request {
  user?: any;
  tenant?: {
    id: string;
    name: string;
    isActive: boolean;
  };
  tenantDB?: any;
  tenantId?: string;
}

export const validateTenantAccess = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin users bypass tenant validation (CONSISTÊNCIA: superadmin)
    if (user.role === 'admin' || user.role === 'superadmin') {
      return next();
    }

    // Regular users must have tenantId
    const userTenantId = user.tenantId || req.tenantId;
    if (!userTenantId) {
      console.error('User without tenantId attempting access:', user.id);
      return res.status(403).json({ 
        error: 'Access denied: Invalid user tenant association' 
      });
    }

    // OTIMIZADO: Busca direta por ID ao invés de getAllTenants + filter
    const { database, tenantDB } = await import('../config/database');
    const tenant = await database.getTenantById(userTenantId);
    
    if (!tenant) {
      console.error('Tenant not found:', userTenantId);
      return res.status(403).json({ 
        error: 'Access denied: Tenant not found' 
      });
    }
    
    if (!tenant.isActive) {
      console.error('Inactive tenant access attempt:', userTenantId);
      return res.status(403).json({ 
        error: 'Access denied: Tenant is inactive' 
      });
    }

    // Add tenant info to request
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive
    };

    // CRÍTICO: Adicionar TenantDatabase ao request para isolamento real
    try {
      req.tenantDB = await tenantDB.getTenantDatabase(userTenantId);
      console.log('TenantDB successfully injected for tenant:', userTenantId);
    } catch (dbError) {
      console.error('Error creating tenant database connection:', dbError);
      return res.status(500).json({ 
        error: 'Database connection error' 
      });
    }

    console.log('Tenant access validated:', {
      userId: user?.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      accountType: user.accountType
    });

    next();
  } catch (error) {
    console.error('Tenant validation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during tenant validation' 
    });
  }
};

export const ensureTenantIsolation = (allowedAccountTypes?: string[]) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // Skip for admin users (CONSISTÊNCIA: superadmin)
    if (user.role === 'admin' || user.role === 'superadmin') {
      return next();
    }

    // Check account type permissions if specified
    if (allowedAccountTypes && !allowedAccountTypes.includes(user.accountType)) {
      console.error('Insufficient permissions for account type:', {
        userId: user.userId,
        accountType: user.accountType,
        requiredTypes: allowedAccountTypes
      });
      
      return res.status(403).json({ 
        error: 'Access denied: Insufficient account permissions',
        requiredAccountTypes: allowedAccountTypes,
        currentAccountType: user.accountType
      });
    }

    next();
  };
};
