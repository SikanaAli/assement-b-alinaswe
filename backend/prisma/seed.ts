import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const seedUsers = [
  {
    name: 'Applicant',
    email: 'applicant@example.com',
    password: 'password123',
    role: Role.APPLICANT,
  },
  {
    name: 'Reviewer',
    email: 'reviewer@example.com',
    password: 'password123',
    role: Role.REVIEWER,
  },
] as const;

async function main() {
  for (const user of seedUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }

  console.log('Seeded users:', seedUsers.map((user) => user.email).join(', '));
}

main()
  .catch((error) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
