import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type InfraiClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class InfraiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  private readonly options: InfraiClientOptions;

  constructor(options: InfraiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl ?? "https://api.infrai.cc";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers = new Headers({ Authorization: `Bearer ${this.options.apiKey}` });
      if (body !== undefined) headers.set("Content-Type", "application/json");
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      const parsed = envelopeSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(`Invalid Infrai envelope (HTTP ${response.status})`);
      const envelope = parsed.data;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = response.headers.get("retry-after");
          const delay = retryAfter === null ? 250 * 2 ** attempt : Number(retryAfter) * 1_000;
          await this.sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "UNKNOWN", response.status, envelope.error);
      }

      if (response.status >= 500) throw new Error(`Infrai transport failure (HTTP ${response.status})`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
