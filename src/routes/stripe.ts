import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { stripeController } from '../controllers/stripeController';

const router = Router();

router.post('/checkout/session', authenticateToken, (req, res) => stripeController.createCheckoutSession(req as any, res));

export default router;