import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireApiKey } from './auth.js';
import { subscriptionService } from '../services/subscriptions.js';
import { SubscriptionTier } from '../types/subscription.js';
import { Request, Response, NextFunction } from 'express';

describe('Auth Middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        next = vi.fn();
        subscriptionService.reset();
    });

    it('rejects if api key is missing', () => {
        requireApiKey(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Missing x-api-key header' });
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects if api key is invalid', () => {
        req.headers!['x-api-key'] = 'invalid-key';
        requireApiKey(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or inactive API key' });
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects if api key is expired', () => {
        const pastDate = new Date();
        pastDate.setFullYear(pastDate.getFullYear() - 1);

        const record = subscriptionService.registerKey('expired-key', SubscriptionTier.FREE);
        record.expiresAt = pastDate;

        req.headers!['x-api-key'] = 'expired-key';
        requireApiKey(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'API key has expired' });
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches record and calls next if valid', () => {
        subscriptionService.registerKey('valid-key', SubscriptionTier.FREE);
        req.headers!['x-api-key'] = 'valid-key';

        requireApiKey(req as Request, res as Response, next);

        expect(req.apiKeyRecord).toBeDefined();
        expect(req.apiKeyRecord?.key).toBe('valid-key');
        expect(next).toHaveBeenCalled();
    });
});
