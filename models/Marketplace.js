const mongoose = require("mongoose")

const marketplaceSchema = new mongoose.Schema(
    {
        itemid: {
            type: String    //  ENG-001, ENG-002, ENG-003, ENG-004 PARA SA ENERGY
                            //  XPPOT-001, XPPOT-002 PARA SA POTION
                            //  TITLE-001, TITLE-002 PARA SA TITLES
                            //  ENERGY TYPES: ENERGY +1, +3, +5, +10
                            //  XP POTION: x2, x4, x6, x10 (24 HOURS)
                            //  TITLES: KILLING KING, ULTIMATE PLAYER, GRIM REPEAR
        },
        itemname: {
            type: String,   //  ENERGY +1, XP POTION x2,
        },
        description: {
            type: String,
        },
        amount: {
            type: String,   //  HOW MUCH?
        },
        currency: {
            type: String    //  POINTS (LEADERBOARD POINTS), COINS
        },
        type:{
            type: String    //  POTION, ENERGY, TITLE
        },
        consumable: {
            type: String    //  10
        }
    },
    {
        timestamps: true,
    }
)

const Marketplace = mongoose.model("Marketplace", marketplaceSchema)

module.exports = Marketplace