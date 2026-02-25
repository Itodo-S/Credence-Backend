import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptions.js';

/**
 * Middleware that enforces quota usage and endpoint access.
 * Must be used after `requireApiKey` middleware.
 */
export const enforceQuota = (req: Request, res: Response, next: NextFunction) => {
    const record = req.apiKeyRecord;

    if (!record) {
        res.status(500).json({ error: 'Missing API Key Record. Check middleware order.' });
        return; // Wait, actually should just return
    }

    // Check endpoint access based on tier
    if (!subscriptionService.isEndpointAllowed(record, req.path)) {
        res.status(403).json({ error: `Endpoint access denied for tier: ${record.tier}` });
        return;
    }

    // Check rate limit quota
    const quotaCheck = subscriptionService.checkAndIncrementQuota(record);

    if (!quotaCheck.allowed) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
    }

    // Set X-RateLimit-Remaining header
    res.setHeader('X-RateLimit-Remaining', quotaCheck.remaining);

    next();
};
