const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint:   { type: String, required: true, unique: true },
  keys: {
    p256dh:   { type: String, required: true },
    auth:     { type: String, required: true }
  },
  usuario:    { type: String, default: '' },
  dispositivo:{ type: String, default: 'web' },
  activo:     { type: Boolean, default: true }
}, { timestamps: true, collection: 'push_subscriptions' });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
