import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttestationRepository } from './attestation.repository.js';
import { pool } from '../db/index.js';

vi.mock('../db/index.js', () => ({
    pool: {
        query: vi.fn(),
    },
}));

describe('AttestationRepository', () => {
    let repository: AttestationRepository;

    beforeEach(() => {
        repository = new AttestationRepository();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('upserts an attestation', async () => {
        const mockRow = {
            id: 1,
            user_address: '0xUser',
            attester_address: '0xAttester',
            data: 'SomeData',
            revoked: false,
            created_at: new Date(),
            updated_at: new Date(),
        };

        vi.mocked(pool.query).mockResolvedValue({
            rows: [mockRow],
            command: 'INSERT',
            rowCount: 1,
            oid: 0,
            fields: [],
        } as any);

        const result = await repository.upsertAttestation('0xUser', '0xAttester', 'SomeData');

        expect(result).toEqual(mockRow);
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO attestations'),
            ['0xUser', '0xAttester', 'SomeData']
        );
    });

    it('revokes an attestation', async () => {
        const mockRow = {
            id: 1,
            user_address: '0xUser',
            attester_address: '0xAttester',
            data: 'SomeData',
            revoked: true,
            created_at: new Date(),
            updated_at: new Date(),
        };

        vi.mocked(pool.query).mockResolvedValue({
            rows: [mockRow],
            command: 'UPDATE',
            rowCount: 1,
            oid: 0,
            fields: [],
        } as any);

        const result = await repository.revokeAttestation('0xUser', '0xAttester', 'SomeData');

        expect(result).toEqual(mockRow);
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE attestations'),
            ['0xUser', '0xAttester', 'SomeData']
        );
    });

    it('returns null if revoking a non-existent attestation', async () => {
        vi.mocked(pool.query).mockResolvedValue({
            rows: [] as any[],
            command: 'UPDATE',
            rowCount: 0,
            oid: 0,
            fields: []
        } as any);

        const result = await repository.revokeAttestation('0xUser', '0xAttester', 'NonExistent');

        expect(result).toBeNull();
    });
});
