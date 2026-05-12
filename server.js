require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// 🔹 Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(helmet());
app.use(morgan("dev"));

// 🔹 MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
});

// ======================================================
// 🔹 Ride Log Schema
// ======================================================

const rideLogSchema = new mongoose.Schema({

    app: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        required: true,
        trim: true
    },

    info: {
        type: String,
        required: true,
        trim: true
    },

    key: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },

    rideAppearTime: {
        type: Number,
        default: null
    },

    rideAcceptanceTime: {
        type: Number,
        default: null
    }

}, { timestamps: true });

const RideLog = mongoose.model("RideLog", rideLogSchema);

// ======================================================
// 🔹 Location Tracking Schema
// ======================================================

const locationTrackSchema = new mongoose.Schema({

    latitude: {
        type: Number,
        required: false,
        default: null
    },

    longitude: {
        type: Number,
        required: false,
        default: null
    },

    timestamp: {
    type: Number,
    default: Date.now
    }

}, { timestamps: true });

const LocationTrack = mongoose.model(
    "LocationTrack",
    locationTrackSchema
);

const appStatusSchema = new mongoose.Schema({

    app: {
        type: String,
        required: true,
        trim: true
    },

    appStatus: {
        type: String,
        required: true,
        trim: true
    },

    timestamp: {
        type: Number,
        default: Date.now
    }

}, { timestamps: true });

const AppStatus = mongoose.model(
    "AppStatus",
    appStatusSchema
);

// ======================================================
// 🔹 Validation
// ======================================================

function isValidLog(log) {

    return (
        log &&
        typeof log.app === "string" &&
        typeof log.status === "string" &&
        typeof log.info === "string"
    );
}

// ======================================================
// 🔥 Ride Logs API
// ======================================================


app.post("/ride/logs", async (req, res) => {

    console.log(req.body);

    try {

        const {
            logs,
            appStatus,
            latitude,
            longitude
        } = req.body;

        // =========================
        // APP STATUS UPDATE
        // =========================

        if (Array.isArray(appStatus)) {

            for (const statusLog of appStatus) {

                const appStatusUpdateData = {

                    timestamp: Date.now()

                };

                if (
                    typeof statusLog.app === "string" &&
                    typeof statusLog.appStatus === "string"
                ) {

                    appStatusUpdateData.appStatus =
                        statusLog.appStatus;

                    await AppStatus.findOneAndUpdate(

                        {
                            app: statusLog.app
                        },

                        appStatusUpdateData,

                        {
                            new: true,
                            upsert: true
                        }
                    );
                }
            }
        }

        // =========================
        // LOCATION UPDATE
        // =========================

        const locationUpdateData = {

            timestamp: Date.now()

        };

        // Only overwrite location if valid coords received
        if (
            typeof latitude === "number" &&
            typeof longitude === "number"
        ) {

            locationUpdateData.latitude = latitude;
            locationUpdateData.longitude = longitude;
        }

        await LocationTrack.findOneAndUpdate(

            {},

            locationUpdateData,

            {
                new: true,
                upsert: true
            }
        );

        // =========================
        // LOG VALIDATION
        // =========================

        if (!Array.isArray(logs)) {

            return res.status(400).json({

                success: false,
                message: "logs must be array"
            });
        }

        // if (logs.length === 0) {

        //     return res.status(400).json({

        //         success: false,
        //         message: "Empty logs array"
        //     });
        // }

        if (logs.length > 1000) {

            return res.status(413).json({

                success: false,
                message: "Too many logs"
            });
        }

        const operations = [];

        for (const log of logs) {

            if (!isValidLog(log)) continue;

            const dbLog = {

                app: log.app,
                status: log.status,
                info: log.info,
                key: log.key || null,
                rideAppearTime: log.rideAppearTime || null,
                rideAcceptanceTime: log.rideAcceptanceTime || null
            };

            // UPSERT
            if (log.key && log.key.trim() !== "") {

                operations.push({

                    updateOne: {

                        filter: { key: log.key },

                        update: { $set: dbLog },

                        upsert: true
                    }
                });

            }

            // INSERT
            else {

                operations.push({

                    insertOne: {

                        document: dbLog
                    }
                });
            }
        }

        if (operations.length === 0) {

            return res.status(400).json({

                success: false,
                message: "No valid logs"
            });
        }

        const result = await RideLog.bulkWrite(

            operations,

            { ordered: false }
        );

        return res.status(200).json({

            success: true,
            message: "Logs and location processed",

            result
        });

    } catch (error) {

        console.error("❌ Ride API Error:", error);

        return res.status(500).json({

            success: false,
            message: "Internal server error"
        });
    }
});


// ======================================================
// 🔥 GET RIDE LOGS
// ======================================================

app.get("/ride/logs", async (req, res) => {

    try {

        const { date } = req.query;

        let filter = {};

        // 🔹 Filter by date
        if (date) {

            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            filter = {
                createdAt: {
                    $gte: start,
                    $lte: end
                }
            };
        }

        const logs = await RideLog.find(filter)
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            data: logs
        });

    } catch (error) {

        console.error("❌ Get Ride Logs Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// ======================================================
// 🔥 GET LOCATIONS
// ======================================================

app.get("/location", async (req, res) => {

    try {

        const location = await LocationTrack.findOne();

        return res.status(200).json({
            success: true,
            data: location
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});


app.get("/app-status", async (req, res) => {

    try {

        const appStatuses = await AppStatus.find();

        return res.status(200).json({

            success: true,
            data: appStatuses
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,
            message: "Internal server error"
        });
    }
});

// ======================================================
// 🔹 Health Check
// ======================================================

app.get("/", (req, res) => {
    res.send("🚀 Ride Log Backend Running");
});

// ======================================================
// 🔹 404
// ======================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// ======================================================
// 🔹 Start Server
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});