import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('cassandra')

import cassandra from 'cassandra-driver'

export const createDbConnection = async (): Promise<cassandra.Client> => {
    
  return new Promise((resolve, reject) => {

    const { AUTH_DB_HOST } = process.env

    const client = new cassandra.Client({
      contactPoints: [ AUTH_DB_HOST ],
      localDataCenter: 'datacenter1'
    })
          
    client.connect((err) => {
      if (err) {
        log.error(err)
        reject(err)
      } else {
        log.info('Connected to Cassandra')
        resolve(client)
      }
    })
    
  })

}