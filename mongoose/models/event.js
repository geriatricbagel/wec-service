const mongoose = require('mongoose');

let eventSchema = new mongoose.Schema({
    title: String,
    description: String,
    start: Date,
    end: Date,
    speaker: String,
    type: String
})

let Event = mongoose.model('Event', eventSchema)

module.exports = Event