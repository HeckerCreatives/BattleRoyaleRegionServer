const mongoose = require("mongoose")

const contentSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staffusers"
        },
        title: {
            type: String,
        },
        description: {
            type: String,
        },
        link: {
            type: String,
        },
        type: {
            type: String
        }
    },
    {
        timestamps: true,
    }
)

const Content = mongoose.model("Content", contentSchema)

module.exports = Content