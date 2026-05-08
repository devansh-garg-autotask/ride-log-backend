// require("dotenv").config();

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const helmet = require("helmet");
// const morgan = require("morgan");

// const app = express();

// // 🔹 Middleware
// app.use(cors());
// app.use(express.json({ limit: "1mb" }));
// app.use(helmet());
// app.use(morgan("dev"));

// // 🔹 MongoDB Connection
// mongoose.connect(process.env.MONGO_URI)
// .then(() => console.log("✅ MongoDB Connected"))
// .catch(err => {
//     console.error("❌ MongoDB Error:", err.message);
//     process.exit(1);
// });

// // 🔹 Schema
// const rideLogSchema = new mongoose.Schema({
//     app: { type: String, required: true, trim: true },
//     status: { type: String, required: true, trim: true },
//     info: { type: String, required: true, trim: true },
//     key: {
//         type: String,
//         unique: true,
//         sparse: true,
//         index: true
//     }
// }, { timestamps: true });

// const RideLog = mongoose.model("RideLog", rideLogSchema);
// console.log("Using collection:", RideLog.collection.name);

// // 🔹 Validation
// function isValidLog(log) {
//     return (
//         log &&
//         typeof log.app === "string" &&
//         typeof log.status === "string" &&
//         typeof log.info === "string"
//     );
// }

// // 🔥 MAIN API
// app.post("/ride/logs", async (req, res) => {
//     try {
//         const logs = req.body;

//         // ❌ Not array
//         if (!Array.isArray(logs)) {
//             return res.status(400).json({ success: false, message: "Payload must be array" });
//         }

//         // ❌ Empty
//         if (logs.length === 0) {
//             return res.status(400).json({ success: false, message: "Empty logs array" });
//         }

//         // ❌ Too large
//         if (logs.length > 1000) {
//             return res.status(413).json({ success: false, message: "Too many logs" });
//         }

//         const operations = [];

//         for (const log of logs) {

//             // Skip invalid logs
//             if (!isValidLog(log)) continue;

//             // 🔹 If key exists → UPSERT
//             if (log.key && log.key.trim() !== "") {
//                 operations.push({
//                     updateOne: {
//                         filter: { key: log.key },
//                         update: { $set: log },
//                         upsert: true
//                     }
//                 });
//             } 
//             // 🔹 If no key → INSERT
//             else {
//                 operations.push({
//                     insertOne: {
//                         document: log
//                     }
//                 });
//             }
//         }

//         if (operations.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No valid logs"
//             });
//         }

//         const result = await RideLog.bulkWrite(operations, {
//             ordered: false
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Logs processed",
//             result
//         });

//     } catch (error) {
//         console.error("❌ API Error:", error.message);

//         return res.status(500).json({
//             success: false,
//             message: "Internal server error"
//         });
//     }
// });

// // 🔹 Health Check
// app.get("/", (req, res) => {
//     res.send("🚀 Ride Log Backend Running");
// });

// // 🔹 404
// app.use((req, res) => {
//     res.status(404).json({ success: false, message: "Route not found" });
// });

// // 🔹 Start Server (Render compatible)
// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//     console.log(`🔥 Server running on port ${PORT}`);
// });

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
        required: true
    },

    longitude: {
        type: Number,
        required: true
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

    try {

        const { logs } = req.body;

        if (!Array.isArray(logs)) {
            return res.status(400).json({
                success: false,
                message: "logs must be array"
            });
        }

        if (logs.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Empty logs array"
            });
        }

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

            // 🔹 UPSERT
            if (log.key && log.key.trim() !== "") {

                operations.push({
                    updateOne: {
                        filter: { key: log.key },
                        update: { $set: dbLog },
                        upsert: true
                    }
                });

            }

            // 🔹 INSERT
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
            message: "Logs processed",
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
// 🔥 Location Tracking API
// ======================================================

app.post("/location", async (req, res) => {

    try {

        const { latitude, longitude } = req.body;

        // Validation
        if (
            typeof latitude !== "number" ||
            typeof longitude !== "number"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid coordinates"
            });
        }

        const location = new LocationTrack({
            latitude,
            longitude,
          
        });

        await location.save();

        return res.status(201).json({
            success: true,
            message: "Location saved"
        });

    } catch (error) {

        console.error("❌ Location API Error:", error);

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