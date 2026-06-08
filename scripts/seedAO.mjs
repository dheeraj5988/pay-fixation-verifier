// Run with:  node --env-file=.env.local scripts/seedAO.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Department from '../models/Department.js';
import AccountOfficer from '../models/AccountOfficer.js';

const TEST_AO = {
  loginId: 'ao_test',
  password: 'Test@1234',
  name: 'Test Account Officer',
  phone: '9876543210',
  email: 'ao_test@example.com',
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);

  let dept = await Department.findOne({ code: 'TEST' });
  if (!dept) {
    dept = await Department.create({ name: 'Test Department', code: 'TEST' });
    console.log('Created Test Department:', dept._id.toString());
  }

  const passwordHash = await bcrypt.hash(TEST_AO.password, 12);
  const existing = await AccountOfficer.findOne({ loginId: TEST_AO.loginId });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = TEST_AO.name;
    existing.phone = TEST_AO.phone;
    existing.email = TEST_AO.email;
    existing.department = dept._id;
    existing.isActive = true;
    existing.otp = undefined;
    await existing.save();
    console.log('Updated existing AO:', existing.loginId);
  } else {
    const ao = await AccountOfficer.create({
      loginId: TEST_AO.loginId,
      passwordHash,
      name: TEST_AO.name,
      phone: TEST_AO.phone,
      email: TEST_AO.email,
      department: dept._id,
    });
    console.log('Created AO:', ao.loginId, ao._id.toString());
  }

  console.log(`\nLogin with:  loginId="${TEST_AO.loginId}"  password="${TEST_AO.password}"`);
  console.log('The OTP prints to your dev server console on login (dry-run).');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
