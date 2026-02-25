import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pool, initDb } from './index.js';

vi.mock('pg', () => {
    const { EventEmitter } = require('events');
    const mockQuery = vi.fn();
    const mockRelease = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue({
        query: mockQuery,
        release: mockRelease,
    });

    class MockPool extends EventEmitter {
        connect = mockConnect;
        query = mockQuery;
    }

    return {
        default: {
            Pool: vi.fn().mockImplementation(() => new MockPool())
        },
        Pool: vi.fn().mockImplementation(() => new MockPool())
    };
});

describe('Database Initialization', () => {
    let processExitSpy: any;
    let consoleErrorSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        processExitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('initializes the database successfully', async () => {
        // Trigger initDb success path
        await initDb();

        expect(consoleLogSpy).toHaveBeenCalledWith('Attestations table initialized successfully.');
        // Verify release is called
        const client = await pool.connect();
        expect(client.release).toHaveBeenCalled();
    });

    it('handles unexpected errors on idle clients', () => {
        const testError = new Error('Test connection error');

        // Emit the error directly on our simulated pool
        pool.emit('error', testError);

        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error on idle client', testError);
        expect(processExitSpy).toHaveBeenCalledWith(-1);
    });
});
