import type { QueryResponse, ExplainResponse, ResetResponse, KataListResponse, Kata } from "./types";

const API_BASE = "/api";

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch {
		throw new Error("Cannot reach the backend server. Is it running on port 8080?");
	}

	const text = await res.text();
	if (!text) {
		throw new Error(`Server returned an empty response (HTTP ${res.status}).`);
	}

	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(`Server returned invalid JSON (HTTP ${res.status}).`);
	}
}

export async function executeQuery(query: string): Promise<QueryResponse> {
	try {
		return await safeFetch<QueryResponse>(`${API_BASE}/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
	} catch (error) {
		return { success: false, error: (error as Error).message, rows: [], columns: [] };
	}
}

export async function explainQuery(query: string): Promise<ExplainResponse> {
	try {
		return await safeFetch<ExplainResponse>(`${API_BASE}/explain`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
	} catch (error) {
		return { success: false, error: (error as Error).message, plan: null };
	}
}

export async function resetDataset(): Promise<ResetResponse> {
	try {
		return await safeFetch<ResetResponse>(`${API_BASE}/reset`, { method: "POST" });
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function healthCheck(): Promise<{ status: string; database: string }> {
	return safeFetch(`${API_BASE}/health`);
}

export async function fetchKataList(): Promise<KataListResponse> {
	return safeFetch<KataListResponse>(`${API_BASE}/katas`);
}

export async function fetchKata(id: string): Promise<Kata> {
	return safeFetch<Kata>(`${API_BASE}/katas/${id}`);
}
