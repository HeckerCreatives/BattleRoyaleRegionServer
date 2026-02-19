const mongoose = require("mongoose");

const SeasonSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            index: true,
        },
        duration: {
            type: Number, // Number of days
            index: true,
        },
        status: {
            type: String,
            enum: ["active", "ended", "upcoming"],
            default: "upcoming",
            index: true,
        },
        startedAt: {
            type: Date,
        }
    },
    {
        timestamps: true,
    }
);

const Season = mongoose.model("Season", SeasonSchema);
module.exports = Season;