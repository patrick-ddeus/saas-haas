import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { usersController } from '../controllers/usersController';

const router = Router();

// Authenticated users can list collaborators of their tenant
router.use(authenticateToken);

router.get('/collaborators', usersController.getCollaborators);

export default router;