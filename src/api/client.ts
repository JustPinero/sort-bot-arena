import { useAuthStore } from '@/stores/auth';

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

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    fields?: ApiErrorField[];
    retryable: boolean;
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.fields = args.fields;
    this.retryable = args.retryable;
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
  headers?: Record<string, string>;
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

  if (!opts?.skipAuth) {
    const apiKey = useAuthStore.getState().apiKey;
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
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
    throw new ApiError({
      status: response.status,
      code: envelope.code ?? `http_${response.status}`,
      message: envelope.error ?? (response.statusText || 'request failed'),
      requestId: envelope.request_id ?? response.headers.get('X-Request-Id') ?? undefined,
      fields: envelope.fields,
      retryable: response.status >= 500,
    });
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, opts);
  },
  post<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, opts);
  },
  patch<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, opts);
  },
  put<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, opts);
  },
  delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, opts);
  },
};
