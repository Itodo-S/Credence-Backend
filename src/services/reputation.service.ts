import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
// Only create redis connection if configured, else omit for testing/sandbox environments.
const redis = redisUrl ? new Redis.default(redisUrl) : null;

export class ReputationService {
    /**
     * Invalidates the trust score cache for a given address.
     * This forces the score to be recalculated on the next query.
     * @param address The user's address
     */
    async invalidateCache(address: string): Promise<void> {
        if (redis) {
            await redis.del(`trust_score:${address}`);
            console.log(`[ReputationService] Invalidated trust score cache for ${address}`);
        } else {
            console.log(`[ReputationService] REDIS_URL not configured. Soft cache invalidate simulating for ${address}`);
        }
    }
}
