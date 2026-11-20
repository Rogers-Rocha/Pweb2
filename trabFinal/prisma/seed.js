/* Seed de desenvolvimento: cria admin, treinador e membro de demonstração. */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('Defina SEED_ADMIN_PASSWORD para executar o seed em produção.');
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345678';
  const hash = (p) => bcrypt.hash(p, 12);

  const admin = await prisma.user.upsert({
    where: { email: (process.env.SEED_ADMIN_EMAIL || 'admin@gym.local').toLowerCase() },
    update: {},
    create: {
      email: (process.env.SEED_ADMIN_EMAIL || 'admin@gym.local').toLowerCase(),
      name: 'Administrador',
      role: 'ADMIN',
      passwordHash: await hash(adminPassword),
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    const trainer = await prisma.user.upsert({
      where: { email: 'trainer@gym.local' },
      update: {},
      create: { email: 'trainer@gym.local', name: 'Treinador Demo', role: 'TRAINER', passwordHash: await hash('Trainer@12345678') },
    });

    const existing = await prisma.user.findUnique({ where: { email: 'member@gym.local' } });
    if (!existing) {
      await prisma.member.create({
        data: {
          plan: 'STANDARD',
          phone: '+55 89 99999-0000',
          user: { create: { email: 'member@gym.local', name: 'Membro Demo', role: 'MEMBER', passwordHash: await hash('Member@12345678') } },
        },
      });
    }

    const templates = await prisma.workout.count({ where: { memberId: null } });
    if (templates === 0) {
      await prisma.workout.create({
        data: {
          title: 'Full Body Iniciante',
          description: 'Treino modelo para iniciantes',
          level: 'BEGINNER',
          durationMin: 45,
          trainerId: trainer.id,
          exercises: [
            { name: 'Agachamento livre', sets: 3, reps: 12, restSeconds: 60 },
            { name: 'Supino reto', sets: 3, reps: 10, restSeconds: 90 },
            { name: 'Remada curvada', sets: 3, reps: 10, restSeconds: 90 },
          ],
        },
      });
    }
  }
  console.log('Seed concluído. Admin:', admin.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
