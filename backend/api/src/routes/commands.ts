import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CommandSchema = z.object({
  deviceId: z.string(),
  action: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export async function commandsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (req, reply) => {
    const result = CommandSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }
    return reply.send({ success: true, command: result.data });
  });
}
