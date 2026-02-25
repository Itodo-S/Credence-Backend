import express from 'express'
import { cache } from './cache/redis.js'
import { generateApiKey, revokeApiKey, rotateApiKey, listApiKeys } from './services/apiKeys.js'
import { requireApiKey, ApiScope } from './middleware/auth.js'
import {
  createSlashRequest,
  submitVote,
  getSlashRequest,
  listSlashRequests,
  type SlashRequestStatus,
  type VoteChoice,
} from './services/governance/slashingVotes.js'
import { loadConfig } from './config/index.js'
import { createHealthRouter } from './routes/health.js'
import { createDefaultProbes } from './services/health/probes.js'
import { initDb } from './db/index.js'
import { AttestationRepository } from './repositories/attestation.repository.js'
import { ReputationService } from './services/reputation.service.js'
import { AttestationListener } from './listeners/attestationEvents.js'
import bulkRouter from './routes/bulk.js'
import { validate } from './middleware/validate.js'
import {
  trustPathParamsSchema,
  bondPathParamsSchema,
  attestationsPathParamsSchema,
  attestationsQuerySchema,
  createAttestationBodySchema,
} from './schemas/index.js'

const config = loadConfig()
const app = express()

app.use(express.json())

// ── Health ────────────────────────────────────────────────────────────────────
const healthProbes = createDefaultProbes()
app.use('/api/health', createHealthRouter(healthProbes))

app.get('/api/health/cache', async (_req, res) => {
  const cacheHealth = await cache.healthCheck()
  res.json({
    status: 'ok',
    service: 'credence-backend',
    cache: cacheHealth,
  })
})

// ── API Key Management ────────────────────────────────────────────────────────

