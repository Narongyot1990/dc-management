// Seed script to create mock data for testing
// Run with: node scripts/seed-data.js

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://narongyb_db_user:E0ZHhWoNDIwna43W@fls-transport.jbzm6sk.mongodb.net/?appName=fls-transport';

// Job Schema
const JobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['in', 'out', 'swap'], required: true },
  container_no: { type: String, required: true },
  dock_from: { type: String },
  dock_to: { type: String },
  driver_id: { type: String },
  status: {
    type: String,
    enum: ['pending', 'completed', 'issue'],
    default: 'pending'
  },
  remark: { type: String },
  issue_type: {
    type: String,
    enum: ['not_found', 'wrong_number', 'duplicate', 'other']
  },
  issue_detail: { type: String },
  created_at: { type: Date, default: Date.now },
  created_by: { type: String, required: true },
  completed_at: { type: Date },
}, { timestamps: true });

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

// Mock data
const mockJobs = [
  {
    id: 'J001',
    type: 'in',
    container_no: 'ABCU1234567',
    dock_to: 'D-15',
    driver_id: 'DRV001',
    status: 'pending',
    remark: 'สินค้าเปราะบาง ระมัดระวัง',
    created_by: 'PLN001',
    created_at: new Date()
  },
  {
    id: 'J002',
    type: 'out',
    container_no: 'TCLU9876543',
    dock_from: 'D-08',
    driver_id: 'DRV001',
    status: 'pending',
    remark: '',
    created_by: 'PLN001',
    created_at: new Date()
  },
  {
    id: 'J003',
    type: 'swap',
    container_no: 'HLCU1111111',
    dock_from: 'D-12',
    dock_to: 'D-07',
    driver_id: 'DRV001',
    status: 'pending',
    remark: 'ตรวจสอบเบอร์ให้ชัดเจน',
    created_by: 'PLN001',
    created_at: new Date()
  },
  {
    id: 'J004',
    type: 'in',
    container_no: 'MSCU5555555',
    dock_to: 'F2',
    driver_id: 'DRV001',
    status: 'pending',
    remark: 'ช่อง F2 พิเศษ',
    created_by: 'PLN001',
    created_at: new Date()
  },
  {
    id: 'J005',
    type: 'out',
    container_no: 'CSLU3333333',
    dock_from: 'D-20',
    driver_id: 'DRV001',
    status: 'pending',
    remark: '',
    created_by: 'PLN001',
    created_at: new Date()
  },
  // Completed jobs
  {
    id: 'J006',
    type: 'in',
    container_no: 'TEST0001',
    dock_to: 'D-05',
    driver_id: 'DRV001',
    status: 'completed',
    remark: 'ทดสอบระบบ',
    created_by: 'PLN001',
    created_at: new Date(Date.now() - 3600000),
    completed_at: new Date(Date.now() - 1800000)
  },
  {
    id: 'J007',
    type: 'out',
    container_no: 'TEST0002',
    dock_from: 'D-10',
    driver_id: 'DRV001',
    status: 'completed',
    remark: '',
    created_by: 'PLN001',
    created_at: new Date(Date.now() - 7200000),
    completed_at: new Date(Date.now() - 3600000)
  },
  // Issue job
  {
    id: 'J008',
    type: 'in',
    container_no: 'ERROR001',
    dock_to: 'D-03',
    driver_id: 'DRV001',
    status: 'issue',
    issue_type: 'not_found',
    remark: '',
    created_by: 'PLN001',
    created_at: new Date(Date.now() - 5400000)
  }
];

async function seedData() {
  try {
    console.log('🌱 Starting seed...');
    console.log('📡 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing jobs...');
    await Job.deleteMany({});
    console.log('✅ Cleared existing data');

    // Insert mock data
    console.log('📝 Inserting mock jobs...');
    await Job.insertMany(mockJobs);
    console.log(`✅ Inserted ${mockJobs.length} mock jobs`);

    // Show summary
    const pending = await Job.countDocuments({ status: 'pending' });
    const completed = await Job.countDocuments({ status: 'completed' });
    const issue = await Job.countDocuments({ status: 'issue' });

    console.log('\n📊 Summary:');
    console.log(`   Pending: ${pending}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Issue: ${issue}`);
    console.log(`   Total: ${pending + completed + issue}`);

    console.log('\n✨ Seed completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
