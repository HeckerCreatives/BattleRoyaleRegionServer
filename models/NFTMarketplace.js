const { default: mongoose } = require('mongoose')

const NFTMarketplaceSchema = new mongoose.Schema(
    {
        inventoryItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: true,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        selleraddress: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        tokenid: {
            type: Number,
            required: true,
        },
        itemname: {
            type: String,
        },
        type: {
            type: String,
        },
        ipfsImage: {
            type: String,
        },
        status: {
            type: String,
            enum: ['active', 'sold', 'cancelled'],
            default: 'active'
        }
    },
    {
        timestamps: true,
    }
)

const NFTMarketplace = mongoose.model("NFTMarketplace", NFTMarketplaceSchema)
module.exports = NFTMarketplace