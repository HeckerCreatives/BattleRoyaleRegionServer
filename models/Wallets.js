const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        type: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
)

// Index for efficient queries
walletSchema.index({ owner: 1, type: 1 });

const Wallets = mongoose.model("Wallets", walletSchema)
module.exports = Wallets