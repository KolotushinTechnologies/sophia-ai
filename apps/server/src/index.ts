import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { TYPES, type IEmbeddingService } from '@sophia/domain';
import { createContainer } from './di/container.js';
import { registerRoutes } from './routes.js';
import { AuthService } from './services/AuthService.js';

async function main() {
  const { container, config } = await createContainer();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.webOrigin,
    credentials: true,
  });

  await app.register(jwt, { secret: config.jwtSecret });

  app.decorate('authenticate', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await registerRoutes(app, container);

  const auth = container.get<AuthService>(TYPES.AuthService);
  await auth.ensureAdminSeeded();

  const embeddings = container.get<IEmbeddingService>(TYPES.EmbeddingService);
  console.log('Warming up embedding model...');
  // Use hash mode for faster startup in dev unless explicitly local
  if (process.env.EMBEDDINGS_MODE !== 'local') {
    console.log('EMBEDDINGS_MODE!=local — HashEmbeddingService (set EMBEDDINGS_MODE=local for Xenova)');
  }
  await embeddings.warmUp();
  console.log('Embeddings ready.');

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Sophia server listening on :${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
