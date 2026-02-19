const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staffusers"
        },
        title: {
            type: String
        },
        description: {
            type: String
        },
        banner: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

const News = mongoose.model("News", newsSchema)
module.exports = News