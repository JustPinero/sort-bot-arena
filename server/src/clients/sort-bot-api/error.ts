export interface SortBotApiErrorBody {
  code?: string;
  error?: string;
  [k: string]: unknown;
}

export class SortBotApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: SortBotApiErrorBody | string | undefined;
  readonly requestId: string | undefined;

  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    body?: SortBotApiErrorBody | string;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'SortBotApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.body = opts.body;
    this.requestId = opts.requestId;
  }
}

export function isTransient(err: unknown): boolean {
  if (!(err instanceof SortBotApiError)) return false;
  return err.status >= 500 || err.status === 429;
}
