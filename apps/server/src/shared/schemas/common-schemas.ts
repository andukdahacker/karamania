import { z } from 'zod/v4';

export const errorDataSchema = z.object({
  code: z.string(),
  message: z.string(),
});
z.globalRegistry.add(errorDataSchema, { id: 'ErrorData' });

export const errorResponseSchema = z.object({
  error: errorDataSchema,
});
z.globalRegistry.add(errorResponseSchema, { id: 'ErrorResponse' });

export function dataResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
  });
}
