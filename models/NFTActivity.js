const mongoose = require('mongoose');

const NFTActivitySchema = new mongoose.Schema(
    {
        tokenId: {
            type: Number,
            required: true,
            index: true
        },
        inventoryItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory"
        },
        activityType: {
            type: String,
            enum: [
                'mint',           // NFT minted
                'transfer',       // Direct transfer/gift
                'list',           // Listed on marketplace
                'delist',         // Removed from marketplace
                'sale',           // Sold on marketplace
                'gift',           // Gifted to another user
                'burn',           // NFT burned/destroyed
                'cancel_mint',     // Mint cancelled
                'bridge'        // Bridge on-chain nft to backend system
            ],
            required: true,
            index: true
        },
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        fromWallet: {
            type: String
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        toWallet: {
            type: String
        },
        price: {
            type: Number  // For sale/list activities
        },
        txHash: {
            type: String  // Blockchain transaction hash (if applicable)
        },
        itemname: {
            type: String
        },
        type: {
            type: String
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed  // Additional data specific to activity type
        }
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
NFTActivitySchema.index({ tokenId: 1, createdAt: -1 });
NFTActivitySchema.index({ from: 1, createdAt: -1 });
NFTActivitySchema.index({ to: 1, createdAt: -1 });
NFTActivitySchema.index({ activityType: 1, createdAt: -1 });

const NFTActivity = mongoose.model("NFTActivity", NFTActivitySchema);
module.exports = NFTActivity;
