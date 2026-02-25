import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { internalServiceHandlers } from './services/internal.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, '../../proto/internal.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const internalProto = protoDescriptor.credence.internal;

/**
 * Authentication Interceptor to verify a shared secret.
 * Internal services must provide an Authorization metadata header.
 */
export const authInterceptor = (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>, next: grpc.handleUnaryCall<any, any>) => {
    const authSecret = process.env.GRPC_INTERNAL_SECRET || 'dev-secret';

    // We cannot easily use interceptors in @grpc/grpc-js server side in the same way as client side,
    // so this acts as a middleware validation for individual handlers if wrapped, or we check directly in handlers.
    // Actually, @grpc/grpc-js doesn't natively support server-side interceptors easily yet.
    // Instead, we can check metadata inside the actual method, or write a wrapper.

    const token = call.metadata.get('authorization')[0];

    if (token !== `Bearer ${authSecret}`) {
        return callback({
            code: grpc.status.UNAUTHENTICATED,
            details: 'Invalid or missing authentication token',
        });
    }

    next(call, callback);
};

// Wrapper for service handlers to include authentication
export function withAuth<T, R>(handler: grpc.handleUnaryCall<T, R>): grpc.handleUnaryCall<T, R> {
    return (call, callback) => {
        authInterceptor(call, callback as any, handler);
    };
}

/**
 * Creates and configures the gRPC server.
 * @returns Configured gRPC server
 */
export function createGrpcServer(): grpc.Server {
    const server = new grpc.Server();

    server.addService(internalProto.InternalService.service, {
        GetTrustScore: withAuth(internalServiceHandlers.GetTrustScore),
        SyncIdentity: withAuth(internalServiceHandlers.SyncIdentity),
    });

    return server;
}

/**
 * Starts the gRPC server.
 * Reads TLS configuration from environment variables if provided.
 * @param port Port to listen on (default: 50051)
 */
export function startGrpcServer(port: string | number = 50051): Promise<grpc.Server> {
    return new Promise((resolve, reject) => {
        const server = createGrpcServer();

        // Support TLS if certificates are provided, otherwise insecure
        let credentials = grpc.ServerCredentials.createInsecure();

        const tlsCertFilesExists = process.env.GRPC_TLS_CERT && process.env.GRPC_TLS_KEY;
        if (tlsCertFilesExists) {
            try {
                const cert = fs.readFileSync(process.env.GRPC_TLS_CERT as string);
                const key = fs.readFileSync(process.env.GRPC_TLS_KEY as string);

                let ca: Buffer | undefined;
                if (process.env.GRPC_TLS_CA) {
                    ca = fs.readFileSync(process.env.GRPC_TLS_CA as string);
                }

                credentials = grpc.ServerCredentials.createSsl(
                    ca ? ca : null,
                    [{ cert_chain: cert, private_key: key }],
                    true // checkClientCertificate
                );
                console.log('gRPC Server configured with TLS.');
            } catch (error) {
                console.error('Failed to load TLS certificates for gRPC server:', error);
                reject(error);
                return;
            }
        } else {
            console.warn('gRPC Server configured with Insecure credentials. Use TLS in production.');
        }

        server.bindAsync(
            `0.0.0.0:${port}`,
            credentials,
            (error, boundPort) => {
                if (error) {
                    console.error('Failed to bind gRPC server:', error);
                    reject(error);
                } else {
                    server.start();
                    console.log(`Internal gRPC Service listening on port ${boundPort}`);
                    resolve(server);
                }
            }
        );
    });
}
