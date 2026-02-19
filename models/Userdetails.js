const mongoose = require("mongoose");

const UserdetailsSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },
        email:{
            type: String
        },
        country: {
            type: String
        },
        profilepicture: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
)

const Userdetails = mongoose.model("Userdetails", UserdetailsSchema)
module.exports = Userdetails