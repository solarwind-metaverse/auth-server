// eslint-disable-next-line @typescript-eslint/no-var-requires
require('https').globalAgent.options.rejectUnauthorized = false

import { getLog } from 'solarwind-common/dist/log.js'
const log = getLog('auth-server')

import express from 'express'
import expressSession from 'express-session'
import bodyParser from 'body-parser'
import passport from 'passport'

import { createPassport } from './passport'
import { createStore } from './db/postgres/postgresStore'
import { initializeSessionStore } from './db/sessionStore'

class LoginError extends Error {
  status: number
  id: string
  constructor(message: string, status: number, id: string) {
    super(message)
    this.status = status
    this.id = id
  }
}

const app = express()

app.use(express.static(__dirname))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const sessionStore = createStore()
initializeSessionStore(sessionStore).then((store) => {
  const appPassport = createPassport(store, passport)
  appPassport.initStrategies()
})

app.use(expressSession({
  store: sessionStore.expressSessionStore,
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}))

app.use(passport.initialize())
app.use(passport.session())

app.get('/auth/test', async (req, res, next) => {
  res.status(200).send({ test: 'test '})
})

app.post('/auth/login', (req, res, next) => {
  passport.authenticate('login-local',
    (err, user, info) => {
      if (err) {
        return res.status(401).send({ message: err.message })
      }
      req.logIn(user, (err) => {
        if (err) return next(err)
        res.status(200).send({ user })
      })

    })(req, res, next)
})

app.post('/auth/login/metamask', (req, res, next) => {
  passport.authenticate('login-metamask',
    (err, user, info) => {
      if (err) {
        return res.status(401).send({ message: err.message })
      }

      console.log('metamask login', err, user, info)
      req.logIn(user, (err) => {
        console.log('metamask login result', user, err)
        if (err) return next(err)
        res.status(200).send({ user })
      })

    })(req, res, next)
})

app.get('/auth/facebook',
  passport.authenticate(
    'login-facebook',
    { scope: [ 'email', 'public_profile' ], session: true }
  ))

app.get('/auth/facebook/callback',
  passport.authenticate('login-facebook', { failureRedirect: '/login', failureMessage: true }),
  (req, res) => {
    res.redirect('/stars')
  })

app.get('/auth/google',
  passport.authenticate(
    'login-google',
    { scope: [ 'email', 'profile' ], session: true }
  ))

app.get('/auth/google/callback',
  passport.authenticate('login-google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/stars')
  })

app.get('/auth/user', (req, res) => {
  log.debug('/auth/user', `session-id=${req.session.id}`)
  if (req.isAuthenticated()) {
    console.log('req.user', req.user)
    res.status(200).send({ user: req.user })
  } else {
    res.status(401).send({ message: 'Unauthorized' })
  }
})

app.get('/auth/user/nonce/:publicAddress', (req, res) => {
  const { publicAddress } = req.params
  log.debug('/auth/user/nonce')
  if (publicAddress) {
    log.debug('/auth/user/nonce', `publicAddress=${publicAddress}`)
    sessionStore.getUserByHandle('public_address', publicAddress)
      .then((user) => {
        if (user) {
          return sessionStore.createNonce(user.id)
        } else {
          throw new LoginError(`User with public address ${publicAddress} not found`, 400, 'USER_NOT_FOUND')
        }
      })
      .then((user) => {
        log.debug('/auth/user/nonce', `nonce created, updated user = ${user.id}`)
        log.debug('/auth/user/nonce', `nonce ${user.nonce}`)
        if (user) {
          res.status(200).send({ nonce: user.nonce })
        } else {
          throw new LoginError('Could not retrieve created nonce', 500, 'NONCE_NOT_FOUND')
        }
      })
      .catch((err: Error) => {
        console.log(err)
        log.error('/auth/user/nonce', err)
        if (err instanceof LoginError) {
          res.status(err.status).send({ message: err.message, id: err.id })
        } else {
          res.status(500).send({ message: err.message })
        }
      })
  } else {
    res.status(400).send({ message: 'Missing public address from the request' })
  }
})

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err) }
    res.redirect('/')
  })
})

const port = process.env.AUTH_HTTP_PORT || 3001
app.listen(port, () => console.log('AUTH-SERVER running, PORT ' + port))
