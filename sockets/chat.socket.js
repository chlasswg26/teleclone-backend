const chat = require('../controllers/chat.controllers')

module.exports = (socket) => {
  const {
    readChat,
    sendChat,
    deleteChat
  } = chat(socket)

  socket.on('chat:read', readChat)
  socket.on('chat:send', sendChat)
  socket.on('chat:delete', deleteChat)
}
