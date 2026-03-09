import Fastify from 'fastify';
import { devicesRouter } from './routes/devices';
import { commandsRouter } from './routes/commands';
import { tenantRouter } from './routes/tenant';

const server = Fastify({ logger: true });

void server.register(devicesRouter, { prefix: '/api/devices' });
void server.register(commandsRouter, { prefix: '/api/commands' });
void server.register(tenantRouter, { prefix: '/api/tenants' });

const start = async (): Promise<void> => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

void start();
