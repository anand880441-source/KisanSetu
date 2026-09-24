const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const buyerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    phno: { type: String, required: true, trim: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    pin: { type: Number, required: true },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
        address: { type: String, default: '' }
    },
    isEmailVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLastSentAt: { type: Date, select: false },
    cart: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1 }
    }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Feedback' }]
}, { timestamps: true });

buyerSchema.index({ location: '2dsphere' });

buyerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 14);
    next();
});

buyerSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for role
buyerSchema.virtual('role').get(function () {
    return 'buyer';
});

buyerSchema.set('toJSON', { virtuals: true });
buyerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Buyer', buyerSchema);
