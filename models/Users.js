const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const UsersSchema = new mongoose.Schema(
    {
        username: {
            type: String
        },
        password: {
            type: String
        },
        gametoken: {
            type: String
        },
        webtoken: {
            type: String
        },
        bandate: {
            type: String
        },
        banreason: {
            type: String
        },
        walletAddress: {
            type: String,
            unique: true,
            sparse: true, // allows multiple null values
            lowercase: true
        },
        walletNonce: {
            type: String
        },
        walletNonceExpiry: {
            type: Date
        },
        status: {
            type: String,
            default: "active"
        }
    },
    {
        timestamps: true
    }
)

UsersSchema.pre("save", async function (next) {
    if (!this.isModified){
        next();
    }

    this.password = await bcrypt.hashSync(this.password, 10)
})

UsersSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    if (update?.password) {
        update.password = await bcrypt.hash(update.password, 10);
        this.setUpdate(update);
    }

    next();
});

UsersSchema.methods.matchPassword = async function(password){
    return await bcrypt.compare(password, this.password)
}

const Users = mongoose.model("Users", UsersSchema)
module.exports = Users