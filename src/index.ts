import express from 'express'
import { createHealthRouter } from './routes/health.js'
import { createDefaultProbes } from './services/health/probes.js'
import { initDb } from './db/index.js'
import { AttestationRepository } from './repositories/attestation.repository.js'
import { ReputationService } from './services/reputation.service.js'
import { AttestationListener } from './listeners/attestationEvents.js'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())

const healthProbes = createDefaultProbes()
app.use('/api/health', createHealthRouter(healthProbes))

app.get('/api/trust/:address', (req, res) => {
  const { address } = req.params
  // Placeholder: in production, fetch from DB / reputation engine
  res.json({
    address,
    score: 0,
    bondedAmount: '0',
    bondStart: null,
    attestationCount: 0,
  })
})

app.get('/api/bond/:address', (req, res) => {
  const { address } = req.params
  res.json({
    address,
    bondedAmount: '0',
    bondStart: null,
    bondDuration: null,
    active: false,
  })
})

app.listen(PORT, async () => {
  console.log(`Credence API listening on http://localhost:${PORT}`)

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
