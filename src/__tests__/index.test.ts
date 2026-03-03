import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index.js'

const validAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health')

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('ok')
      expect(response.body.service).toBe('credence-backend')
    })
  })

  describe('GET /api/trust/:address', () => {
    it('should return trust score for an address', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const response = await request(app).get(`/api/trust/${address}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        address,
        score: 0,
        bondedAmount: '0',
        bondStart: null,
        attestationCount: 0,
      })
    })

    it('should return 400 for an invalid address', async () => {
      const response = await request(app).get('/api/trust/not-an-address')
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/bond/:address', () => {
    it('should return bond status for a valid address', async () => {
      const response = await request(app).get(`/api/bond/${validAddress}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        address: validAddress,
        bondedAmount: '0',
        active: false,
      })
    })

    it('should handle different addresses', async () => {
      const address = '0x0000000000000000000000000000000000000001'
      const response = await request(app).get(`/api/bond/${address}`)

      expect(response.status).toBe(200)
    })

    it('should return 400 for an invalid address', async () => {
      const response = await request(app).get('/api/bond/not-an-address')
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown')

      expect(response.status).toBe(404)
    })
  })
})

describe('POST /api/bulk/verify', () => {
  it('should handle valid JSON in request body', async () => {
    const response = await request(app)
      .post('/api/bulk/verify')
      .set('X-API-Key', 'test-enterprise-key-12345')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          addresses: [
            'GABC7IXPV3YWQXKQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQZQXQ',
          ],
        }),
      )

    expect(response.status).toBe(200)
  })
})
