const prisma = require('../config/prisma')
require('dotenv').config()
const { NODE_ENV } = process.env
const createErrors = require('http-errors')

module.exports = (socket) => {
  return {
    offline: () => {
      const main = async () => {
        try {
          const user = socket.userData
          const findProfile = await prisma.user.findUnique({
            where: {
              email: user.email
            },
            include: {
              profile: true
            }
          })

          if (!findProfile) {
            throw new createErrors.BadRequest('Failed to get user session')
          }

          await prisma.profile.update({
            where: {
              id: findProfile.profile.id
            },
            data: {
              status: 'OFFLINE',
              user: {
                update: {
                  session_id: null
                }
              }
            }
          })

          socket.emit('misc:info', {
            type: 'offline',
            message: 'You\'ve been offline'
          })
        } catch (error) {
          socket.emit('misc:info', {
            type: 'offline',
            message: error.message || 'Server error'
          })
        }
      }

      main().finally(async () => {
        if (NODE_ENV === 'development') {
          console.log(
            'Status Socket: Ends the Query Engine child process and closes all connections'
          )
        }

        await prisma.$disconnect()
      })
    },
    idle: () => {
      const main = async () => {
        try {
          const user = socket.userData
          const findProfile = await prisma.user.findUnique({
            where: {
              email: user.email
            },
            include: {
              profile: true
            }
          })

          if (!findProfile) {
            throw new createErrors.BadRequest('Failed to get user session')
          }

          await prisma.profile.update({
            where: {
              id: findProfile.profile.id
            },
            data: {
              status: 'IDLE',
              user: {
                update: {
                  session_id: socket.id
                }
              }
            }
          })

          socket.emit('misc:info', {
            type: 'idle',
            message: 'You\'ve been idle, re-connecting...'
          })
        } catch (error) {
          socket.emit('misc:info', {
            type: 'idle',
            message: error.message || 'Server error'
          })
        }
      }

      main().finally(async () => {
        if (NODE_ENV === 'development') {
          console.log(
            'Status Socket: Ends the Query Engine child process and closes all connections'
          )
        }

        await prisma.$disconnect()
      })
    },
    online: () => {
      const main = async () => {
        try {
          const user = socket.userData
          const findProfile = await prisma.user.findUnique({
            where: {
              email: user.email
            },
            include: {
              profile: true
            }
          })

          if (!findProfile) {
            throw new createErrors.BadRequest('Failed to get user session')
          }

          await prisma.profile.update({
            where: {
              id: findProfile.profile.id
            },
            data: {
              status: 'ONLINE',
              user: {
                update: {
                  session_id: socket.id
                }
              }
            }
          })

          socket.emit('misc:info', {
            type: 'online',
            message: 'You\'re now online'
          })
        } catch (error) {
          socket.emit('misc:info', {
            type: 'online',
            message: error.message || 'Server error'
          })
        }
      }

      main().finally(async () => {
        if (NODE_ENV === 'development') {
          console.log(
            'Status Socket: Ends the Query Engine child process and closes all connections'
          )
        }

        await prisma.$disconnect()
      })
    }
  }
}
