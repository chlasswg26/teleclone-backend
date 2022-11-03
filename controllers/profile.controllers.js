const prisma = require('../config/prisma')
const exclude = require('../helpers/excluder')
require('dotenv').config()
const { NODE_ENV } = process.env
const createErrors = require('http-errors')

module.exports = (socket) => {
  return {
    readProfile: () => {
      const main = async () => {
        try {
          const user = socket.userData
          const findProfile = await prisma.user.findUnique({
            where: {
              email: user.email
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
              }
            }
          })

          if (!findProfile) throw new createErrors.BadRequest('Failed to get profile')

          const profile = exclude(findProfile, [
            'password',
            'personId',
            'userId',
            'adminId'
          ])

          socket.emit('profile:read', { type: 'done', data: profile })
        } catch (error) {
          socket.emit('profile:read', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Profile Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    updateProfile: (data) => {
      const main = async () => {
        try {
          if (!data) throw new createErrors.BadRequest('Profile data required')

          const user = socket.userData
          const updateUser = await prisma.profile.update({
            where: {
              userId: user.id
            },
            data
          })

          if (!updateUser) throw new createErrors.Conflict('Failed to update profile')

          socket.emit('profile:update', { type: 'info', message: 'Success to update profile' })
        } catch (error) {
          socket.emit('profile:update', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Profile Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    }
  }
}
