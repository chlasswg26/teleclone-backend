const passport = require('passport')
require('dotenv').config()
const { NODE_ENV } = process.env
const response = require('../helpers/response')

module.exports = {
  passportCallbackGoogle: (req, res, next) => {
    passport.authenticate('google', (error, user, info) => {
      if (NODE_ENV === 'development') console.log('Additional Info:', info)

      if (error) {
        return response(res, error.status, {
          message: error.message || error
        })
      }

      if (!user) {
        return response(res, error.status, {
          message: error || 'User not found'
        })
      }

      req.logIn(user, (err) => {
        if (err) {
          return response(res, 400, {
            message: err
          })
        }

        next()
      })
    })(req, res, next)
  }
}
