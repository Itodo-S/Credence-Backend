import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptions.js';
import { ApiKeyRecord, SubscriptionTier } from '../types/subscription.js';

/**
 * API key scopes for authorization
 */
export enum ApiScope {
  PUBLIC = 'public',
  ENTERPRISE = 'enterprise',
}

// Extend Express Request type to include the API Key Record
declare global {
  namespace Express {
    interface Request {
      apiKeyRecord?: ApiKeyRecord;
    }
  }
}

/**
 * Extended Express Request with API key metadata
 */
export interface AuthenticatedRequest extends Request {
  authKey?: {
    key: string;
    scope: ApiScope;
  };
}

/**
 * Middleware that requires a valid API key in the 'x-api-key' header.
 * Attaches the associated ApiKeyRecord to the Request object.
 * Can be used directly as a middleware, or as a factory by passing an ApiScope.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void;
export function requireApiKey(requiredScope: ApiScope): (req: Request, res: Response, next: NextFunction) => void;
export function requireApiKey(
  arg1: Request | ApiScope,
  res?: Response,
  next?: NextFunction
) {
  if (typeof arg1 === 'string' && Object.values(ApiScope).includes(arg1 as ApiScope)) {
    // Factory pattern
    const requiredScope = arg1 as ApiScope;
    return (req: Request, res: Response, nextCb: NextFunction): void => {
      handleRequest(req, res, nextCb, requiredScope);
    };
  } else {
    // Direct middleware pattern
    handleRequest(arg1 as Request, res as Response, next as NextFunction);
  }
}

function handleRequest(req: Request, res: Response, next: NextFunction, requiredScope?: ApiScope) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required'
    });
    return;
  }

  const record = subscriptionService.getKey(apiKey);

  if (!record) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or inactive API key'
    });
    return;
  }

  if (record.expiresAt && new Date() > record.expiresAt) {
    res.status(403).json({ error: 'API key has expired' });
    return;
  }

  const scope = (record.tier === SubscriptionTier.ENTERPRISE || record.isAdminOverride)
    ? ApiScope.ENTERPRISE
    : ApiScope.PUBLIC;

  // Check if the key has sufficient scope
  if (requiredScope === ApiScope.ENTERPRISE && scope !== ApiScope.ENTERPRISE) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Enterprise API key required',
    });
    return;
  }

  // Attach both formats to support legacy and new features
  req.apiKeyRecord = record;
  (req as AuthenticatedRequest).authKey = { key: apiKey, scope };

  next();
}
