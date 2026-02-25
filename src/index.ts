import express from 'express'
import { createHealthRouter } from './routes/health.js'
import { createDefaultProbes } from './services/health/probes.js'
import { requireApiKey } from './middleware/auth.js'
import { enforceQuota } from './middleware/rateLimit.js'
import { subscriptionService } from './services/subscriptions.js'
import { SubscriptionTier } from './types/subscription.js'

// Seed test keys for development
subscriptionService.registerKey('test-free-key', SubscriptionTier.FREE);
subscriptionService.registerKey('test-pro-key', SubscriptionTier.PRO);
subscriptionService.registerKey('test-enterprise-key', SubscriptionTier.ENTERPRISE, true);

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())

const healthProbes = createDefaultProbes()
app.use('/api/health', createHealthRouter(healthProbes))

app.get('/api/trust/:address', requireApiKey, enforceQuota, (req, res) => {
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

app.get('/api/bond/:address', requireApiKey, enforceQuota, (req, res) => {
  const { address } = req.params
  res.json({
    address,
    bondedAmount: '0',
    bondStart: null,
    bondDuration: null,
    active: false,
  })
})

app.listen(PORT, () => {
  console.log(`Credence API listening on http://localhost:${PORT}`)
})
