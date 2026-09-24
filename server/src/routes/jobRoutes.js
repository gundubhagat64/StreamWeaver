import { Router } from 'express';

import {
  getJobStatus,
} from '../controllers/jobController.js';

const router = Router();

router.get('/:jobId', getJobStatus);

export default router;
