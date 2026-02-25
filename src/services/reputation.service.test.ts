import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ioredis', () => {
    return {
        default: {
            default: vi.fn().mockImplementation(function () {
                return {
                    del: vi.fn().mockResolvedValue(1)
                };
            })
        }
    };
});

describe('ReputationService', () => {
    let ReputationService: any;
    let consoleLogSpy: any;

    beforeEach(async () => {
        vi.resetModules();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    it('invalidates cache using redis when configured', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        // Dynamically import so the module picks up the env var
        const mod = await import('./reputation.service.js');
        ReputationService = mod.ReputationService;

        const service = new ReputationService();
        await service.invalidateCache('0xUser');

        expect(consoleLogSpy).toHaveBeenCalledWith('[ReputationService] Invalidated trust score cache for 0xUser');
    });

    it('does soft invalidate when redis is not configured', async () => {
        delete process.env.REDIS_URL;
        // Dynamically import so the module picks up the env var
        const mod = await import('./reputation.service.js');
        ReputationService = mod.ReputationService;

        const service = new ReputationService();
        await service.invalidateCache('0xUser');

        expect(consoleLogSpy).toHaveBeenCalledWith('[ReputationService] REDIS_URL not configured. Soft cache invalidate simulating for 0xUser');
    });
});
