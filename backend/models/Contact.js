import mongoose from 'mongoose';

const contactSchema = mongoose.Schema({
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
        required: false, // Optional: 'User' or 'Parking Owner'
    },
    message: {
        type: String,
        required: false,
    },
}, {
    timestamps: true,
});

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
