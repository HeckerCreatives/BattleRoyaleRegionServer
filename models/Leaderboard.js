const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        amount: {
            type: Number
        }
    },
    {
        timestamps: true
    }
)

const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema)
module.exports = Leaderboard