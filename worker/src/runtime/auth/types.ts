export interface AuthUserSummary {
	id: string;
	email: string | null;
}

export interface AuthSessionPayload {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	user: AuthUserSummary;
}

export interface AuthSessionResponse {
	authenticated: boolean;
	session?: {
		user: AuthUserSummary;
		expiresAt: number;
	};
}

export interface AuthLoginStartBody {
	email: string;
}

export interface OtpRequestBody {
	email: string;
	turnstileToken: string | null;
	inviteCode?: string | null;
}

export interface OtpVerifyBody {
	email: string;
	code: string;
}

export interface RefreshBody {
	refreshToken: string;
}

export interface SignOutBody {
	refreshToken?: string;
}

export interface VerifyStateSnapshot {
	failedAttempts: number;
	cooldownUntil: Date | null;
	lockedUntil: Date | null;
	lastFailedAt: Date | null;
}

export interface ActiveInviteCodeSnapshot {
	id: number;
	expiresAt: Date;
}

export interface PendingEnrollmentSnapshot {
	inviteCodeId: number;
	expiresAt: Date;
}
