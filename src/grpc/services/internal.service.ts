import * as grpc from '@grpc/grpc-js';

// Types derived from InternalService proto
export interface TrustScoreRequest {
  address: string;
}

export interface TrustScoreResponse {
  address: string;
  score: number;
  bonded_amount: string;
}

export interface SyncIdentityRequest {
  address: string;
  identity_provider: string;
  identity_id: string;
}

export interface SyncIdentityResponse {
  success: boolean;
  message: string;
}

export interface InternalServiceHandlers {
  GetTrustScore: grpc.handleUnaryCall<TrustScoreRequest, TrustScoreResponse>;
  SyncIdentity: grpc.handleUnaryCall<SyncIdentityRequest, SyncIdentityResponse>;
}

/**
 * Service handlers for the Internal gRPC API.
 */
export const internalServiceHandlers: InternalServiceHandlers = {
  /**
   * Get Trust Score and bounded amount for a given address.
   * This is a stub implementation.
   *
   * @param call The incoming gRPC request with address
   * @param callback The callback to send the response
   */
  GetTrustScore: (call, callback) => {
    const { address } = call.request;
    
    if (!address) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        details: 'Address is required',
      });
    }

    // Dummy logic for stub
    const response: TrustScoreResponse = {
      address,
      score: 85,
      bonded_amount: '1000000000000000000', // 1 ETH in wei
    };
    
    callback(null, response);
  },

  /**
   * Sync Identity for a given address.
   * This is a stub implementation.
   *
   * @param call The incoming gRPC request with identity details
   * @param callback The callback to send the response
   */
  SyncIdentity: (call, callback) => {
    const { address, identity_provider, identity_id } = call.request;
    
    if (!address || !identity_provider || !identity_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        details: 'Address, identity_provider, and identity_id are required',
      });
    }

    // Dummy logic for stub
    const response: SyncIdentityResponse = {
      success: true,
      message: `Successfully synced identity ${identity_id} from ${identity_provider} for ${address}`,
    };
    
    callback(null, response);
  }
};
