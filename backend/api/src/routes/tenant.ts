import { FastifyInstance } from 'fastify';

export async function tenantRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    return reply.send({
      id: tenantId,
      brandId: 'universal',
      name: 'Default Tenant',
      features: {},
      theme: {},
    });
  });
}
