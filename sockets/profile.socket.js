const profile = require('../controllers/profile.controllers')

module.exports = (socket) => {
  const { readProfile, updateProfile } = profile(socket)

  socket.on('profile:update', updateProfile)
  socket.on('profile:read', readProfile)
}
