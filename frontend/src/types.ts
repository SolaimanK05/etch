// TypeScript interfaces mirroring backend/etch/models.py one-to-one.
// Any change to models.py must be reflected here.

export interface ImportDetail {
  importer: string;
  imported: string;
  file: string;
  line: number;
  code: string;
}

export interface Layer {
  id: string;
  module: string;
  files: number;
}

export interface Dependency {
  source: string;
  target: string;
  imports: ImportDetail[];
}

export interface ArchGraph {
  root_package: string;
  layers: Layer[];
  dependencies: Dependency[];
}

export interface Arrow {
  source: string;
  target: string;
}

export interface Drawing {
  layers: string[];
  arrows: Arrow[];
}

export interface Violation {
  source: string;
  target: string;
  imports: ImportDetail[];
}

export interface ScanRequest {
  repo_path?: string;
  root_package?: string | null;
}

export interface CheckRequest extends ScanRequest {
  drawing: Drawing;
}

export interface CheckResponse {
  violations: Violation[];
}

export interface ContractsResponse {
  importlinter: string;
}

export interface Note {
  text: string;
  source?: string | null;
  target?: string | null;
}

export interface EtchItRequest extends CheckRequest {
  notes?: Note[];
}

export interface PrRequest extends ScanRequest {
  message?: string;
}

export interface PrResponse {
  branch: string;
  commit: string;
  pushed: boolean;
  url?: string | null;
}

export interface EtchItResponse {
  written: string[];
  importlinter: string;
}

export interface MakeItSoRequest extends CheckRequest {
  max_cost?: number;
}

export interface BobEvent {
  type: string;
  data: Record<string, unknown>;
}
