import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SubscriptionService } from './subscriptions.js';
import { SubscriptionTier, ApiKeyRecord } from '../types/subscription.js';

describe('SubscriptionService', () => {
    let service: SubscriptionService;

    beforeEach(() => {
        service = new SubscriptionService();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers and retrieves a key', () => {
        service.registerKey('test-key', SubscriptionTier.FREE);
        const record = service.getKey('test-key');
        expect(record).toBeDefined();
        expect(record?.tier).toBe(SubscriptionTier.FREE);
        expect(record?.isAdminOverride).toBe(false);
    });

    it('handles missing keys', () => {
        expect(service.getKey('non-existent')).toBeUndefined();
    });

    describe('isEndpointAllowed', () => {
        it('allows specific endpoints for FREE tier', () => {
            const record: ApiKeyRecord = { key: 'k1', tier: SubscriptionTier.FREE, createdAt: new Date() };
            expect(service.isEndpointAllowed(record, '/api/trust/123')).toBe(true);
            expect(service.isEndpointAllowed(record, '/api/health')).toBe(true);
            expect(service.isEndpointAllowed(record, '/api/bond/123')).toBe(false);
        });

        it('allows wildcard endpoints for ENTERPRISE tier', () => {
            const record: ApiKeyRecord = { key: 'k2', tier: SubscriptionTier.ENTERPRISE, createdAt: new Date() };
            expect(service.isEndpointAllowed(record, '/api/bond/123')).toBe(true);
            expect(service.isEndpointAllowed(record, '/api/anything')).toBe(true);
        });
    });

    describe('checkAndIncrementQuota', () => {
        it('allows requests within limit for FREE tier', () => {
            const record: ApiKeyRecord = { key: 'k3', tier: SubscriptionTier.FREE, createdAt: new Date() };

            let res;
            for (let i = 0; i < 10; i++) {
                res = service.checkAndIncrementQuota(record);
                expect(res.allowed).toBe(true);
            }
            expect(res?.remaining).toBe(0);

            const rejected = service.checkAndIncrementQuota(record);
            expect(rejected.allowed).toBe(false);
            expect(rejected.remaining).toBe(0);
        });

        it('resets quota after window expires', () => {
            const record: ApiKeyRecord = { key: 'k4', tier: SubscriptionTier.FREE, createdAt: new Date() };

            // Exhaust quota
            for (let i = 0; i < 10; i++) {
                service.checkAndIncrementQuota(record);
            }
            expect(service.checkAndIncrementQuota(record).allowed).toBe(false);

            // Advance time by 61 seconds
            vi.advanceTimersByTime(61 * 1000);

            // Quota should be reset
            const res = service.checkAndIncrementQuota(record);
            expect(res.allowed).toBe(true);
            expect(res.remaining).toBe(9);
        });

        it('allows unlimited requests for admin override', () => {
            const record: ApiKeyRecord = { key: 'k5', tier: SubscriptionTier.PRO, createdAt: new Date(), isAdminOverride: true };

            for (let i = 0; i < 150; i++) {
                const res = service.checkAndIncrementQuota(record);
                expect(res.allowed).toBe(true);
            }
        });
    });

    it('resets all data', () => {
        service.registerKey('test-key', SubscriptionTier.FREE);
        service.checkAndIncrementQuota(service.getKey('test-key')!);

        service.reset();
        expect(service.getKey('test-key')).toBeUndefined();
    });
});
