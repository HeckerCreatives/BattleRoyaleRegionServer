const { default: mongoose } = require("mongoose");


const SocialLinksSchema = new mongoose.Schema(
    {
        link: {
            type: String,
            index: true,
        },
        title: { // Facebook, Instagram, X, Threads, Tiktok, Youtube, etc...
            type: String,
            index: true,
        }
    },
    {
        timestamps: true,
    }
)

const Sociallinks = mongoose.model("Sociallinks", SocialLinksSchema)
module.exports = Sociallinks