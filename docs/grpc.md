# Internal gRPC API Documentation

This document outlines the internal service-to-service gRPC API provided by the Credence Backend.

## Overview

The gRPC server runs alongside the main HTTP Express server and provides endpoints intended for internal use only (e.g., between the reputation engine, indexers, and other backend services).

**Base Protocol Definition**: `proto/internal.proto`
**Default Port**: `50051` 

## Authentication

All incoming gRPC requests to internal services must include an authorization token via metadata.

- **Header Key**: `authorization`
- **Value**: `Bearer <secret>`

The shared secret is configured via the `GRPC_INTERNAL_SECRET` environment variable. If it's not provided, it defaults to `dev-secret`.

## TLS Configuration

The gRPC server supports TLS for secure communication. It is highly recommended to enable TLS in production environments.

To enable TLS, provide the following environment variables:
- `GRPC_TLS_CERT`: Absolute path to the TLS Certificate file (`.crt` or `.pem`).
- `GRPC_TLS_KEY`: Absolute path to the TLS Private Key file (`.key` or `.pem`).
- `GRPC_TLS_CA` (Optional): Absolute path to the Certificate Authority file if needed.

If `GRPC_TLS_CERT` and `GRPC_TLS_KEY` are not set, the server will fall back to using insecure credentials (useful for local development).

## Services

### `InternalService`

#### `GetTrustScore`
Retrieves the trust score and bonded amount for a specific address.

**Request (`TrustScoreRequest`)**
- `address` (string): The wallet address to lookup.

**Response (`TrustScoreResponse`)**
- `address` (string): The requested wallet address.
- `score` (int32): The calculated trust score.
- `bonded_amount` (string): The total amount bonded in wei.

#### `SyncIdentity`
Acknowledges an identity synchronization request from an identity provider.

**Request (`SyncIdentityRequest`)**
- `address` (string): The wallet address.
- `identity_provider` (string): The provider name (e.g., 'twitter', 'github').
- `identity_id` (string): The unique identifier on the provider.

**Response (`SyncIdentityResponse`)**
- `success` (bool): Whether the sync was accepted/processed.
- `message` (string): Details about the sync result.
