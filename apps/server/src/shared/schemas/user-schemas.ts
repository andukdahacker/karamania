import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const userProfileDataSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),  // ISO 8601 date string
});
z.globalRegistry.add(userProfileDataSchema, { id: 'UserProfileData' });

export const userProfileResponseSchema = dataResponseSchema(userProfileDataSchema);
z.globalRegistry.add(userProfileResponseSchema, { id: 'UserProfileResponse' });
