import Fastify from 'fastify';
import cors from '@fastify/cors';
import { devicesRouter } from './routes/devices';
import { commandsRouter } from './routes/commands';
import { tenantRouter } from './routes/tenant';
import { irRouter } from './routes/ir';

const server = Fastify({ logger: true });

// Allow requests from any origin (React Native / Expo dev builds).
void server.register(cors, { origin: true });

void server.register(devicesRouter, { prefix: '/api/devices' });
void server.register(commandsRouter, { prefix: '/api/commands' });
void server.register(tenantRouter, { prefix: '/api/tenants' });
void server.register(irRouter, { prefix: '/api/ir' });

const start = async (): Promise<void> => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

void start();
