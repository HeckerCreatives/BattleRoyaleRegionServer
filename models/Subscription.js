const { default: mongoose } = require("mongoose");


const SubscriptionSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            index: true,
        }
    },
    {
        timestamps: true
    }
)

const Subscription = mongoose.model("Subscription", SubscriptionSchema)
module.exports = Subscription