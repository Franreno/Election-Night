import { apiFetch } from "./api-client";
import type {
  TotalResultsResponse,
  ConstituencyListResponse,
  ConstituencyResponse,
  ConstituencySummaryListResponse,
  UploadResponse,
  UploadListResponse,
  RegionListResponse,
  RegionDetail,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const fetchTotals = () =>
  apiFetch<TotalResultsResponse>("/api/totals");

export const fetchConstituencies = (params: {
  search?: string;
  region_ids?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
}) => {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.region_ids) qs.set("region_ids", params.region_ids);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  return apiFetch<ConstituencyListResponse>(`/api/constituencies?${qs}`);
};

export const fetchConstituency = (id: number) =>
  apiFetch<ConstituencyResponse>(`/api/constituencies/${id}`);

export const fetchUploads = (params?: {
  page?: number;
  page_size?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  return apiFetch<UploadListResponse>(`/api/uploads?${qs}`);
};

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || "Upload failed");
  }

  return res.json();
};

export const fetchConstituenciesSummary = () =>
  apiFetch<ConstituencySummaryListResponse>("/api/constituencies/summary");

export const fetchHealth = () =>
  apiFetch<{ status: string }>("/api/health");

export const fetchRegions = () =>
  apiFetch<RegionListResponse>("/api/geography/regions");

export const fetchRegionDetail = (id: number) =>
  apiFetch<RegionDetail>(`/api/geography/regions/${id}`);
