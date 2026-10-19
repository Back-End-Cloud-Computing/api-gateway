import { loadConfig } from './config.js';
import { buildApp, buildMetricsApp } from './server.js';

const config = loadConfig();
const app = await buildApp(config);
const metricsApp = buildMetricsApp(app.metricsRegistry);

await app.listen({ port: config.port, host: '0.0.0.0' });
await metricsApp.listen({ port: config.metricsPort, host: '0.0.0.0' });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void Promise.all([app.close(), metricsApp.close()]).then(() => process.exit(0));
  });
}
