// scripts/updateBundlePrice.mjs
// Re-prices "Test Bundle 10" to the new math: 10 tokens = Rs.1000 = 100000 paise.
// Usage: node --env-file=.env.local scripts/updateBundlePrice.mjs
import mongoose from 'mongoose';
import TokenBundle from '../models/TokenBundle.js';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await TokenBundle.updateOne(
    { name: 'Test Bundle 10' },
    { $set: { priceInPaise: 100000, tokenQuantity: 10 } }
  );
  console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);
  const bundle = await TokenBundle.findOne({ name: 'Test Bundle 10' }).lean();
  console.log('Now:', bundle ? `${bundle.tokenQuantity} tokens = Rs.${bundle.priceInPaise / 100}` : '(not found)');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
