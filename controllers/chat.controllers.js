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
            'password'
          ])

          socket.emit('chat:read', { type: 'done', data: chat })
        } catch (error) {
          socket.emit('chat:read', {
            type: 'err',
            message: error.message || 'Server error'
          })
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

          socket
            .to(data?.socketId)
            .emit('chat:send', { type: 'info', data: message })
        } catch (error) {
          socket.emit('chat:send', {
            type: 'err',
            message: error.message || 'Server error'
          })
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

          const deleteChat = await prisma.chat.update({
            where: data,
            data: {
              status: 'UNAVAILABLE'
            },
            include: {
              recipient: true,
              sender: true
            }
          })

          if (!deleteChat) throw new createErrors.Conflict('Failed to remove chat')

          socket.to([deleteChat.sender.session_id, deleteChat.recipient.session_id]).emit('chat:read')
        } catch (error) {
          socket.emit('chat:delete', { type: 'err', message: error.message || 'Server error' })
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
