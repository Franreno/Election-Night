export interface PartyResult {
  party_code: string;
  party_name: string;
  votes: number;
  percentage: number;
}

export interface ConstituencyResponse {
  id: number;
  name: string;
  total_votes: number;
  winning_party_code: string | null;
  winning_party_name: string | null;
  pcon24_code: string | null;
  region_id: number | null;
  region_name: string | null;
  parties: PartyResult[];
}

export interface ConstituencyListResponse {
  total: number;
  page: number;
  page_size: number;
  constituencies: ConstituencyResponse[];
}

export interface PartyTotals {
  party_code: string;
  party_name: string;
  total_votes: number;
  seats: number;
}

export interface TotalResultsResponse {
  total_constituencies: number;
  total_votes: number;
  parties: PartyTotals[];
}

export interface ConstituencySummary {
  id: number;
  name: string;
  winning_party_code: string | null;
  pcon24_code: string | null;
  region_id: number | null;
  region_name: string | null;
}

export interface RegionSummary {
  id: number;
  name: string;
  sort_order: number;
  constituency_count: number;
}

export interface RegionListResponse {
  regions: RegionSummary[];
}

export interface RegionConstituency {
  id: number;
  name: string;
  pcon24_code: string | null;
  winning_party_code: string | null;
}

export interface RegionDetail {
  id: number;
  name: string;
  pcon24_codes: string[];
  constituencies: RegionConstituency[];
}

export interface ConstituencySummaryListResponse {
  total: number;
  constituencies: ConstituencySummary[];
}

export interface UploadResponse {
  upload_id: number;
  status: string;
  total_lines: number | null;
  processed_lines: number | null;
  error_lines: number | null;
  errors: Array<{ line: number; error: string }> | null;
}

export interface UploadLogEntry {
  id: number;
  filename: string | null;
  status: string;
  total_lines: number | null;
  processed_lines: number | null;
  error_lines: number | null;
  errors: Array<{ line: number; error: string }> | null;
  started_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface UploadListResponse {
  total: number;
  page: number;
  page_size: number;
  uploads: UploadLogEntry[];
}

export interface UploadStatsResponse {
  total_uploads: number;
  completed: number;
  failed: number;
  success_rate: number;
  total_lines_processed: number;
}

// SSE streaming upload events

export interface SSECreatedEvent {
  event: "created";
  upload_id: number;
  total_lines: number;
}

export interface SSEProgressEvent {
  event: "progress";
  processed_count: number;
  total: number;
  percentage: number;
}

export interface SSECompleteEvent {
  event: "complete";
  upload_id: number;
  status: string;
  total_lines: number;
  processed_lines: number;
  error_lines: number;
  errors: Array<{ line: number; error: string }> | null;
}

export interface SSEErrorEvent {
  event: "error";
  upload_id: number;
  detail: string;
}

export type SSEEvent =
  | SSECreatedEvent
  | SSEProgressEvent
  | SSECompleteEvent
  | SSEErrorEvent;

export interface UploadProgress {
  stage: "uploading" | "processing" | "complete" | "error";
  percentage: number;
  uploadId?: number;
}

// SSE streaming delete events

export interface DeleteSSEStartedEvent {
  event: "started";
  upload_id: number;
  total_affected: number;
}

export interface DeleteSSEProgressEvent {
  event: "progress";
  processed: number;
  total: number;
  percentage: number;
}

export interface DeleteSSECompleteEvent {
  event: "complete";
  upload_id: number;
  message: string;
  rolled_back: number;
}

export interface DeleteSSEErrorEvent {
  event: "error";
  upload_id: number;
  detail: string;
}

export type DeleteSSEEvent =
  | DeleteSSEStartedEvent
  | DeleteSSEProgressEvent
  | DeleteSSECompleteEvent
  | DeleteSSEErrorEvent;

export interface DeleteProgress {
  stage: "deleting" | "rolling_back" | "complete" | "error";
  percentage: number;
  uploadId?: number;
}
