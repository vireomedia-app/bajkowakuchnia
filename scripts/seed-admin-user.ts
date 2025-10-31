import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'jpietroszek@gmail.com';
  const password = process.env.APP_PASSWORD || 'Bajkowy2025';
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    console.log('✅ Admin user already exists');
    return;
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create admin user
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    }
  });
  
  console.log('✅ Admin user created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
