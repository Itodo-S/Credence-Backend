import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptions.js';
import { ApiKeyRecord } from '../types/subscription.js';

// Extend Express Request type to include the API Key Record
declare global {
    namespace Express {
        interface Request {
            apiKeyRecord?: ApiKeyRecord;
        }
    }
}

/**
 * Middleware that requires a valid API key in the 'x-api-key' header.
 * Attaches the associated ApiKeyRecord to the Request object.
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        res.status(401).json({ error: 'Missing x-api-key header' });
        return;
    }

    const record = subscriptionService.getKey(apiKey);

    if (!record) {
        res.status(403).json({ error: 'Invalid or inactive API key' });
        return;
    }

    if (record.expiresAt && new Date() > record.expiresAt) {
        res.status(403).json({ error: 'API key has expired' });
        return;
    }

    req.apiKeyRecord = record;
    next();
};
