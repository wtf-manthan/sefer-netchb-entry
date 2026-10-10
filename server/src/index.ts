/**
 * Server Entrypoint
 */

import { app } from './app';
import { config } from './config';

app.listen(config.port, () => {
  console.log(`[NetCHB Server] Listening on port ${config.port}`);
  console.log(`[NetCHB Server] Extraction Model: ${config.llmModel}`);
  console.log(`[NetCHB Server] Cache Directory: ${config.extractionCacheDir}`);
});
