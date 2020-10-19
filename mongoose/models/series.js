const mongoose = require('mongoose');

let seriesSchema = new mongoose.Schema({
    title: String,
    description: String
})

let Series = mongoose.model('Series', seriesSchema)

module.exports = Series