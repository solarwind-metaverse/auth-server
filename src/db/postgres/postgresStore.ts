import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('postgresStore')

import pg from 'pg'
import session from 'express-session'
import { getClientConfig } from 'solarwind-common/dist/session/postgres.js'
import { createDbConnection } from './postgres'
import { DeserializedUser, SessionStore, SessionUser, SessionUserData } from '../types'
import connectPgSession from 'connect-pg-simple'

export type PostgresSessionStore = SessionStore & {
    db?: pg.Client
}

export const createStore = (): SessionStore => {

  const PostgresqlStore = connectPgSession(session)

  const pgPool = new pg.Pool(getClientConfig())
  const sessionStore: PostgresSessionStore = {
    expressSessionStore: new PostgresqlStore({
      pool: pgPool,
      tableName: 'sessions'
    }),
    connect: async (): Promise<void> => {
      sessionStore.db = await createDbConnection()
    },
    initializeSessionStore: async (): Promise<void> => {
      const { db } = sessionStore
      const createSessionsTableQuery = `
        CREATE TABLE IF NOT EXISTS sessions (
            sid text,
            sess text,
            expire timestamp,
            PRIMARY KEY(sid)
        );`
      await db.query(createSessionsTableQuery)
      log.info('Session storage initialized')
    },
    getUserByHandle: async (column: string, value: string): Promise<SessionUser | null> => {
      const { db } = sessionStore
      const query = `SELECT id, ${column}, password, public_address, nonce FROM users WHERE ${column} = $1`
      const result = await db.query(query, [ value ])
      if (result.rows.length > 0) {
        const user = result.rows[0]
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          password: user.password,
          publicAddress: user.public_address,
          nonce: user.nonce
        }
      }
      return null
    },
    getUserById: async (id): Promise<DeserializedUser | null> => {
      const { db } = sessionStore
      const query = 'SELECT id, username, email, address, nonce FROM users WHERE id = $1'
      const result = await db.query(query, [ id ])
      if (result.rows.length > 0) {
        const user = result.rows[0]
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          address: user.address,
          nonce: user.nonce
        }
      }
      return null
    },
    createUser: async (user: SessionUserData, hashedPassword: string | null): Promise<DeserializedUser> => {
      const { db } = sessionStore
      const query = `
              INSERT INTO users (email, password, username, first_name, last_name, public_address, nonce, address, private_key) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`
      const {
        email, username, firstName, lastName, publicAddress, nonce, address, privateKey
      } = user
          
      const { rows } = await db.query(query, [ email, hashedPassword, username, firstName, lastName, publicAddress, nonce, address, privateKey ])
      return rows[0]
    },
    createNonce: async (userId: string): Promise<DeserializedUser> => {
      const { db } = sessionStore
      const nonce = Math.round(Math.random() * 10 ** 9)
      const query = `
              UPDATE users SET nonce = $1 WHERE id = $2;`
      console.log('Update nonce', query, nonce, userId)
      await db.query(query, [ nonce, userId ])
      const user = await sessionStore.getUserById(userId)
      return user
    }
  }
    
  return sessionStore

}