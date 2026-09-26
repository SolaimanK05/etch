import type { ArchGraph, CheckRequest, CheckResponse, ContractsResponse, ScanRequest } from "./types";

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => ({}));
    const detail = (json as { detail?: string }).detail ?? resp.statusText;
    throw new Error(`${resp.status}: ${detail}`);
  }
  return resp.json() as Promise<T>;
}

export function health(): Promise<{ status: string; version: string }> {
  return fetch(`${BASE}/health`).then((r) => r.json());
}

export function scan(req: ScanRequest): Promise<ArchGraph> {
  return post<ArchGraph>("/scan", req);
}

export function check(req: CheckRequest): Promise<CheckResponse> {
  return post<CheckResponse>("/check", req);
}

export function contracts(req: CheckRequest): Promise<ContractsResponse> {
  return post<ContractsResponse>("/contracts", req);
}
