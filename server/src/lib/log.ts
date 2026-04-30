import { pino } from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { svc: 'sort-bot-arena-server' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'api_key',
      '*.api_key',
    ],
    censor: '[redacted]',
  },
});
