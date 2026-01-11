import { Router } from 'express';
import { submitContactForm } from '../controllers/contactController';

const router = Router();

// Public route - no auth required
router.post('/', submitContactForm);

export default router;
