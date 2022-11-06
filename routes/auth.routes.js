const express = require('express')
const Route = express.Router()
const { check } = require('express-validator')
const passport = require('passport')

const {
  registerControllers,
  loginControllers,
  logoutControllers,
  getCallbackGoogle
} = require('../controllers/auth.controllers')
const { verifyToken } = require('../middlewares/verify')
const validate = require('../middlewares/validation')
const { passportCallbackGoogle } = require('../middlewares/passport')

Route.post(
  '/register',
  validate([
    check('name').escape().trim().notEmpty().withMessage('Name Can\'t be empty'),
    check('email')
      .escape()
      .trim()
      .notEmpty()
      .withMessage('E-mail Can\'t be empty')
      .bail()
      .isEmail()
      .withMessage('E-mail bad format'),
    check('password')
      .escape()
      .trim()
      .notEmpty()
      .withMessage('Password Can\'t be empty')
      .bail()
      .isLength({
        min: 8
      })
      .withMessage('Password too short, min 8 character')
  ]),
  registerControllers
)
  .post(
    '/login',
    validate([
      check('email')
        .escape()
        .trim()
        .notEmpty()
        .withMessage('E-mail Can\'t be empty')
        .bail()
        .isEmail()
        .withMessage('E-mail bad format'),
      check('password')
        .escape()
        .trim()
        .notEmpty()
        .withMessage('Password Can\'t be empty')
        .bail()
        .isLength({
          min: 8
        })
        .withMessage('Password too short, min 8 character')
    ]),
    loginControllers
  )
  .get('/logout', verifyToken, logoutControllers)
  .get(
    '/google',
    (req, _, next) => {
      req.session.socketId = req.query.socketId

      next()
    },
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  )
  .get('/google/callback', passportCallbackGoogle, getCallbackGoogle)

module.exports = Route
