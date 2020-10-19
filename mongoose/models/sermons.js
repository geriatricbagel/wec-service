const mongoose = require('mongoose');

let sermonSchema = new mongoose.Schema({
    speaker: String,
    references: Object,
    date: Date,
    service: String,
    url: String,
    series: String
})

let Sermon = mongoose.model('Sermon', sermonSchema)

module.exports = Sermon