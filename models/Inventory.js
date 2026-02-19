const mongoose = require("mongoose")

const inventorySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        itemid: {
            type: String,
            required: true  // ENG-001, XPPOT-001, TITLE-001, etc.
        },
        itemname: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true  // POTION, ENERGY, TITLE
        },
        quantity: {
            type: Number,
            default: 1
        },
        isEquipped: {
            type: Boolean,
            default: false  // For titles only
        }
    },
    {
        timestamps: true,
    }
)

// Index for efficient queries
inventorySchema.index({ owner: 1, itemid: 1 });
inventorySchema.index({ owner: 1, type: 1 });

const Inventory = mongoose.model("Inventory", inventorySchema)

module.exports = Inventory