const mongoose = require("mongoose");

const MatchHistorySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        kill: {
            type: Number
        },
        placement: {
            type: Number
        }
    },
    {
        timestamps: true
    }
)

const Matchhistory = mongoose.model("Matchhistory", MatchHistorySchema);
module.exports = Matchhistory