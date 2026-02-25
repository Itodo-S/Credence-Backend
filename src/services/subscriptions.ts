import { SubscriptionTier, TierConfig, ApiKeyRecord, QuotaUsage } from '../types/subscription.js';

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
    [SubscriptionTier.FREE]: {
        rateLimitTokens: 10,
        rateLimitWindowMs: 60 * 1000, // 1 minute
        allowedEndpoints: ['/api/trust', '/api/health']
    },
    [SubscriptionTier.PRO]: {
        rateLimitTokens: 100,
        rateLimitWindowMs: 60 * 1000,
        allowedEndpoints: ['/api/trust', '/api/health', '/api/bond']
    },
    [SubscriptionTier.ENTERPRISE]: {
        rateLimitTokens: 1000,
        rateLimitWindowMs: 60 * 1000,
        allowedEndpoints: ['*'] // wildcard allows all
    }
};

/**
 * Service for managing API subscription tiers, API keys, and rate limits.
 * Currently uses an in-memory store for persistence (Map).
 */
export class SubscriptionService {
    private apiKeys: Map<string, ApiKeyRecord> = new Map();
    private quotaUsages: Map<string, QuotaUsage> = new Map();

    constructor() {
        // Seed some test/default keys if needed
    }

    /**
     * Registers a new API key with a specific tier.
     * @param key The API key string
     * @param tier The subscription tier
     * @param isAdminOverride Whether this key ignores rate limits
     * @returns The created ApiKeyRecord
     */
    public registerKey(key: string, tier: SubscriptionTier, isAdminOverride = false): ApiKeyRecord {
        const record: ApiKeyRecord = {
            key,
            tier,
            createdAt: new Date(),
            isAdminOverride
        };
        this.apiKeys.set(key, record);
        return record;
    }

    /**
     * Retrieves an API key record by key.
     * @param key The API key string
     * @returns ApiKeyRecord or undefined if not found
     */
    public getKey(key: string): ApiKeyRecord | undefined {
        return this.apiKeys.get(key);
    }

    /**
     * Checks if an API key has access to a specific endpoint path.
     * @param keyRecord The API Key record
     * @param path The request path (e.g. /api/trust/0x123)
     * @returns true if allowed, false otherwise
     */
    public isEndpointAllowed(keyRecord: ApiKeyRecord, path: string): boolean {
        const config = TIER_CONFIGS[keyRecord.tier];
        if (config.allowedEndpoints.includes('*')) {
            return true;
        }

        // Check if the path starts with any allowed endpoint prefix
        return config.allowedEndpoints.some(allowed => path.startsWith(allowed));
    }

    /**
     * Checks and increments the quota for an API key. 
     * @param keyRecord The API key record
     * @returns { allowed: boolean, remaining: number }
     */
    public checkAndIncrementQuota(keyRecord: ApiKeyRecord): { allowed: boolean; remaining: number } {
        if (keyRecord.isAdminOverride) {
            return { allowed: true, remaining: Number.MAX_SAFE_INTEGER };
        }

        const config = TIER_CONFIGS[keyRecord.tier];
        const now = Date.now();
        let usage = this.quotaUsages.get(keyRecord.key);

        // If no usage, or window has expired, reset
        if (!usage || now - usage.windowStartMs >= config.rateLimitWindowMs) {
            usage = {
                tokensUsed: 0,
                windowStartMs: now
            };
        }

        if (usage.tokensUsed >= config.rateLimitTokens) {
            this.quotaUsages.set(keyRecord.key, usage);
            return { allowed: false, remaining: 0 };
        }

        usage.tokensUsed += 1;
        this.quotaUsages.set(keyRecord.key, usage);

        return {
            allowed: true,
            remaining: config.rateLimitTokens - usage.tokensUsed
        };
    }

    /**
     * Clears all data (useful for tests)
     */
    public reset() {
        this.apiKeys.clear();
        this.quotaUsages.clear();
    }
}

// Export a singleton instance
export const subscriptionService = new SubscriptionService();
