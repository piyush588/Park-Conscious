import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../backend/config/database.js";
import Waitlist from "../backend/models/Waitlist.js";
import Contact from "../backend/models/Contact.js";

dotenv.config({ path: "../backend/.env" });

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
if (process.env.MONGODB_URI) {
    connectDB();
} else {
    console.log("⚠️  MONGODB_URI not found in .env. Database features will not work.");
}

// Waitlist API
app.post("/api/waitlist", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const existing = await Waitlist.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: "Email already on waitlist" });
        }

        const waitlistEntry = await Waitlist.create({ email });
        res.status(201).json({ message: "Successfully joined waitlist", data: waitlistEntry });
    } catch (error) {
        console.error("Waitlist Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get Waitlist Data
app.get("/api/waitlist", async (req, res) => {
    try {
        const list = await Waitlist.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// Contact API
app.post("/api/contact", async (req, res) => {
    try {
        const { name, email, role, message } = req.body;

        if (!email || !name) {
            return res.status(400).json({ message: "Name and Email are required" });
        }

        const contactEntry = await Contact.create({
            name,
            email,
            role,
            message
        });

        res.status(201).json({ message: "Message sent successfully", data: contactEntry });
    } catch (error) {
        console.error("Contact Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get Contact Data
app.get("/api/contact", async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// Health check
app.get("/api", (req, res) => res.json({ status: "✅ API running!" }));

// Export for Vercel serverless
export default app;
