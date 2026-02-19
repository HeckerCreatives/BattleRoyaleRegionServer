const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const PlayerCharacterSettingSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        hairstyle: {
            type: Number
        },
        haircolor: {
            type: Number
        },
        clothingcolor: {
            type: Number
        },
        skincolor: {
            type: Number
        }
    },
    {
        timestamps: true
    }
)

const PlayerCharacterSetting = mongoose.model("PlayerCharacterSetting", PlayerCharacterSettingSchema)
module.exports = PlayerCharacterSetting