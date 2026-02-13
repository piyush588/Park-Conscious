import connectDB from "../backend/config/database.js";
import Waitlist from "../backend/models/Waitlist.js";
import Contact from "../backend/models/Contact.js";

// Connect to MongoDB once
let isConnected = false;

async function ensureConnection() {
    if (!isConnected && process.env.MONGODB_URI) {
        await connectDB();
        isConnected = true;
    }
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    await ensureConnection();

    const { method, url } = req;

    // Health check
    if (url === '/api' && method === 'GET') {
        return res.json({ status: "✅ API running!" });
    }

    // Waitlist endpoints
    if (url === '/api/waitlist') {
        if (method === 'POST') {
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
                return res.status(201).json({
                    message: "Successfully joined waitlist",
                    data: waitlistEntry
                });
            } catch (error) {
                console.error("Waitlist Error:", error);
                return res.status(500).json({ message: "Server Error", error: error.message });
            }
        }

        if (method === 'GET') {
            try {
                const list = await Waitlist.find().sort({ createdAt: -1 });
                return res.json(list);
            } catch (error) {
                return res.status(500).json({ message: "Server Error" });
            }
        }
    }

    // Contact endpoints
    if (url === '/api/contact') {
        if (method === 'POST') {
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

                return res.status(201).json({
                    message: "Message sent successfully",
                    data: contactEntry
                });
            } catch (error) {
                console.error("Contact Error:", error);
                return res.status(500).json({ message: "Server Error", error: error.message });
            }
        }

        if (method === 'GET') {
            try {
                const messages = await Contact.find().sort({ createdAt: -1 });
                return res.json(messages);
            } catch (error) {
                return res.status(500).json({ message: "Server Error" });
            }
        }
    }

    return res.status(404).json({ message: "Not found" });
}
