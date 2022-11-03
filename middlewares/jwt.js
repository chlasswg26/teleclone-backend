const createErrors = require('http-errors')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')
require('dotenv').config()
const {
  JWT_SECRET_KEY,
  JWT_ALGORITHM,
  NODE_ENV
} = process.env

module.exports = {
  verifyToken: (socket, next) => {
    const main = async () => {
      try {
        const req = socket.handshake
        const token = req.headers.authorization

        if (typeof token !== 'undefined') {
          const bearer = token.split(' ')
          const bearerToken = bearer[1]

          if (!bearerToken) next(new createErrors.Unauthorized('Empty access token'))

          jwt.verify(
            bearerToken,
            JWT_SECRET_KEY,
            { algorithms: JWT_ALGORITHM },
            async (err, result) => {
              if (err) {
                next(new createErrors.PreconditionFailed(err.message || err))
              } else {
                const user = await prisma.user.findUnique({
                  where: {
                    email: result.email
                  },
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        username: true
                      }
                    }
                  }
                })

                if (!user) next(new createErrors.Unauthorized('Access denied, account unregistered'))

                socket.userData = user

                next()
              }
            }
          )
        } else {
          next(new createErrors.Unauthorized('Bearer token must be conditioned'))
        }
      } catch (error) {
        next(new createErrors.PreconditionFailed(error.message || error))
      }
    }

    main()
      .finally(async () => {
        if (NODE_ENV === 'development') console.log('JWT Middleware Socket: Ends the Query Engine child process and closes all connections')

        await prisma.$disconnect()
      })
  }
}
