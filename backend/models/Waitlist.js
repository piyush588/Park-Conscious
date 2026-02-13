import mongoose from 'mongoose';

const waitlistSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
    },
}, {
    timestamps: true,
});

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

export default Waitlist;
