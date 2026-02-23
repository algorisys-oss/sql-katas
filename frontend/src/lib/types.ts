export interface QueryResult {
	success: true;
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	limited: boolean;
}

export interface QueryError {
	success: false;
	error: string;
	rows: [];
	columns: [];
}

export type QueryResponse = QueryResult | QueryError;

export interface ExplainResponse {
	success: boolean;
	plan: unknown;
	error?: string;
}

export interface ResetResponse {
	success: boolean;
	message?: string;
	error?: string;
}
