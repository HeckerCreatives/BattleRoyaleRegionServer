const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const GuestSchema = new mongoose.Schema(
    {
        count: {
            type: Number
        }
    },
    {
        timestamps: true
    }
)

const Guest = mongoose.model("Guest", GuestSchema)
module.exports = Guest