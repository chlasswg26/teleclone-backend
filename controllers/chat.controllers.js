const prisma = require('../config/prisma')
const exclude = require('../helpers/excluder')
require('dotenv').config()
const { NODE_ENV } = process.env
const createErrors = require('http-errors')

module.exports = (socket) => {
  return {
    readChat: (contactId) => {
      const user = socket.userData

      const main = async () => {
        try {
          if (!contactId) throw new createErrors.BadRequest('Contact ID required')

          const findChat = await prisma.chat.findMany({
            where: {
              recipientId: parseInt(contactId)
            },
            include: {
              sender: {
                include: {
                  profile: true
                }
              },
              recipient: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (!findChat) throw new createErrors.BadRequest('Failed to get chat')

          if (findChat.senderId !== user.id) throw new createErrors.BadRequest('Access denied, you have no access to this chat')

          const chat = exclude(findChat, [
            'password',
            'senderId',
            'recipientId'
          ])

          socket.emit(`chat:read:${user?.id}`, { type: 'done', data: chat })
        } catch (error) {
          socket.emit(`chat:read:${user?.id}`, { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Chat Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    sendChat: (data) => {
      const main = async () => {
        try {
          if (!data) throw new createErrors.BadRequest('Chat Data required')

          const user = socket.userData
          const findUser = await prisma.user.findFirst({
            where: {
              profile: {
                id: parseInt(data?.id)
              }
            },
            include: {
              profile: true
            }
          })

          if (!findUser) throw new createErrors.NotFound('Recipient not found')

          if (user.id === data?.id) throw new createErrors.NotFound('Self message declined')

          const createChat = await prisma.chat.create({
            data: {
              recipientId: parseInt(data?.id),
              senderId: user.id,
              content: data?.content,
              attachment: data?.attachment,
              attachment_type: data?.attachment_type
            }
          })

          if (!createChat) throw new createErrors.Conflict('Failed to send chat')

          const message = {}

          if (data?.content) message.content = data?.content

          if (data?.attachment) {
            message.attachment = data?.attachment
            message.attachment_type = data?.attachment_type
          }

          socket.emit(`chat:send:${data?.id}`, { type: 'info', data: message })
        } catch (error) {
          socket.emit(`chat:send:${data?.id}`, { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Chat Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    },
    deleteChat: (data) => {
      const user = socket.userData

      const main = async () => {
        try {
          if (!data) throw new createErrors.BadRequest('Chat Data required')

          const findChat = await prisma.chat.findUnique({
            where: data,
            include: {
              recipient: {
                include: {
                  profile: true
                }
              }
            }
          })

          if (!findChat) throw new createErrors.BadRequest('Failed to find chat')

          if (findChat.senderId !== user.id) throw new createErrors.BadRequest('Access denied, you have no access to this chat')

          const deleteChat = await prisma.chat.delete({
            where: data
          })

          if (!deleteChat) throw new createErrors.Conflict('Failed to remove chat')

          socket.emit(`chat:delete:${user?.id}`, { type: 'info', message: 'Success to remove chat' })
        } catch (error) {
          socket.emit(`chat:delete:${user?.id}`, { type: 'err', message: error.message || 'Server error' })
        }
      }

      main()
        .finally(async () => {
          if (NODE_ENV === 'development') console.log('Chat Socket: Ends the Query Engine child process and closes all connections')

          await prisma.$disconnect()
        })
    }
  }
}
