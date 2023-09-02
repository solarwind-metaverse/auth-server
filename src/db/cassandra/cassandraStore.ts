import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('cassandraStore')

import cassandra from 'cassandra-driver'
import { createDbConnection } from './cassandra'
import { DeserializedUser, SessionStore, SessionUser, SessionUserData } from '../types'
import CassandraStore from 'cassandra-store'

export type CassandraSessionStore = SessionStore & {
    db?: cassandra.Client
}

export const createStore = (): SessionStore => {

  const { DB_HOST } = process.env

  const sessionStore: CassandraSessionStore = {
    expressSessionStore: new CassandraStore({
      table: 'sessions',
      client: null,
      clientOptions: {
        contactPoints: [ DB_HOST ],
        keyspace: 'solarwind',
        queryOptions: {
          prepare: true
        }
      }
    }),
    connect: async (): Promise<void> => {
      sessionStore.db = await createDbConnection()
    },
    initializeSessionStore: async (): Promise<void> => {
      const { db } = sessionStore
      const createSessionsTableQuery = `
                CREATE TABLE IF NOT EXISTS sessions (
                    sid text,
                    session text,
                    expires timestamp,
                    PRIMARY KEY(sid)
                );`
        
      await db.execute('USE solarwind;')
      await db.execute(createSessionsTableQuery)
      log.info('Session storage initialized')
    },
    getUserByHandle: async (column: string, value: string): Promise<SessionUser | null> => {
      const { db } = sessionStore
      const query = `SELECT id, ${column}, password, public_address, nonce FROM users WHERE ${column} = ?`
      const result = await db.execute(query, [ value ], { prepare: true })
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
      const query = 'SELECT id, username, email, address, nonce FROM users WHERE id = ?'
      const result = await db.execute(query, [ id ], { prepare: true })
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
      const uuid = cassandra.types.Uuid.random()
      const query = `
              INSERT INTO solarwind.users (id, email, password, username, first_name, last_name, public_address, nonce, address, private_key) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      const {
        email, username, firstName, lastName, publicAddress, nonce, address, privateKey
      } = user
          
      await db.execute(query, [ uuid, email, hashedPassword, username, firstName, lastName, publicAddress, nonce, address, privateKey ], { prepare: true })
      return {
        id: uuid.toString(),
        ...user
      }
    },
    createNonce: async (userId: string): Promise<DeserializedUser> => {
      const { db } = sessionStore
      const nonce = Math.round(Math.random() * 10 ** 9)
      const query = `
              UPDATE solarwind.users SET nonce = ? WHERE id = ?;`
      console.log('Update nonce', query, nonce, userId)
      await db.execute(query, [ nonce, userId ], { prepare: true })
      const user = await sessionStore.getUserById(userId)
      return user
    }
  }
    
  return sessionStore

}