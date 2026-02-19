const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema(
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

const Newsletter = mongoose.model("Newsletter", NewsletterSchema)
module.exports = Newsletter