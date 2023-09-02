
import expressSession from 'express-session'

export type SessionStore = {
    connect: () => Promise<void>
    initializeSessionStore: () => Promise<void>
    expressSessionStore: expressSession.Store
    getUserByHandle: (column: string, value: string | number) => Promise<SessionUser | null>
    getUserById: (id: string) => Promise<DeserializedUser | null>
    createUser: (user: SessionUserData, hashedPassword: string | null) => Promise<DeserializedUser>
    createNonce: (userId: string) => Promise<DeserializedUser>
}

export type SessionUserData = {
    [key: string]: string | number | undefined
}

export type SessionUser = SessionUserData & {
    id: string,
    password?: string
}

export type DeserializedUser = SessionUserData &{
    id: string
}