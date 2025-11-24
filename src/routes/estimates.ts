import { Router } from 'express';
import { estimatesController } from '../controllers/estimatesController';
import { authenticateToken, tenantMiddleware, requireAccountType } from '../middleware/auth';

const router = Router();

// Require authentication and tenant
router.use(authenticateToken);
router.use(tenantMiddleware);

// Billing data only for COMPOSTA and GERENCIAL
router.use(requireAccountType(['COMPOSTA', 'GERENCIAL']));

router.get('/', estimatesController.getEstimates);
router.get('/:id', estimatesController.getEstimate);
router.post('/', estimatesController.createEstimate);
router.put('/:id', estimatesController.updateEstimate);
router.delete('/:id', estimatesController.deleteEstimate);
router.get('/stats/overview', estimatesController.getEstimatesStats);

export default router;