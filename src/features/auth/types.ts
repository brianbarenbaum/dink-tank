export interface AuthUserSummary {
	id: string;
	email: string | null;
}

export interface AuthSession {
	expiresAt: number;
	user: AuthUserSummary;
}

export interface LoginStartResult {
	status: "approved" | "invite_required";
}

export interface OtpRequestResult {
	status: "otp_sent";
	resendAfterSeconds: number;
}

export interface SessionCheckResult {
	authenticated: boolean;
	session?: {
		user: AuthUserSummary;
		expiresAt: number;
	};
}
