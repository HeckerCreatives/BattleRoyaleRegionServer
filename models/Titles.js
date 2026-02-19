const mongoose = require("mongoose");



const TitleSchema = new mongoose.Schema( 
    {
        category: {
            type: String,
            required: true,
        },
        index: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        rarity: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
)

const CharacterTitlesSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Users',
            required: true
        },
        title: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Titles',
            required: true
        },
        isEquipped: {
            type: Boolean,
            default: false
        },
    },
    {
        timestamps: true
    }
)

const Titles = mongoose.model("Titles", TitleSchema);
const CharacterTitles = mongoose.model("CharacterTitles", CharacterTitlesSchema);

module.exports = { Titles, CharacterTitles };