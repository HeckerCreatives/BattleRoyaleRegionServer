const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },
        type: {
            type: String,
            enum: ["purchase", "sale", "use", "earn"],
            required: true
        },
        action: {
            type: String,
            enum: ["buy", "sell", "use", "equip", "unequip"],
            required: true
        },
        itemid: {
            type: String,
            required: true
        },
        itemname: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            enum: ["points", "coins", "none"],
            required: true
        },
        description: {
            type: String
        }
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
transactionSchema.index({ owner: 1, createdAt: -1 });
transactionSchema.index({ type: 1, action: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;