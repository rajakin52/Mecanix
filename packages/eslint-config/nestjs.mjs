// NestJS (Node) flavour — currently identical to base. Kept as its own
// entry so we can layer Node-specific rules (no-restricted-imports for
// fastify primitives, etc.) without touching every consumer.
import base from './base.mjs';

export default base;
