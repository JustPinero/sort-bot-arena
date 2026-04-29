import { Hono } from 'hono';

export const app = new Hono();

app.get('/api/healthz', (c) => c.text('ok'));