app.post('/api/keys', (req, res) => {
  const { ownerId, scope, tier } = req.body as {
    ownerId?: string
    scope?: string
    tier?: string
  }

  if (!ownerId) {
    res.status(400).json({ error: 'ownerId is required' })
    return
  }

  const validScopes = ['read', 'full']
  const validTiers = ['free', 'pro', 'enterprise']

  if (scope && !validScopes.includes(scope)) {
    res.status(400).json({ error: `scope must be one of: ${validScopes.join(', ')}` })
    return
  }
  if (tier && !validTiers.includes(tier)) {
    res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` })
    return
  }

  const result = generateApiKey(
    ownerId,
    (scope as 'read' | 'full') ?? 'read',
    (tier as 'free' | 'pro' | 'enterprise') ?? 'free',
  )

  res.status(201).json(result)
})

app.get('/api/keys', (req, res) => {
  const { ownerId } = req.query as { ownerId?: string }
  if (!ownerId) {
    res.status(400).json({ error: 'ownerId query parameter is required' })
    return
  }
  res.json(listApiKeys(ownerId))
})

app.delete('/api/keys/:id', (req, res) => {
  const revoked = revokeApiKey(req.params['id'])
  if (!revoked) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.status(204).send()
})

app.post('/api/keys/:id/rotate', (req, res) => {
  const result = rotateApiKey(req.params['id'])
  if (!result) {
    res.status(404).json({ error: 'Key not found or already revoked' })
    return
  }
  res.json(result)
})

// ── Governance: Slashing Votes ────────────────────────────────────────────────

app.post('/api/governance/slash-requests', (req, res) => {
  const { targetAddress, reason, requestedBy, threshold, totalSigners } = req.body as {
    targetAddress?: string
    reason?: string
    requestedBy?: string
    threshold?: number
    totalSigners?: number
  }

  if (!targetAddress) { res.status(400).json({ error: 'targetAddress is required' }); return }
  if (!reason) { res.status(400).json({ error: 'reason is required' }); return }
  if (!requestedBy) { res.status(400).json({ error: 'requestedBy is required' }); return }

  try {
    const request = createSlashRequest({ targetAddress, reason, requestedBy, threshold, totalSigners })
    res.status(201).json(request)
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

app.get('/api/governance/slash-requests', (req, res) => {
  const { status } = req.query as { status?: string }
  const validStatuses: SlashRequestStatus[] = ['pending', 'approved', 'rejected']
  if (status && !validStatuses.includes(status as SlashRequestStatus)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    return
  }
  res.json(listSlashRequests(status as SlashRequestStatus | undefined))
})

app.get('/api/governance/slash-requests/:id', (req, res) => {
  const request = getSlashRequest(req.params['id'])
  if (!request) { res.status(404).json({ error: 'Slash request not found' }); return }
  res.json(request)
})

app.post('/api/governance/slash-requests/:id/votes', (req, res) => {
  const { voterId, choice } = req.body as { voterId?: string; choice?: string }

  if (!voterId) { res.status(400).json({ error: 'voterId is required' }); return }
  if (!choice) { res.status(400).json({ error: 'choice is required' }); return }

  const validChoices: VoteChoice[] = ['approve', 'reject']
  if (!validChoices.includes(choice as VoteChoice)) {
    res.status(400).json({ error: `choice must be one of: ${validChoices.join(', ')}` })
    return
  }

  try {
    const result = submitVote(req.params['id'], voterId, choice as VoteChoice)
    if (!result) { res.status(404).json({ error: 'Slash request not found' }); return }
    res.status(201).json(result)
  } catch (err) {
    res.status(409).json({ error: (err as Error).message })
  }
})

// ── Trust & Bond Endpoints ────────────────────────────────────────────────────

/** Trust score by address (path validation) */
app.get(
  '/api/trust/:address',
  validate({ params: trustPathParamsSchema }),
  (req, res) => {
    const params = (req as any).validated?.params ?? req.params
    const address = params.address
    res.json({
      address,
      score: 0,
      bondedAmount: '0',
      bondStart: null,
      attestationCount: 0,
    })
  },
)

/** Bond status by address (path validation) */
app.get(
  '/api/bond/:address',
  validate({ params: bondPathParamsSchema }),
  (req, res) => {
    const params = (req as any).validated?.params ?? req.params
    const address = params.address
    res.json({
      address,
      bondedAmount: '0',
      bondStart: null,
      bondDuration: null,
      active: false,
    })
  },
)

/** List attestations for address (path + query validation) */
app.get(
  '/api/attestations/:address',
  validate({ params: attestationsPathParamsSchema, query: attestationsQuerySchema }),
  (req, res) => {
    const params = (req as any).validated?.params ?? req.params
    const query = (req as any).validated?.query ?? { limit: 20, offset: 0 }
    const address = params.address
    const { limit, offset } = query
    res.json({
      address,
      limit,
      offset,
      attestations: [],
    })
  },
)

/** Create attestation (body validation) */
app.post(
  '/api/attestations',
  validate({ body: createAttestationBodySchema }),
  (req, res) => {
    const body = (req as any).validated?.body ?? req.body
    res.status(201).json({
      subject: body.subject,
      value: body.value,
      key: body.key ?? null,
    })
  },
)

app.get('/api/verification/:address', (req, res) => {
  const { address } = req.params
  res.json({
    address,
    proof: null,
    verified: false,
    timestamp: null,
  })
})

// Bulk verification endpoint (Enterprise)
app.use('/api/bulk', requireApiKey(ApiScope.ENTERPRISE), bulkRouter)

// ── Server Startup ────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, async () => {
    console.log(`Credence API listening on http://localhost:${config.port}`)

    try {
      // Attempt to initialize DB if URL is provided
      if (process.env.DATABASE_URL) {
        await initDb()
        console.log('Database initialized successfully.')
      } else {
        console.warn('DATABASE_URL not set; skipping database initialization.')
      }

      // Start event listener if configured
      const rpcUrl = process.env.RPC_URL
      const contractAddress = process.env.CONTRACT_ADDRESS

      if (rpcUrl && contractAddress) {
        const repo = new AttestationRepository()
        const repService = new ReputationService()
        const listener = new AttestationListener(repo, repService)
        listener.start(rpcUrl, contractAddress)

        // Ensure graceful shutdown
        process.on('SIGINT', () => {
          listener.stop()
          process.exit()
        })
        process.on('SIGTERM', () => {
          listener.stop()
          process.exit()
        })
      } else {
        console.warn('RPC_URL or CONTRACT_ADDRESS not set; Attestation Listener will not start.')
      }
    } catch (err) {
      console.error('Failed to initialize background services:', err)
    }
  })
}

export default app
export { app }
