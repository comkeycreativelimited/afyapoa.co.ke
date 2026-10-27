/**
 * COMKEY AFYA POA — Synthetic Local Mock Server Entrypoint
 */

import type { Express } from 'express';
import { config } from '@afyapoa/config';
import { logger } from '@afyapoa/logger';
import { createMockApp } from './app.js';

export * from './app.js';

const app: Express = createMockApp();
const port = config.MOCK_SERVER_PORT;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info(`[MOCK GATEWAY] DHA HIE & SHA Claims Mock Simulator running on http://localhost:${port}`, {
      port,
      health: `http://localhost:${port}/health`,
    });
  });
}

export { app };
