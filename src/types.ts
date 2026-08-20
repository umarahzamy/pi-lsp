export type ServerConfig = {
	cmd?: string[];
	command?: string;
	args?: string[];
	fileTypes: string[];
	rootMarkers: (string | string[])[];
	rootDir?: (startDir: string) => string | null;
	languageId?: string;
	settings?: Record<string, unknown>;
	initOptions?: Record<string, unknown>;
	capabilities?: Record<string, unknown>;
	isLinter?: boolean;
	warmupTimeoutMs?: number;
};

export type ResolvedServerConfig = ServerConfig & { resolved: string };

export type Position = { line: number; character: number };

export type Range = { start: Position; end: Position };

export type Diagnostic = {
	range: Range;
	severity?: 1 | 2 | 3 | 4;
	message: string;
	source?: string;
	code?: string | number;
};
