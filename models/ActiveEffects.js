const mongoose = require("mongoose");

const activeEffectsSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },
        itemid: {
            type: String,
            required: true  // ENG-001, XPPOT-001, etc.
        },
        itemname: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true  // POTION, ENERGY, TITLE
        },
        multiplier: {
            type: Number,
            default: 1  // For XP potions: 2, 4, 6, 10
        },
        expiresAt: {
            type: Date,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
activeEffectsSchema.index({ owner: 1, type: 1, isActive: 1 });
activeEffectsSchema.index({ expiresAt: 1 });

const ActiveEffects = mongoose.model("ActiveEffects", activeEffectsSchema);

module.exports = ActiveEffects;
