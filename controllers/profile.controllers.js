const prisma = require('../config/prisma')
require('dotenv').config()
const { NODE_ENV } = process.env
const createErrors = require('http-errors')
const argon2 = require('argon2')

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
              },
              recipients: {
                orderBy: {
                  id: 'desc'
                },
                include: {
                  recipient: {
                    include: {
                      profile: true
                    }
                  },
                  sender: {
                    include: {
                      profile: true
                    }
                  }
                }
              },
              senders: {
                orderBy: {
                  id: 'desc'
                },
                include: {
                  recipient: {
                    include: {
                      profile: true
                    }
                  },
                  sender: {
                    include: {
                      profile: true
                    }
                  }
                }
              },
              groups: {
                include: {
                  members: {
                    include: {
                      user: {
                        include: {
                          profile: true
                        }
                      }
                    }
                  },
                  conversations: {
                    include: {
                      participant: {
                        include: {
                          profile: true
                        }
                      }
                    }
                  }
                }
              }
            }
          })

          if (!findProfile) throw new createErrors.BadRequest('Failed to get profile')

          socket.emit('profile:read', {
            type: 'done',
            data: findProfile
          })
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

          if (data?.password) {
            const hashPassword = await argon2.hash(data.password, {
              type: argon2.argon2id
            })

            data.user = {
              update: {
                password: hashPassword
              }
            }

            delete data.password
          }

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
