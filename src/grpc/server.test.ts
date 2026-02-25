import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { createGrpcServer, authInterceptor, startGrpcServer, withAuth } from './server.js';
import fs from 'fs';

// Mock fs to test TLS config loading without real certificates
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal() as typeof fs;
    return {
        ...actual,
        readFileSync: vi.fn(),
    };
});

describe('gRPC Server Initialization', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterEach(() => {
        process.env = OLD_ENV;
        vi.restoreAllMocks();
    });

    it('createGrpcServer should return a grpc.Server instance', () => {
        const server = createGrpcServer();
        expect(server).toBeInstanceOf(grpc.Server);
    });

    describe('Authentication Interceptor and withAuth', () => {
        it('should call next if Authorization header matches the shared secret', () => {
            process.env.GRPC_INTERNAL_SECRET = 'test-secret';

            const metadata = new grpc.Metadata();
            metadata.add('authorization', 'Bearer test-secret');

            const call = { metadata } as unknown as grpc.ServerUnaryCall<any, any>;
            const callback = vi.fn();
            const next = vi.fn();

            authInterceptor(call, callback, next);

            expect(next).toHaveBeenCalledWith(call, callback);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should return UNAUTHENTICATED error if Authorization header is missing or incorrect', () => {
            process.env.GRPC_INTERNAL_SECRET = 'test-secret';

            const metadata = new grpc.Metadata();
            metadata.add('authorization', 'Bearer wrong-secret');

            const call = { metadata } as unknown as grpc.ServerUnaryCall<any, any>;
            const callback = vi.fn();
            const next = vi.fn();

            authInterceptor(call, callback, next);

            expect(callback).toHaveBeenCalledWith({
                code: grpc.status.UNAUTHENTICATED,
                details: 'Invalid or missing authentication token',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('withAuth should wrap a handler and call authInterceptor', () => {
            process.env.GRPC_INTERNAL_SECRET = 'test-secret';
            const metadata = new grpc.Metadata();
            metadata.add('authorization', 'Bearer test-secret');
            const call = { metadata } as unknown as grpc.ServerUnaryCall<any, any>;
            const callback = vi.fn();
            const handler = vi.fn();

            const wrappedHandler = withAuth(handler);
            wrappedHandler(call, callback);

            expect(handler).toHaveBeenCalledWith(call, callback);
        });
    });

    describe('startGrpcServer', () => {
        const originalBindAsync = grpc.Server.prototype.bindAsync;
        const originalStart = grpc.Server.prototype.start;

        beforeEach(() => {
            grpc.Server.prototype.bindAsync = vi.fn((port, creds, cb) => cb(null, 50051)) as any;
            grpc.Server.prototype.start = vi.fn();
            console.log = vi.fn();
            console.warn = vi.fn();
            console.error = vi.fn();
        });

        afterEach(() => {
            grpc.Server.prototype.bindAsync = originalBindAsync;
            grpc.Server.prototype.start = originalStart;
        });

        it('should start server with insecure credentials if TLS env vars not provided', async () => {
            delete process.env.GRPC_TLS_CERT;
            delete process.env.GRPC_TLS_KEY;

            const server = await startGrpcServer('50051');

            expect(server).toBeDefined();
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Insecure credentials'));
            expect(grpc.Server.prototype.start).toHaveBeenCalled();
        });

        it('should configure TLS if certificates are provided', async () => {
            process.env.GRPC_TLS_CERT = '/fake/cert.pem';
            process.env.GRPC_TLS_KEY = '/fake/key.pem';
            process.env.GRPC_TLS_CA = '/fake/ca.pem';

            vi.spyOn(fs, 'readFileSync').mockImplementation(((path: any) => Buffer.from(`fake content for ${path}`)) as any);

            const server = await startGrpcServer('50051');

            expect(server).toBeDefined();
            expect(fs.readFileSync).toHaveBeenCalledWith('/fake/cert.pem');
            expect(fs.readFileSync).toHaveBeenCalledWith('/fake/key.pem');
            expect(fs.readFileSync).toHaveBeenCalledWith('/fake/ca.pem');
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('configured with TLS'));
        });

        it('should configure TLS without CA if CA is not provided', async () => {
            process.env.GRPC_TLS_CERT = '/fake/cert.pem';
            process.env.GRPC_TLS_KEY = '/fake/key.pem';
            delete process.env.GRPC_TLS_CA;

            vi.spyOn(fs, 'readFileSync').mockImplementation(((path: any) => Buffer.from(`fake content for ${path}`)) as any);

            const server = await startGrpcServer('50051');

            expect(server).toBeDefined();
            expect(fs.readFileSync).toHaveBeenCalledWith('/fake/cert.pem');
            expect(fs.readFileSync).toHaveBeenCalledWith('/fake/key.pem');
        });

        it('should reject if TLS file reading fails', async () => {
            process.env.GRPC_TLS_CERT = '/fake/cert.pem';
            process.env.GRPC_TLS_KEY = '/fake/key.pem';

            vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(startGrpcServer('50051')).rejects.toThrow('File not found');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load TLS certificates'), expect.any(Error));
        });

        it('should reject if bindAsync fails', async () => {
            delete process.env.GRPC_TLS_CERT;
            delete process.env.GRPC_TLS_KEY;

            grpc.Server.prototype.bindAsync = vi.fn((port, creds, cb) => cb(new Error('Address in use'), 0)) as any;

            await expect(startGrpcServer('50051')).rejects.toThrow('Address in use');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to bind'), expect.any(Error));
        });
    });
});
