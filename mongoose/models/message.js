const mongoose = require('mongoose');

let messageSchema = new mongoose.Schema({
    name: String,
    message: String,
    date: String,
    email: String
})

let Message = mongoose.model('Message', messageSchema)

module.exports = Message