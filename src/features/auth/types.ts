export interface AuthUserSummary {
	id: string;
	email: string | null;
}

export interface AuthSession {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	user: AuthUserSummary;
}

export interface SessionCheckResult {
	authenticated: boolean;
	session?: {
		user: AuthUserSummary;
		expiresAt: number;
	};
}
