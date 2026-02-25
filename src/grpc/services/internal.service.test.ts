import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { internalServiceHandlers, TrustScoreRequest, SyncIdentityRequest } from './internal.service.js';

describe('InternalService Handlers', () => {
    describe('GetTrustScore', () => {
        it('should return a trust score and bonded amount for a valid address', () => {
            const call = {
                request: { address: '0x123' },
            } as grpc.ServerUnaryCall<TrustScoreRequest, any>;

            const callback = vi.fn();

            internalServiceHandlers.GetTrustScore(call, callback);

            expect(callback).toHaveBeenCalledWith(null, {
                address: '0x123',
                score: 85,
                bonded_amount: '1000000000000000000',
            });
        });

        it('should return INVALID_ARGUMENT error if address is missing', () => {
            const call = {
                request: { address: '' },
            } as grpc.ServerUnaryCall<TrustScoreRequest, any>;

            const callback = vi.fn();

            internalServiceHandlers.GetTrustScore(call, callback);

            expect(callback).toHaveBeenCalledWith({
                code: grpc.status.INVALID_ARGUMENT,
                details: 'Address is required',
            });
        });
    });

    describe('SyncIdentity', () => {
        it('should acknowledge identity sync for valid request', () => {
            const call = {
                request: {
                    address: '0x123',
                    identity_provider: 'github',
                    identity_id: 'alice'
                },
            } as grpc.ServerUnaryCall<SyncIdentityRequest, any>;

            const callback = vi.fn();

            internalServiceHandlers.SyncIdentity(call, callback);

            expect(callback).toHaveBeenCalledWith(null, {
                success: true,
                message: 'Successfully synced identity alice from github for 0x123',
            });
        });

        it('should return INVALID_ARGUMENT error if required fields are missing', () => {
            const call = {
                request: { address: '0x123', identity_provider: '' },
            } as grpc.ServerUnaryCall<SyncIdentityRequest, any>;

            const callback = vi.fn();

            internalServiceHandlers.SyncIdentity(call, callback);

            expect(callback).toHaveBeenCalledWith({
                code: grpc.status.INVALID_ARGUMENT,
                details: 'Address, identity_provider, and identity_id are required',
            });
        });
    });
});
