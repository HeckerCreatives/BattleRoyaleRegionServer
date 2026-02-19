const mongoose = require("mongoose");

const energySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        energy: {
            type: Number
        }
    },
    {
        timestamps: true
    }
)

const Energy = mongoose.model("Energy", energySchema)
module.exports = Energy