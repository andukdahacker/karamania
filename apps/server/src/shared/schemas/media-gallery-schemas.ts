import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

const mediaGalleryItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  venueName: z.string().nullable(),
  url: z.string().nullable(),
  triggerType: z.string(),
  createdAt: z.string(),
  sessionDate: z.string(),
});

const mediaGalleryResponseSchema = dataResponseSchema(z.object({
  captures: z.array(mediaGalleryItemSchema),
  total: z.number(),
}));

const mediaGalleryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).default(0),
});

z.globalRegistry.add(mediaGalleryItemSchema, { id: 'MediaGalleryItem' });
z.globalRegistry.add(mediaGalleryResponseSchema, { id: 'MediaGalleryResponse' });
z.globalRegistry.add(mediaGalleryQuerySchema, { id: 'MediaGalleryQuery' });

export { mediaGalleryItemSchema, mediaGalleryResponseSchema, mediaGalleryQuerySchema };
