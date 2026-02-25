import { ethers } from 'ethers';
import { AttestationRepository } from '../repositories/attestation.repository.js';
import { ReputationService } from '../services/reputation.service.js';

// Minimal ABI for Attestation/Revocation events
const attestationAbi = [
    "event Attested(address indexed user, address indexed attester, string data)",
    "event Revoked(address indexed user, address indexed attester, string data)"
];

export class AttestationListener {
    private provider: ethers.Provider | null = null;
    private contract: ethers.Contract | null = null;
    private repository: AttestationRepository;
    private reputationService: ReputationService;

    constructor(
        repository: AttestationRepository,
        reputationService: ReputationService
    ) {
        this.repository = repository;
        this.reputationService = reputationService;
    }

    /**
     * Initializes the listener using the provided RPC URL and Contract Address
     */
    public start(rpcUrl: string, contractAddress: string) {
        console.log(`[AttestationListener] Starting on RPC: ${rpcUrl}, Contract: ${contractAddress}`);

        // We use JsonRpcProvider. Depending on the environment, a WebSocketProvider might be preferred for events
        // but JsonRpcProvider will poll.
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.contract = new ethers.Contract(contractAddress, attestationAbi, this.provider);

        this.contract.on("Attested", this.handleAttested.bind(this));
        this.contract.on("Revoked", this.handleRevoked.bind(this));

        console.log("[AttestationListener] Listening for events...");
    }

    /**
     * Stops listening to contract events.
     */
    public stop() {
        if (this.contract) {
            this.contract.removeAllListeners();
            console.log("[AttestationListener] Stopped listening.");
        }
    }

    private async handleAttested(user: string, attester: string, data: string, event: unknown) {
        console.log(`[AttestationListener] Received Attested: user=${user} attester=${attester}`);
        try {
            await this.repository.upsertAttestation(user, attester, data);
            await this.reputationService.invalidateCache(user);
        } catch (err: unknown) {
            const e = err as Error;
            console.error(`[AttestationListener] Failed to process Attested event: ${e.message}`);
        }
    }

    private async handleRevoked(user: string, attester: string, data: string, event: unknown) {
        console.log(`[AttestationListener] Received Revoked: user=${user} attester=${attester}`);
        try {
            await this.repository.revokeAttestation(user, attester, data);
            await this.reputationService.invalidateCache(user);
        } catch (err: unknown) {
            const e = err as Error;
            console.error(`[AttestationListener] Failed to process Revoked event: ${e.message}`);
        }
    }
}
