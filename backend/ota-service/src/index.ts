import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ status: 'ok' }));

server.get('/latest', async (req, reply) => {
  const { brand, current } = req.query as { brand: string; current: string };
  return reply.send({
    brand,
    currentVersion: current,
    hasUpdate: false,
  });
});

void server.listen({ port: 3002, host: '0.0.0.0' });
