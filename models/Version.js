const { default: mongoose } = require("mongoose");

const VersionSchema = new mongoose.Schema(
    {
        version: {
            type: String,
            required: true,
            unique: true
        },
        description: {
            type: String,
            required: true
        },
        releaseDate: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,

    }
)

const Version = mongoose.model("Version", VersionSchema);
module.exports = Version;