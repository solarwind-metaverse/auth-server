import { SessionStore } from './types'

export const initializeSessionStore = async (sessionStore: SessionStore): Promise<SessionStore> => {
  await sessionStore.connect()
  await sessionStore.initializeSessionStore()
  return sessionStore
}