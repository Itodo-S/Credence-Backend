export enum SubscriptionTier {
    FREE = 'FREE',
    PRO = 'PRO',
    ENTERPRISE = 'ENTERPRISE',
}

export interface TierConfig {
    rateLimitTokens: number; // Tokens (e.g. requests) per window
    rateLimitWindowMs: number; // Window size in milliseconds
    allowedEndpoints: string[]; // List of endpoint paths or prefixes allowed
}

export interface ApiKeyRecord {
    key: string;
    tier: SubscriptionTier;
    createdAt: Date;
    expiresAt?: Date; // Optional expiration
    isAdminOverride?: boolean; // If true, ignore standard tier limits (enterprise mostly)
}

export interface QuotaUsage {
    tokensUsed: number;
    windowStartMs: number;
}
