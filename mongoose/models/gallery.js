const mongoose = require('mongoose');

let photoSchema = new mongoose.Schema({
    url: String,
    date_created: Date,
    filename: String,
    type: String,
    title: String,
    description: String
})

let Photo = mongoose.model('Photo', photoSchema)

module.exports = Photo