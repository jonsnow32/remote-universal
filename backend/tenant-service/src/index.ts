import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ status: 'ok' }));

void server.listen({ port: 3001, host: '0.0.0.0' });
