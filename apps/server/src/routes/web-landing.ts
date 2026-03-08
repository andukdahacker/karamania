import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webLandingRoot = path.join(__dirname, '../../../web_landing');

// Cache well-known files at startup (static content, never changes at runtime)
let aasaContent: string | null = null;
let assetlinksContent: string | null = null;

async function loadWellKnownFiles(): Promise<void> {
  const aasaPath = path.join(webLandingRoot, '.well-known/apple-app-site-association');
  const assetlinksPath = path.join(webLandingRoot, '.well-known/assetlinks.json');
  aasaContent = await fs.readFile(aasaPath, 'utf8');
  assetlinksContent = await fs.readFile(assetlinksPath, 'utf8');
}

export async function webLandingRoutes(fastify: FastifyInstance): Promise<void> {
  await loadWellKnownFiles();

  // Explicit routes for .well-known files (dotfiles ignored by @fastify/static)
  fastify.get('/.well-known/apple-app-site-association', async (_request, reply) => {
    if (!aasaContent) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'apple-app-site-association not available' } });
    }
    return reply.type('application/json').send(aasaContent);
  });

  fastify.get('/.well-known/assetlinks.json', async (_request, reply) => {
    if (!assetlinksContent) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'assetlinks.json not available' } });
    }
    return reply.type('application/json').send(assetlinksContent);
  });

  await fastify.register(fastifyStatic, {
    root: webLandingRoot,
    prefix: '/',
    decorateReply: false,
  });
}
