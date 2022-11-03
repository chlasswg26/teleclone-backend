const jwt = require('jsonwebtoken')
const response = require('../helpers/response')
const createErrors = require('http-errors')
const prisma = require('../config/prisma')
require('dotenv').config()
const { JWT_SECRET_KEY, JWT_ALGORITHM, NODE_ENV } =
  process.env

module.exports = {
  verifyToken: (req, res, next) => {
    const main = async () => {
      try {
        const token = req.headers.authorization
        const signedCookie = req.signedCookies

        if (!signedCookie?.token) { throw new createErrors.Unauthorized('Session unavailable') }

        if (typeof token !== 'undefined') {
          const bearer = token.split(' ')
          const bearerToken = bearer[1]

          if (!bearerToken) { throw new createErrors.Unauthorized('Empty access token') }

          jwt.verify(
            bearerToken,
            JWT_SECRET_KEY,
            { algorithms: JWT_ALGORITHM },
            async (err, result) => {
              if (err) {
                return response(res, err.status || 412, {
                  message: err.message || err
                })
              } else {
                const user = await prisma.user.findFirst({
                  where: {
                    email: result.email
                  },
                  select: {
                    id: true,
                    email: true
                  }
                })

                if (!user) {
                  throw new createErrors.Unauthorized(
                    'Access denied, account unregistered'
                  )
                }

                req.userData = user

                return next()
              }
            }
          )
        } else {
          throw new createErrors.Unauthorized(
            'Bearer token must be conditioned'
          )
        }
      } catch (error) {
        return response(res, error.status || 500, {
          message: error.message || error
        })
      }
    }

    main().finally(async () => {
      if (NODE_ENV === 'development') {
        console.log(
          'Verification JWT Middlewares: Ends the Query Engine child process and close all connections'
        )
      }

      await prisma.$disconnect()
    })
  }
}
