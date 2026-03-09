import { FastifyInstance } from 'fastify';

export async function devicesRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_req, reply) => {
    return reply.send({ devices: [] });
  });

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ id });
  });
}
