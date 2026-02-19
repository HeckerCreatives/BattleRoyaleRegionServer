const mongoose = require("mongoose");

const MaintenanceSchema = new mongoose.Schema(
    {
        type: {
            type: String
        },
        value: {
            type: String,
        },
    },
    {
        timestamps: true
    }
)

const Maintenance = mongoose.model("Maintenance", MaintenanceSchema);
module.exports = Maintenance