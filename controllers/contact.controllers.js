const prisma = require('../config/prisma')
const exclude = require('../helpers/excluder')
require('dotenv').config()
const { NODE_ENV } = process.env
const createErrors = require('http-errors')

module.exports = (socket) => {
  return {
    findContact: (contactUsername) => {
      const main = async () => {
        try {
          if (!contactUsername) throw new createErrors.BadRequest('Contact Username required')

          const user = socket.userData

          if (user.profile.username === contactUsername) throw new createErrors.Conflict('Cannot find your username, please use another username')

          const findContact = await prisma.profile.findFirst({
            where: {
              username: contactUsername
            },
            include: {
              user: true
            }
          })

          if (!findContact) throw new createErrors.BadRequest('Failed to get contact')

          const contact = exclude(findContact, [
            'password',
            'personId',
            'userId'
          ])

          socket.emit('contact:find', { type: 'done', data: contact })
        } catch (error) {
          socket.emit('contact:find', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Contact Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    readContact: (contactUsername) => {
      const main = async () => {
        try {
          if (!contactUsername) throw new createErrors.BadRequest('Contact Username required')

          const user = socket.userData
          const findContact = await prisma.contact.findFirst({
            where: {
              OR: [
                {
                  AND: [
                    {
                      person: {
                        profile: {
                          username: contactUsername
                        }
                      }
                    },
                    {
                      userId: user?.id
                    }
                  ]
                },
                {
                  AND: [
                    {
                      user: {
                        profile: {
                          username: contactUsername
                        }
                      }
                    },
                    {
                      personId: user?.id
                    }
                  ]
                }
              ]
            },
            include: {
              person: {
                include: {
                  profile: true
                }
              },
              user: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (!findContact) throw new createErrors.BadRequest('Failed to get contact')

          console.log('contactnya', findContact)

          socket.emit('contact:read', { type: 'done', data: findContact })
        } catch (error) {
          socket.emit('contact:read', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Contact Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    addContact: (contactId) => {
      const main = async () => {
        try {
          if (!contactId) throw new createErrors.BadRequest('Contact ID required')

          const user = socket.userData
          const findContact = await prisma.contact.findFirst({
            where: {
              AND: [
                {
                  personId: parseInt(contactId)
                },
                {
                  userId: user.id
                }
              ]
            },
            include: {
              person: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (findContact) throw new createErrors.BadRequest('Contact already exist')

          if (user.id === parseInt(contactId)) throw new createErrors.NotFound('Contact not found')

          const createContact = await prisma.contact.create({
            data: {
              personId: parseInt(contactId),
              userId: user.id
            },
            include: {
              person: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (!createContact) throw new createErrors.Conflict('Failed to add new contact')

          socket.emit('contact:add', { type: 'info', message: 'Success to add new contact' })
          socket
            .to([user.session_id, createContact.person.session_id])
            .emit('profile:read')
        } catch (error) {
          socket.emit('contact:add', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Contact Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    deleteContact: (contactId) => {
      const main = async () => {
        try {
          if (!contactId) throw new createErrors.BadRequest('Contact Data / ID required')

          const user = socket.userData
          const findContact = await prisma.contact.findUnique({
            where: {
              id: parseInt(contactId)
            },
            include: {
              person: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (!findContact) throw new createErrors.BadRequest('Failed to find contact')

          if (findContact.userId !== user.id) throw new createErrors.BadRequest('Access denied, you have no access to this contact')

          if (findContact.person.id === user.id) throw new createErrors.Conflict('Cannot delete contact by yourself')

          const deleteContact = await prisma.contact.delete({
            where: {
              id: parseInt(contactId)
            },
            include: {
              person: {
                include: {
                  profile: true
                }
              },
              user: {
                include: {
                  profile: true
                }
              }
            }
          })

          await prisma.chat.deleteMany({
            where: {
              OR: [
                {
                  AND: [
                    {
                      recipient: {
                        profile: {
                          username: deleteContact.person.profile.username
                        }
                      }
                    },
                    {
                      senderId: user?.id
                    }
                  ]
                },
                {
                  AND: [
                    {
                      sender: {
                        profile: {
                          username: deleteContact.person.profile.username
                        }
                      }
                    },
                    {
                      recipientId: user?.id
                    }
                  ]
                }
              ]
            }
          })

          if (!deleteContact) throw new createErrors.Conflict('Failed to remove contact')

          socket.broadcast
            .to(
              deleteContact?.personId === user?.id ? deleteContact?.user?.session_id : deleteContact?.person?.session_id
            )
            .emit('contact:delete', { type: 'info' })

          socket.emit('contact:delete', { type: 'info', message: 'Success to remove contact' })
        } catch (error) {
          socket.emit('contact:delete', { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Contact Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    }
  }
}
