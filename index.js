const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const helmet = require('helmet')
const xss = require('xss-clean')
const favicon = require('serve-favicon')
const passport = require('passport')
const session = require('express-session')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const app = express()
require('dotenv').config()
const {
  NODE_ENV,
  FRONTEND_URL,
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  COOKIE_SECRET_KEY
} = process.env
const path = require('node:path')
const { createServer } = require('http')
const httpServer = createServer(app)
const { Server } = require('socket.io')
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true
  }
})

const routesNavigator = require('./routes/all.routes')
const prisma = require('./config/prisma')
const exclude = require('./helpers/excluder')

app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
app.use(helmet())
app.use(xss())
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use('/static', express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({
  extended: true
}))
app.use(express.json())
app.use(cors({
  origin: FRONTEND_URL,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'PUT', 'POST', 'DELETE'],
  credentials: true
}))
app.use(morgan('dev'))

app.use(
  session({
    secret: COOKIE_SECRET_KEY,
    resave: true,
    saveUninitialized: true
  })
)

app.use(passport.initialize())
app.use(passport.session())

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/v1/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(function () {
        if (NODE_ENV === 'development') {
          console.log('Google OAUTH 2.0')
          console.log(
            'Google Access Token:',
            accessToken,
            'Refresh Token:',
            refreshToken,
            'Profile',
            profile
          )
        }

        done(null, profile)
      })
    }
  )
)

passport.serializeUser((user, done) => {
  if (NODE_ENV === 'development') console.log('serialize:', user)

  done(null, user)
})
passport.deserializeUser(async (data, done) => {
  const main = async () => {
    try {
      let user = await prisma.user.findFirst({
        where: {
          email: data._json.email
        },
        include: {
          profile: true,
          contacts: {
            include: {
              person: {
                include: {
                  profile: true
                }
              }
            }
          },
          recipients: {
            include: {
              recipient: {
                include: {
                  profile: true
                }
              }
            }
          }
        }
      })

      user = exclude(user, ['password'])

      if (NODE_ENV === 'development') { console.log('success deserialize:', data._json.email, 'deserialize data:', user) }

      done(null, user)
    } catch (error) {
      if (NODE_ENV === 'development') console.log('error deserialize:', error)

      done(error, null)
    }
  }

  main().finally(async () => {
    if (NODE_ENV === 'development') {
      console.log(
        'Ends the Query Engine child process and closes all connections'
      )
    }
    await prisma.$disconnect()
  })
})

app.use('/api/v1', routesNavigator)

app.use('*', (req, res) => {
  res.status(404).json({
    method: req.method,
    message: 'cant find spesific endpoint, please make sure you read a documentation',
    status: false,
    code: 401
  })
})

app.set('newSocketIo', io)

const { verifyToken } = require('./middlewares/jwt')

const profileHandlers = require('./sockets/profile.socket')
const contactHandlers = require('./sockets/contact.socket')
const chatHandlers = require('./sockets/chat.socket')
const onlineOfflineHandlers = require('./sockets/status.socket')

io.use(verifyToken)
io.on('connection', (socket) => {
  profileHandlers(socket)
  contactHandlers(socket)
  chatHandlers(socket)
  onlineOfflineHandlers(socket)

  socket.on('join:room', (room) => {
    socket.join(room)
  })
})

httpServer.listen(PORT, () => {
  if (NODE_ENV === 'development') console.log(`Listen port at ${PORT}`)
})
