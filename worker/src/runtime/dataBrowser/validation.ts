import type {
	DataBrowserQueryRequest,
	DataBrowserQueryScope,
	DataBrowserQueryType,
	DataBrowserQueryViewState,
} from "./types";

interface ValidationSuccess<T> {
	ok: true;
	value: T;
}

interface ValidationFailure {
	ok: false;
	error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QUERY_TYPES = new Set<DataBrowserQueryType>([
	"division_players",
	"division_standings",
	"team_overview",
	"team_players",
	"team_schedule",
]);

const parseInteger = (
	value: unknown,
	fieldName: string,
): ValidationResult<number> => {
	if (!Number.isInteger(value)) {
		return { ok: false, error: `${fieldName} must be an integer` };
	}

	return { ok: true, value: value as number };
};

const parseString = (
	value: unknown,
	fieldName: string,
): ValidationResult<string> => {
	if (typeof value !== "string" || value.trim().length === 0) {
		return { ok: false, error: `${fieldName} must be a non-empty string` };
	}

	return { ok: true, value: value.trim() };
};

const parseNullableString = (
	value: unknown,
	fieldName: string,
): ValidationResult<string | null> => {
	if (value === null) {
		return { ok: true, value: null };
	}

	return parseString(value, fieldName);
};

const parseUuid = (
	value: unknown,
	fieldName: string,
): ValidationResult<string> => {
	const parsed = parseString(value, fieldName);
	if (!parsed.ok) {
		return parsed;
	}

	if (!UUID_PATTERN.test(parsed.value)) {
		return { ok: false, error: `${fieldName} must be a valid UUID` };
	}

	return parsed;
};

const parseNullableUuid = (
	value: unknown,
	fieldName: string,
): ValidationResult<string | null> => {
	if (value === null) {
		return { ok: true, value: null };
	}

	return parseUuid(value, fieldName);
};

const parseQueryType = (
	value: unknown,
): ValidationResult<DataBrowserQueryType> => {
	if (
		typeof value !== "string" ||
		!QUERY_TYPES.has(value as DataBrowserQueryType)
	) {
		return {
			ok: false,
			error: "queryType must be a supported data browser query",
		};
	}

	return { ok: true, value: value as DataBrowserQueryType };
};

const parseScope = (
	value: unknown,
): ValidationResult<DataBrowserQueryScope> => {
	if (!value || typeof value !== "object") {
		return { ok: false, error: "scope must be an object" };
	}

	const scope = value as Record<string, unknown>;
	const seasonYear = parseInteger(scope.seasonYear, "scope.seasonYear");
	if (!seasonYear.ok) {
		return seasonYear;
	}

	const seasonNumber = parseInteger(scope.seasonNumber, "scope.seasonNumber");
	if (!seasonNumber.ok) {
		return seasonNumber;
	}

	const divisionId = parseUuid(scope.divisionId, "scope.divisionId");
	if (!divisionId.ok) {
		return divisionId;
	}

	const divisionName = parseString(scope.divisionName, "scope.divisionName");
	if (!divisionName.ok) {
		return divisionName;
	}

	const teamId = parseNullableUuid(scope.teamId, "scope.teamId");
	if (!teamId.ok) {
		return teamId;
	}

	const teamName = parseNullableString(scope.teamName, "scope.teamName");
	if (!teamName.ok) {
		return teamName;
	}

	return {
		ok: true,
		value: {
			seasonYear: seasonYear.value,
			seasonNumber: seasonNumber.value,
			divisionId: divisionId.value,
			divisionName: divisionName.value,
			teamId: teamId.value,
			teamName: teamName.value,
		},
	};
};

const parseViewState = (
	value: unknown,
): ValidationResult<DataBrowserQueryViewState> => {
	if (!value || typeof value !== "object") {
		return { ok: false, error: "viewState must be an object" };
	}

	const viewState = value as Record<string, unknown>;
	const page = parseInteger(viewState.page, "viewState.page");
	if (!page.ok || page.value < 1) {
		return { ok: false, error: "viewState.page must be a positive integer" };
	}

	const pageSize = parseInteger(viewState.pageSize, "viewState.pageSize");
	if (!pageSize.ok || pageSize.value < 1) {
		return {
			ok: false,
			error: "viewState.pageSize must be a positive integer",
		};
	}

	const sortKeyValue = viewState.sortKey;
	const sortKey =
		sortKeyValue === null
			? ({ ok: true, value: null } as const)
			: parseString(sortKeyValue, "viewState.sortKey");
	if (!sortKey.ok) {
		return sortKey;
	}

	const sortDirectionValue = viewState.sortDirection;
	if (
		sortDirectionValue !== null &&
		sortDirectionValue !== "asc" &&
		sortDirectionValue !== "desc"
	) {
		return {
			ok: false,
			error: "viewState.sortDirection must be asc, desc, or null",
		};
	}

	return {
		ok: true,
		value: {
			page: page.value,
			pageSize: pageSize.value,
			sortKey: sortKey.value,
			sortDirection: sortDirectionValue,
		},
	};
};

const validateScopeShape = (
	queryType: DataBrowserQueryType,
	scope: DataBrowserQueryScope,
): ValidationResult<DataBrowserQueryScope> => {
	const isTeamQuery =
		queryType === "team_overview" ||
		queryType === "team_players" ||
		queryType === "team_schedule";

	if (isTeamQuery) {
		if (!scope.teamId || !scope.teamName) {
			return {
				ok: false,
				error: "team queries require both scope.teamId and scope.teamName",
			};
		}
		return { ok: true, value: scope };
	}

	if (scope.teamId !== null || scope.teamName !== null) {
		return {
			ok: false,
			error: "division queries must not include team scope",
		};
	}

	return { ok: true, value: scope };
};

export const parseDataBrowserQueryRequest = (
	value: unknown,
): ValidationResult<DataBrowserQueryRequest> => {
	if (!value || typeof value !== "object") {
		return { ok: false, error: "request body must be an object" };
	}

	const payload = value as Record<string, unknown>;
	const queryType = parseQueryType(payload.queryType);
	if (!queryType.ok) {
		return queryType;
	}

	const scope = parseScope(payload.scope);
	if (!scope.ok) {
		return scope;
	}

	const scopeShape = validateScopeShape(queryType.value, scope.value);
	if (!scopeShape.ok) {
		return scopeShape;
	}

	const viewState = parseViewState(payload.viewState);
	if (!viewState.ok) {
		return viewState;
	}

	return {
		ok: true,
		value: {
			queryType: queryType.value,
			scope: scopeShape.value,
			viewState: viewState.value,
		},
	};
};
