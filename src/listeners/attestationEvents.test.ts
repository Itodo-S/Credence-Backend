import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttestationListener } from './attestationEvents.js';
import { AttestationRepository } from '../repositories/attestation.repository.js';
import { ReputationService } from '../services/reputation.service.js';
import { ethers } from 'ethers';

vi.mock('ethers', () => {
    const onMock = vi.fn();
    const removeAllListenersMock = vi.fn();
    return {
        ethers: {
            JsonRpcProvider: vi.fn(),
            Contract: vi.fn().mockImplementation(function () {
                return {
                    on: onMock,
                    removeAllListeners: removeAllListenersMock
                };
            })
        }
    };
});

describe('AttestationListener', () => {
    let repository: AttestationRepository;
    let reputationService: ReputationService;
    let listener: AttestationListener;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock implementations
        repository = {
            upsertAttestation: vi.fn().mockResolvedValue({}),
            revokeAttestation: vi.fn().mockResolvedValue({})
        } as unknown as AttestationRepository;

        reputationService = {
            invalidateCache: vi.fn().mockResolvedValue(undefined)
        } as unknown as ReputationService;

        listener = new AttestationListener(repository, reputationService);
    });

    it('starts listening to contract events', () => {
        listener.start('http://localhost:8545', '0xContract');

        // Check provider initialization
        expect(ethers.JsonRpcProvider).toHaveBeenCalledWith('http://localhost:8545');

        // Check that contract event listeners are registered
        // Grab the mock contract instance created
        const ContractMock = vi.mocked(ethers.Contract);
        const mockContractInstance = ContractMock.mock.results[0].value;
        expect(mockContractInstance.on).toHaveBeenCalledWith('Attested', expect.any(Function));
        expect(mockContractInstance.on).toHaveBeenCalledWith('Revoked', expect.any(Function));
    });

    it('handles Attested event correctly', async () => {
        listener.start('http://localhost:8545', '0xContract');

        // Extract the handler
        const ContractMock = vi.mocked(ethers.Contract);
        const mockContractInstance = ContractMock.mock.results[0].value;
        const attestedHandler = mockContractInstance.on.mock.calls.find((call: any[]) => call[0] === 'Attested')[1];

        // Trigger handler
        await attestedHandler('0xUser', '0xAttester', 'TestData', {});

        expect(repository.upsertAttestation).toHaveBeenCalledWith('0xUser', '0xAttester', 'TestData');
        expect(reputationService.invalidateCache).toHaveBeenCalledWith('0xUser');
    });

    it('handles Revoked event correctly', async () => {
        listener.start('http://localhost:8545', '0xContract');

        // Extract the handler
        const ContractMock = vi.mocked(ethers.Contract);
        const mockContractInstance = ContractMock.mock.results[0].value;
        const revokedHandler = mockContractInstance.on.mock.calls.find((call: any[]) => call[0] === 'Revoked')[1];

        // Trigger handler
        await revokedHandler('0xUser', '0xAttester', 'TestData', {});

        expect(repository.revokeAttestation).toHaveBeenCalledWith('0xUser', '0xAttester', 'TestData');
        expect(reputationService.invalidateCache).toHaveBeenCalledWith('0xUser');
    });

    it('stops listening when requested', () => {
        listener.start('http://localhost:8545', '0xContract');
        listener.stop();

        const ContractMock = vi.mocked(ethers.Contract);
        const mockContractInstance = ContractMock.mock.results[0].value;
        expect(mockContractInstance.removeAllListeners).toHaveBeenCalled();
    });

    it('does not crash when stopping before starting', () => {
        // Just call stop, contract is null
        listener.stop();
        // Should not throw
    });

    describe('Error handling', () => {
        it('handles errors during Attested event', async () => {
            repository.upsertAttestation = vi.fn().mockRejectedValue(new Error('DB Error'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            listener.start('http://localhost:8545', '0xContract');
            const ContractMock = vi.mocked(ethers.Contract);
            const mockContractInstance = ContractMock.mock.results[0].value;
            const attestedHandler = mockContractInstance.on.mock.calls.find((call: any[]) => call[0] === 'Attested')[1];

            await attestedHandler('0xUser', '0xAttester', 'TestData', {});

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to process Attested event: DB Error'));
            consoleErrorSpy.mockRestore();
        });

        it('handles errors during Revoked event', async () => {
            repository.revokeAttestation = vi.fn().mockRejectedValue(new Error('DB Error'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            listener.start('http://localhost:8545', '0xContract');
            const ContractMock = vi.mocked(ethers.Contract);
            const mockContractInstance = ContractMock.mock.results[0].value;
            const revokedHandler = mockContractInstance.on.mock.calls.find((call: any[]) => call[0] === 'Revoked')[1];

            await revokedHandler('0xUser', '0xAttester', 'TestData', {});

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to process Revoked event: DB Error'));
            consoleErrorSpy.mockRestore();
        });
    });
});
