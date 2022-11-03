const contact = require('../controllers/contact.controllers')

module.exports = (socket) => {
  const {
    findContact,
    readContact,
    addContact,
    deleteContact
  } = contact(socket)

  socket.on('contact:find', findContact)
  socket.on('contact:read', readContact)
  socket.on('contact:add', addContact)
  socket.on('contact:delete', deleteContact)
}
