const prisma = require('../config/prisma')
const exclude = require('../helpers/excluder')
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')
const { random } = require('../helpers/common')
const { generateFromEmail } = require('unique-username-generator')
require('dotenv').config()
const {
  JWT_SECRET_KEY,
  JWT_ALGORITHM,
  NODE_ENV
} = process.env
const createErrors = require('http-errors')
const response = require('../helpers/response')

module.exports = {
  registerControllers: (req, res) => {
    const main = async () => {
      try {
        const data = req.body
        const bodyLength = Object.keys(data).length

        if (!bodyLength) {
          throw new createErrors.BadRequest('Request body empty')
        }

        const findUser = await prisma.user.findUnique({
          where: {
            email: data.email
          }
        })

        if (findUser) {
          throw new createErrors.Conflict('Account has been registered')
        }

        const hashPassword = await argon2.hash(data.password, {
          type: argon2.argon2id
        })

        const createUser = await prisma.user.create({
          data: {
            email: data.email,
            password: hashPassword
          },
          select: {
            id: true
          }
        })

        if (!createUser) throw new createErrors.Conflict('Registration failed')

        const generatorNumberLenth = random(1)
        const randomNumber = random(2)
        const username = generateFromEmail(data.email, generatorNumberLenth)

        const profile = await prisma.profile.create({
          data: {
            userId: createUser.id,
            name: data.name,
            phone: data.phone,
            username: `${username}${randomNumber}`
          }
        })

        const message = {
          message: `Register new account: ${profile.name}, now you can login to apps`
        }

        return response(res, 201, message)
      } catch (error) {
        return response(res, error.status || 500, {
          message: error.message || error
        })
      }
    }

    main().finally(async () => {
      if (NODE_ENV === 'development') {
        console.log(
          'Authentication Controller: Ends the Query Engine child process and closes all connections'
        )
      }

      await prisma.$disconnect()
    })
  },
  loginControllers: (req, res) => {
    const main = async () => {
      try {
        const data = req.body
        const bodyLength = Object.keys(data).length

        if (!bodyLength) {
          throw new createErrors.BadRequest('Request body empty')
        }

        const findUser = await prisma.user.findUnique({
          where: {
            email: data.email
          }
        })

        if (!findUser) {
          throw new createErrors.BadRequest('Unregistered account')
        }

        const verifyPassword = await argon2.verify(
          findUser.password,
          data.password
        )

        if (!verifyPassword) {
          throw new createErrors.BadRequest('Password did not match')
        }

        const dataToSign = { email: findUser.email }
        const accessToken = jwt.sign(dataToSign, JWT_SECRET_KEY, {
          algorithm: JWT_ALGORITHM
        })

        const updateSession = await prisma.user.update({
          where: {
            email: findUser.email
          },
          data: {
            profile: {
              update: {
                status: 'ONLINE'
              }
            }
          }
        })

        if (!updateSession) {
          throw new createErrors.Conflict('Failed to save session')
        }

        const user = exclude(findUser, ['password'])
        const users = {
          ...user,
          accessToken
        }

        return response(res, 202, users)
      } catch (error) {
        return response(res, error.status || 500, {
          message: error.message || error
        })
      }
    }

    main().finally(async () => {
      if (NODE_ENV === 'development') {
        console.log(
          'Authentication Controller: Ends the Query Engine child process and closes all connections'
        )
      }

      await prisma.$disconnect()
    })
  },
  logoutControllers: (req, res) => {
    const main = async () => {
      try {
        const data = req.userData

        if (!data) throw new createErrors.NotExtended('Session not found')

        const removeSession = await prisma.user.update({
          where: {
            email: data.email
          },
          data: {
            profile: {
              update: {
                status: 'OFFLINE'
              }
            }
          }
        })

        if (!removeSession) {
          throw new createErrors.Conflict('Failed to remove session')
        }

        const message = { message: 'Successfully log out' }

        return response(res, 200, message)
      } catch (error) {
        return response(res, error.status || 500, {
          message: error.message || error
        })
      }
    }

    main().finally(async () => {
      if (NODE_ENV === 'development') {
        console.log(
          'Authentication Controller: Ends the Query Engine child process and closes all connections'
        )
      }

      await prisma.$disconnect()
    })
  },
  getCallbackGoogle: (req, res) => {
    const main = async () => {
      try {
        const user = req.user
        const generatorNumberLenth = random(1)
        const randomNumber = random(2)
        const username = generateFromEmail(
          user._json.email,
          generatorNumberLenth
        )

        const updateOrInsertUser = await prisma.user.upsert({
          where: {
            email: user._json.email
          },
          update: {
            profile: {
              update: {
                status: 'ONLINE'
              }
            }
          },
          create: {
            email: user._json.email,
            profile: {
              create: {
                name: user._json.name,
                avatar: user._json.picture,
                username: `${username}${randomNumber}`,
                status: 'ONLINE'
              }
            }
          }
        })

        if (!updateOrInsertUser) {
          throw new createErrors.Conflict('Failed to connect account')
        }

        const dataToSign = { email: updateOrInsertUser.email }
        const accessToken = jwt.sign(dataToSign, JWT_SECRET_KEY, {
          algorithm: JWT_ALGORITHM
        })
        const account = exclude(updateOrInsertUser, ['password'])
        const users = {
          ...account,
          accessToken
        }

        const io = req.app.get('newSocketIo')
        const socketId = req.app.get('socketId')

        io.in(socketId).emit('auth:google', users)

        res.send('<script>window.close();</script>')
      } catch (error) {
        return response(res, 500, {
          message: error.message || error
        })
      }
    }

    main().finally(async () => {
      if (NODE_ENV === 'development') {
        console.log(
          'Authentication Controller: Ends the Query Engine child process and closes all connections'
        )
      }

      await prisma.$disconnect()
    })
  }
}
