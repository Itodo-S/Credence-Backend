import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../index.js";

describe("API Endpoints", () => {
  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: 'ok',
        service: 'credence-backend',
      }));
    });
  });

  describe('GET /api/trust/:address', () => {
    it('should return trust score for an address', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const response = await request(app).get(`/api/trust/${address}`).set('x-api-key', 'test-free-key');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        address,
        score: 0,
        bondedAmount: "0",
        bondStart: null,
        attestationCount: 0,
      }));
    });

    it("should handle different addresses", async () => {
      const address = "0x0000000000000000000000000000000000000001";
      const response = await request(app).get(`/api/trust/${address}`).set('x-api-key', 'test-free-key');

      expect(response.status).toBe(200);
      expect(response.body.address).toBe(address);
    });
  });

  describe("GET /api/bond/:address", () => {
    it("should return bond status for an address", async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const response = await request(app).get(`/api/bond/${address}`).set('x-api-key', 'test-enterprise-key');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        address,
        bondedAmount: "0",
        active: false
      }));
    });

    it("should handle different addresses", async () => {
      const address = "0x0000000000000000000000000000000000000001";
      const response = await request(app).get(`/api/bond/${address}`).set('x-api-key', 'test-enterprise-key');

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid address format", async () => {
      const address = "GABC7IXPV3YWQXKQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQ";
      const response = await request(app).get(`/api/bond/${address}`).set('x-api-key', 'test-enterprise-key');

      // Schema validation or regex in params should block this if it's strictly an 0x address.
      // E.g., validation says 400 on Zod failure.
      expect(response.status).toBe(400);
    });
  });

  describe("404 Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/api/unknown");

      expect(response.status).toBe(404);
    });
  });
});

describe("JSON Parsing", () => {
  it("should handle valid JSON in request body", async () => {
    const response = await request(app)
      .post("/api/bulk/verify")
      .set("X-API-Key", "test-enterprise-key")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          addresses: [
            "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          ],
        }),
      );

    // Bulk route might return 404 if not fully implemented in tests, 
    // but it previously expected 200 in the tests. 
    // Wait, if it's mock enterprise endpoint, it might return 200.
    expect(response.status).toBe(200);
  });
});
