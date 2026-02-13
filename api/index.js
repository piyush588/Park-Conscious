import mongoose from 'mongoose';

// MongoDB connection with singleton pattern
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
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
    role: String,
    message: String,
}, {
    timestamps: true,
});

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// Main handler
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Connect to DB
        await connectDB();

        const { method, url } = req;

        // Root/health check
        if (method === 'GET' && (!url || url === '/' || url === '/api')) {
            return res.status(200).json({
                status: "✅ API running!",
                connected: mongoose.connection.readyState === 1
            });
        }

        // Waitlist endpoints
        if (url && url.includes('waitlist')) {
            if (method === 'POST') {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).json({ message: "Email is required" });
                }

                const existing = await Waitlist.findOne({ email });
                if (existing) {
                    return res.status(409).json({ message: "Email already on waitlist" });
                }

                const entry = await Waitlist.create({ email });
                return res.status(201).json({
                    message: "Successfully joined waitlist",
                    data: entry
                });
            }

            if (method === 'GET') {
                const list = await Waitlist.find().sort({ createdAt: -1 }).limit(100);
                return res.status(200).json(list);
            }
        }

        // Contact endpoints
        if (url && url.includes('contact')) {
            if (method === 'POST') {
                const { name, email, role, message } = req.body;

                if (!email || !name) {
                    return res.status(400).json({ message: "Name and Email are required" });
                }

                const entry = await Contact.create({ name, email, role, message });
                return res.status(201).json({
                    message: "Message sent successfully",
                    data: entry
                });
            }

            if (method === 'GET') {
                const messages = await Contact.find().sort({ createdAt: -1 }).limit(100);
                return res.status(200).json(messages);
            }
        }

        return res.status(404).json({ message: "Not found", url, method });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
