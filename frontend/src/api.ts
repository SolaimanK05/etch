import type { ArchGraph, CheckRequest, CheckResponse, ContractsResponse, EtchItRequest, EtchItResponse, PrRequest, PrResponse, ScanRequest } from "./types";

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

export function etchIt(req: EtchItRequest): Promise<EtchItResponse> {
  return post<EtchItResponse>("/etch-it", req);
}

export function openPr(req: PrRequest): Promise<PrResponse> {
  return post<PrResponse>("/pr", req);
}

export function stopRun(): Promise<{ stopped: boolean }> {
  return post<{ stopped: boolean }>("/stop", {});
}

export function undo(repo_path: string): Promise<{ undone: boolean }> {
  return post<{ undone: boolean }>("/undo", { repo_path });
}
