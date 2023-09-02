import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('passport')

import Local from 'passport-local'
import Facebook from 'passport-facebook'
import Google from 'passport-google-oauth20'

import { getAuthProvider } from './auth'
import { PassportStatic } from 'passport'
import { DeserializedUser, SessionStore } from './db/types'

const {
  AUTH_FB_APPID, AUTH_FB_SECRET, GOOGLE_OAUTH_ID, GOOGLE_OAUTH_SECRET, APP_URL
} = process.env


export const createPassport = (session: SessionStore, passport: PassportStatic) => {

  const auth = getAuthProvider(session)

  return {

    initStrategies: () => {

      passport.serializeUser((user: DeserializedUser, done) => {
        log.debug('serialize-user', `user.id=${user.id}`)
        done(null, user.id)
      })

      passport.deserializeUser((id: string, done) => {
        log.debug('deserialize-user', `id=${id}`)
        session.getUserById(id).then(user => done(null, user))
      })

      passport.use('login-local', new Local.Strategy({
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email: string, password: string, done) => {
        log.info('login-local', `email=${email} password=${password}`)
        if (email) {
          try {
            const user = await auth.login('email', { email }, password)
            done(null, user)
          } catch (err) {
            log.info('login-local', 'login-error', err, err.message)
            done({ message: err.message })
          }
        } else {
          done({ message: 'Invalid login credentials' })
        }

      }))

      passport.use('login-metamask', new Local.Strategy({
        usernameField: 'publicAddress',
        passwordField: 'signature',
      },
      async (publicAddress: string, signature: string, done) => {
        log.info('login-metamask', `publicAddress=${publicAddress} password=${signature}`)
        if (publicAddress) {
          try {
            const user = await auth.loginWithSignature(publicAddress, signature)
            done(null, user)
          } catch (err) {
            log.info('login-metamask', 'login-error', err, err.message)
            done({ message: err.message })
          }
        } else {
          done({ message: 'Invalid login credentials, missing publicAddress param' })
        }

      }))

      passport.use('login-facebook', new Facebook.Strategy({
        clientID: AUTH_FB_APPID,
        clientSecret: AUTH_FB_SECRET,
        callbackURL: `${APP_URL}/auth/facebook/callback`,
        profileFields: ['id', 'emails'],
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        log.info('login-facebook', `fb-id=${profile.id}`)
        const emails = profile.emails
        let firstName = null
        let lastName = null
        if (profile.name) {
          firstName = profile.name.givenName
          lastName = profile.name.familyName
        }
        if (emails && emails.length > 0) {
          const email = emails[0].value
          try {
            log.debug('login-facebook', 'logging in user')
            const user = await auth.login('email', { email, firstName, lastName, username: `${firstName} ${lastName}` })
            log.debug('login-facebook', 'user logged in', user)
            done(null, user)
          } catch (err) {
            log.info('login-facebook', 'login-error', err)
            done({ message: err.message })
          }
        } else {
          done({ message: 'Invalid Facebook profile' })
        }

      }))

      passport.use('login-google', new Google.Strategy({
        clientID: GOOGLE_OAUTH_ID,
        clientSecret: GOOGLE_OAUTH_SECRET,
        callbackURL: `${APP_URL}/auth/google/callback`,
        scope: ['profile'],
        state: true,
        // profileFields: [ 'id', 'emails', 'name', 'username', 'gender', 'birthday' ]
      },
      async (accessToken, refreshToken, profile, done) => {
        log.info('login-google', `google-id=${profile.id}`)
        const emails = profile.emails
        if (emails && emails.length > 0) {
          const email = emails[0].value
          let firstName = null
          let lastName = null
          if (profile.name) {
            firstName = profile.name.givenName
            lastName = profile.name.familyName
          }
          try {
            const user = await auth.login('email', { email, firstName, lastName, username: `${firstName} ${lastName}` })
            done(null, user)
          } catch (err) {
            log.info('login-google', 'login-error', err)
            done(err)
          }
        } else {
          log.error('login-google', 'invalid-google-profile')
          done(new Error('Invalid Google profile'))
        }

      }))

    }

  }

}