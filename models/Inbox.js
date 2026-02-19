const mongoose = require("mongoose");

const inboxSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        type: {
            type: String
        },
        rewards: {
            type: [{type: { type: String }, amount: { type: Number }, status: { type: String }}]
        },
        title: {
            type: String
        },
        description: {
            type: String
        },
        status: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

const Inbox = mongoose.model("Inbox", inboxSchema)
module.exports = Inbox