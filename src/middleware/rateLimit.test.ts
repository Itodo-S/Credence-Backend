import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforceQuota } from './rateLimit.js';
import { subscriptionService } from '../services/subscriptions.js';
import { SubscriptionTier } from '../types/subscription.js';
import { Request, Response, NextFunction } from 'express';

describe('Rate Limit Middleware', () => {
    let req: any;
    let res: any;
    let next: NextFunction;

    beforeEach(() => {
        req = { path: '/api/trust/123' };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            setHeader: vi.fn(),
        };
        next = vi.fn();
        subscriptionService.reset();
    });

    it('returns 500 if apiKeyRecord is missing', () => {
        enforceQuota(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 if endpoint access is denied', () => {
        req.apiKeyRecord = { key: 'test', tier: SubscriptionTier.FREE, createdAt: new Date() };
        req.path = '/api/bond/123'; // Not allowed for FREE

        enforceQuota(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Endpoint access denied') }));
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 429 if rate limit is exceeded', () => {
        const record = subscriptionService.registerKey('test-key', SubscriptionTier.FREE);
        req.apiKeyRecord = record;
        req.path = '/api/trust/123';

        // Exhaust quota
        for (let i = 0; i < 10; i++) {
            subscriptionService.checkAndIncrementQuota(record);
        }

        enforceQuota(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
        expect(next).not.toHaveBeenCalled();
    });

    it('sets header and calls next if quota is allowed', () => {
        const record = subscriptionService.registerKey('test-key', SubscriptionTier.FREE);
        req.apiKeyRecord = record;
        req.path = '/api/trust/123';

        enforceQuota(req as Request, res as Response, next);

        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
        expect(next).toHaveBeenCalled();
    });
});
