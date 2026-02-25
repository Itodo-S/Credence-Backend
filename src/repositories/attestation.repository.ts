import { pool } from '../db/index.js';

export interface AttestationRow {
    id: number;
    user_address: string;
    attester_address: string;
    data: string;
    revoked: boolean;
    created_at: Date;
    updated_at: Date;
}

export class AttestationRepository {
    /**
     * Upserts an attestation. If it already exists, ensures it is un-revoked.
     * @param userAddress The address the attestation is for
     * @param attesterAddress The address creating the attestation
     * @param data The attestation payload
     */
    async upsertAttestation(userAddress: string, attesterAddress: string, data: string): Promise<AttestationRow> {
        const query = `
      INSERT INTO attestations (user_address, attester_address, data, revoked)
      VALUES ($1, $2, $3, false)
      ON CONFLICT (user_address, attester_address, data)
      DO UPDATE SET
        revoked = false,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
        const values = [userAddress, attesterAddress, data];
        const { rows } = await pool.query<AttestationRow>(query, values);
        return rows[0];
    }

    /**
     * Marks an attestation as revoked.
     * @param userAddress The address the attestation is for
     * @param attesterAddress The address that created the attestation
     * @param data The attestation payload
     */
    async revokeAttestation(userAddress: string, attesterAddress: string, data: string): Promise<AttestationRow | null> {
        const query = `
      UPDATE attestations
      SET
        revoked = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_address = $1 AND attester_address = $2 AND data = $3
      RETURNING *;
    `;
        const values = [userAddress, attesterAddress, data];
        const { rows } = await pool.query<AttestationRow>(query, values);
        return rows.length > 0 ? rows[0] : null;
    }
}
