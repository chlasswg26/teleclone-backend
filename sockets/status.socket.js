const status = require('../controllers/status.controllers')

module.exports = (socket) => {
  const { offline, idle, online } = status(socket)

  if (socket.connected) {
    online()
  }

  socket.on('disconnect', (reason) => {
    switch (reason) {
      case 'client namespace disconnect':
        offline()
        break

      default:
        idle()
        break
    }
  })
}
