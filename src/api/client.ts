import type { ZodType, ZodTypeAny, z } from 'zod';

import { config } from './config';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiErrorField {
  path: string;
  message: string;
}

export class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly fields: ApiErrorField[] | undefined;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    fields?: ApiErrorField[];
    retryable: boolean;
    retryAfterSeconds?: number;
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.fields = args.fields;
    this.retryable = args.retryable;
    this.retryAfterSeconds = args.retryAfterSeconds;
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
  headers?: Record<string, string>;
  schema?: ZodType<unknown>;
}

export interface RequestOptionsWithSchema<S extends ZodTypeAny> extends Omit<RequestOptions, 'schema'> {
  schema: S;
}

interface ErrorEnvelope {
  error?: string;
  code?: string;
  request_id?: string;
  fields?: ApiErrorField[];
}

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  opts: RequestOptions | undefined,
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const headers = new Headers(opts?.headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      // Cookie auth — backend reads the `session` HttpOnly cookie. Browsers
      // require credentials: 'include' for cross-origin cookies even with
      // Access-Control-Allow-Credentials on the server.
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        code: 'timeout',
        message: `request to ${path} timed out after ${timeoutMs}ms`,
        retryable: true,
      });
    }
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: err instanceof Error ? err.message : 'unknown network error',
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      // body may not be JSON; fall through with statusText
    }
    const retryAfterRaw = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : undefined;
    throw new ApiError({
      status: response.status,
      code: envelope.code ?? `http_${response.status}`,
      message: envelope.error ?? (response.statusText || 'request failed'),
      requestId: envelope.request_id ?? response.headers.get('X-Request-Id') ?? undefined,
      fields: envelope.fields,
      retryable: response.status >= 500,
      retryAfterSeconds:
        retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds
          : undefined,
    });
  }

  if (response.status === 204) return undefined as T;
  const raw: unknown = await response.json();
  if (opts?.schema) {
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError({
        status: 0,
        code: 'malformed_response',
        message: `${path}: ${parsed.error.issues[0]?.message ?? 'response did not match schema'}`,
        retryable: false,
      });
    }
    return parsed.data as T;
  }
  return raw as T;
}

interface ApiClient {
  get<S extends ZodTypeAny>(path: string, opts: RequestOptionsWithSchema<S>): Promise<z.infer<S>>;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<S extends ZodTypeAny>(
    path: string,
    body: unknown,
    opts: RequestOptionsWithSchema<S>,
  ): Promise<z.infer<S>>;
  post<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T>;
  patch<S extends ZodTypeAny>(
    path: string,
    body: unknown,
    opts: RequestOptionsWithSchema<S>,
  ): Promise<z.infer<S>>;
  patch<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T>;
  put<S extends ZodTypeAny>(
    path: string,
    body: unknown,
    opts: RequestOptionsWithSchema<S>,
  ): Promise<z.infer<S>>;
  put<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T>;
  delete<S extends ZodTypeAny>(path: string, opts: RequestOptionsWithSchema<S>): Promise<z.infer<S>>;
  delete<T>(path: string, opts?: RequestOptions): Promise<T>;
}

export const apiClient: ApiClient = {
  get(path: string, opts?: RequestOptions) {
    return request('GET', path, undefined, opts);
  },
  post(path: string, body: unknown, opts?: RequestOptions) {
    return request('POST', path, body, opts);
  },
  patch(path: string, body: unknown, opts?: RequestOptions) {
    return request('PATCH', path, body, opts);
  },
  put(path: string, body: unknown, opts?: RequestOptions) {
    return request('PUT', path, body, opts);
  },
  delete(path: string, opts?: RequestOptions) {
    return request('DELETE', path, undefined, opts);
  },
};
