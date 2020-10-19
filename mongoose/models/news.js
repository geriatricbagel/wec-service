const mongoose = require('mongoose');

let newsSchema = new mongoose.Schema({
    title: String,
    content: String,
    featureImage: String,
    otherImages: Object,
    author: String,
    createdOn: Date,
    lastEdited: Date
})

let News = mongoose.model('News', newsSchema)

module.exports = News