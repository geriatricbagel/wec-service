const mongoose = require('mongoose');

let speakerSchema = new mongoose.Schema({
    firstName: String,
    surname: String,
    fullName: String,
    church: String
})

let Speaker = mongoose.model('Speaker', speakerSchema)

module.exports = Speaker