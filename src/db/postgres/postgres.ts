import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('postgres')

import pg from 'pg'
import { getClientConfig } from 'solarwind-common/dist/session/postgres.js'

export const createDbConnection = async (): Promise<pg.Client> => {

  return new Promise((resolve, reject) => {
    const client = new pg.Client(getClientConfig())
    client.connect().then(() => {
      console.log('Connected to PostgreSQL')
      resolve(client)
    }).catch((err: any) => {
      reject(err)
    })

  })
  

}