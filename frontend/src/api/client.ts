// One typed function per operation in docs/openapi.yaml.
// VITE_USE_MOCK=1 swaps the transport for an in-memory fake (src/mocks/mockApi.ts).
import type {
  Board, DecisionCreate, DecisionResult, DisruptionCreate, DisruptionUpdate, ErrorBody,
  FeedCandidates, Method, Network, OptionsResponse, PresetList, Settings,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly error: ErrorBody['error'] | 'network';
  readonly field?: string;

  constructor(status: number, error: ErrorBody['error'] | 'network', message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.field = field;
  }
}

export type Method_ = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Transport = (method: Method_, path: string, body?: unknown) => Promise<unknown>;

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const httpTransport: Transport = async (method, path, body) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'The server could not be reached.');
  }
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ErrorBody>;
    throw new ApiError(
      res.status,
      e.error ?? 'internal_error',
      e.message ?? `Request failed with status ${res.status}.`,
      e.field,
    );
  }
  return data;
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const usingMock = import.meta.env.VITE_USE_MOCK === '1';

// The mock is a separate chunk, loaded only when mock mode is on.
const transportReady: Promise<Transport> = usingMock
  ? import('../mocks/mockApi').then((m) => m.mockTransport)
  : Promise.resolve(httpTransport);

const call = async <T>(method: Method_, path: string, body?: unknown): Promise<T> =>
  (await transportReady)(method, path, body) as Promise<T>;
const enc = encodeURIComponent;

export const getNetwork = () => call<Network>('GET', '/api/network');
export const getMethod = () => call<Method>('GET', '/api/method');
export const getBoard = () => call<Board>('GET', '/api/board');
export const putSettings = (s: Settings) => call<Board>('PUT', '/api/settings', s);
export const postReset = () => call<Board>('POST', '/api/reset');
export const getPresets = () => call<PresetList>('GET', '/api/presets');
export const createDisruption = (d: DisruptionCreate) => call<Board>('POST', '/api/disruptions', d);
export const updateDisruption = (id: string, u: DisruptionUpdate) =>
  call<Board>('PATCH', `/api/disruptions/${enc(id)}`, u);
export const deleteDisruption = (id: string) => call<Board>('DELETE', `/api/disruptions/${enc(id)}`);
export const getOptions = (shipmentId: string) =>
  call<OptionsResponse>('GET', `/api/shipments/${enc(shipmentId)}/options`);
export const createDecision = (d: DecisionCreate) => call<DecisionResult>('POST', '/api/decisions', d);
export const deleteDecision = (id: string) => call<Board>('DELETE', `/api/decisions/${enc(id)}`);
export const getFeedCandidates = () => call<FeedCandidates>('GET', '/api/feeds/candidates');
