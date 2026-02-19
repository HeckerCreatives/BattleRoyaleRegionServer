const { default: mongoose } = require("mongoose");



const LeaderboardHistorySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        category: {
            type: String,
            enum: ["kill", "death", "level", "amount"],
        },
        amount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        index: {
            type: Number,
            required: true
        },
        season: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seasons",
        }
    },
    {
        timestamps: true
    }
)

const LeaderboardHistory = mongoose.model("LeaderboardHistory", LeaderboardHistorySchema);
module.exports = LeaderboardHistory;