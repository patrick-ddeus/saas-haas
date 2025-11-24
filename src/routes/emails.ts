import { Router } from 'express';
import { emailsController } from '../controllers/emailsController';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';

const router = Router();

// Segurança: requer usuário autenticado e contexto de tenant
router.use(authenticateToken);
router.use(tenantMiddleware);

// Envio de email via Resend
router.post('/send', emailsController.sendEmail);

export default router;