'use strict';
// If you already have functions/index.js (e.g. the Whisper voice-note function),
// do NOT replace it — just add these two lines to it.
const rial = require('./rial');

exports.getRialQuote = rial.getRialQuote;
exports.createRialOrder = rial.createRialOrder;
exports.sendUssdPush = rial.sendUssdPush;
exports.clickpesaWebhook = rial.clickpesaWebhook;
exports.pollRialOrders = rial.pollRialOrders;
exports.completeRialOrder = rial.completeRialOrder;
