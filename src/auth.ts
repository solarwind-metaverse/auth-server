
import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('auth')

import { ethers } from 'ethers'
import Web3 from 'web3'
import bcrypt from 'bcrypt-nodejs'
import { DeserializedUser, SessionStore, SessionUser, SessionUserData } from './db/types'


export interface AuthProvider {
  login: (handle: string, userData: SessionUserData, password?: string) => Promise<DeserializedUser>
  loginWithSignature: (publicAddress: string, signature?: string, userData?: SessionUserData) => Promise<DeserializedUser>
}

export const deserializeFromSessionUser = (user: SessionUser): DeserializedUser => {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    address: user.address,
    firstName: user.firstName,
    lastName: user.lastName
  }
}

export const getAuthProvider = (session: SessionStore): AuthProvider => {

  return {

    login: async (handle: string, userData: SessionUserData, password?: string): Promise<DeserializedUser> => {

      log.debug('login', `${handle}=${userData[handle]}`)
      let user = await session.getUserByHandle(handle, userData[handle])

      if (!user) {

        log.info('login', 'create-user', `${handle}=${userData[handle]}`)
        const hashedPassword = !(password && password.length > 0) ? null :
          bcrypt.hashSync(password, bcrypt.genSaltSync(10))
        const wallet = ethers.Wallet.createRandom()
        const provider = new ethers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com/')
        const privateKey = wallet.privateKey
        const account = new ethers.Wallet(privateKey, provider)
        const balance = await provider.getBalance(account.address)
        console.log(`Balance: ${ethers.formatEther(balance)} MATIC`)
        user = await session.createUser({
          ...userData,
          address: account.address,
          privateKey
        }, hashedPassword)

        return user

      } else {

        log.info('login', 'user-found', `user.id=${user.id}`)

        if (password) {
          const hashedPassword = user.password
          if (!hashedPassword || !bcrypt.compareSync(password, hashedPassword)) {
            log.info('login', 'invalid-password', `user.id=${user.id}`)
            throw new Error('Invalid username or password')
          }
        }

        const deserializedUser = deserializeFromSessionUser(user)
        log.debug('login', 'login-success', `user.id=${user.id}`)
        return deserializedUser

      }

    },

    loginWithSignature: async (publicAddress: string, signature?: string, userData?: SessionUserData): Promise<DeserializedUser> => {

      log.debug('loginWithSignature', `${publicAddress}`)
      let user = await session.getUserByHandle('public_address', publicAddress)

      if (!user) {

        log.info('loginWithSignature', 'create-user', `${publicAddress}`)
        
        const wallet = ethers.Wallet.createRandom()
        const provider = new ethers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com/')
        const privateKey = wallet.privateKey
        const account = new ethers.Wallet(privateKey, provider)
        const balance = await provider.getBalance(account.address)
        console.log(`Balance: ${ethers.formatEther(balance)} MATIC`)

        user = await session.createUser({
          ...(userData || {}),
          publicAddress,
          nonce: Math.round(Math.random() * 10 ** 9),
          address: account.address,
          privateKey
        }, null)

        return user

      } else {

        log.info('loginWithSignature', 'user-found', `user.id=${user.id}`)

        if (!signature) {
          throw new Error('Missing signature')
        }

        const web3 = new Web3()
        const recoveredAddress = web3.eth.accounts.recover(`SOLARWIND SIGN-IN ${user.nonce}`, signature)
        //const recoveredAddress = ethers.recoverAddress(ethers.id(`SOLARWIND SIGN-IN ${user.nonce}`), signature)
        
        log.debug('loginWithSignature', `recoveredAddress=${recoveredAddress}`)

        if (recoveredAddress !== user.publicAddress) {
          log.info('loginWithSignature', 'invalid-signature', `user.id=${user.id} user.nonce=${user.nonce}, user.publicAddress=${user.publicAddress}}`)
          throw new Error('Invalid signature')
        }

        const deserializedUser = deserializeFromSessionUser(user)
        log.debug('loginWithSignature', 'login-success', `user.id=${user.id}`)
        return deserializedUser

      }

    }

  }

}
