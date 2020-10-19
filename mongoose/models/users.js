const mongoose = require('mongoose');

let userSchema = new mongoose.Schema({
    email: String,
    password: String,
    fullName: String,
    picture: String,
    isAdmin: Boolean
})

let User = mongoose.model('User', userSchema)

module.exports = User