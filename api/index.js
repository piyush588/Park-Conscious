import mongoose from 'mongoose';

// MongoDB connection
let isConnected = false;

async function connectDB() {
    if (isConnected) return;

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Error: ${error.message}`);
    }
}

// Waitlist Model
const waitlistSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
    },
}, {
    timestamps: true,
});

const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', waitlistSchema);

// Contact Model
const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
    },
    role: {
        type: String,
        required: false,
    },
    message: {
        type: String,
        required: false,
    },
}, {
    timestamps: true,
});

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// Serverless Function Handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Connect to database
    if (process.env.MONGODB_URI) {
        await connectDB();
    }

    const { method, url } = req;

    try {
        // Health check
        if (url === '/api' && method === 'GET') {
            return res.status(200).json({ status: "✅ API running!", connected: isConnected });
        }

        // Waitlist POST
        if (url === '/api/waitlist' && method === 'POST') {
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
        }

        // Waitlist GET
        if (url === '/api/waitlist' && method === 'GET') {
            const list = await Waitlist.find().sort({ createdAt: -1 });
            return res.status(200).json(list);
        }

        // Contact POST
        if (url === '/api/contact' && method === 'POST') {
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
        }

        // Contact GET
        if (url === '/api/contact' && method === 'GET') {
            const messages = await Contact.find().sort({ createdAt: -1 });
            return res.status(200).json(messages);
        }

        return res.status(404).json({ message: "Not found" });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
}
