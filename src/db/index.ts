import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})

export async function initDb() {
    const client = await pool.connect()
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS attestations (
        id SERIAL PRIMARY KEY,
        user_address VARCHAR(42) NOT NULL,
        attester_address VARCHAR(42) NOT NULL,
        data TEXT,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_address, attester_address, data)
      );
    `)
        console.log('Attestations table initialized successfully.')
    } finally {
        client.release()
    }
}
