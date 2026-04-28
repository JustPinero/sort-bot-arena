import { z } from 'zod';

const schema = z.object({
  apiBaseUrl: z.string().url('VITE_API_BASE_URL must be a valid URL'),
});

const raw = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
};

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid frontend env (${message})`);
}

export const config = parsed.data;
