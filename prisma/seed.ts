// Seed — фаза 1: один subscriber (Aleksandr / Webvibe)
// Запуск: npx ts-node prisma/seed.ts
// (или через prisma seed-скрипт в package.json)

import { PrismaClient, SubscriberStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Фаза 1 — один subscriber (я, Aleksandr/Webvibe).
  // Мультитенантная схема уже готова, схему не менять при переходе на фазу 2.
  const subscriber = await prisma.subscriber.upsert({
    where: { email: "aleksandr.kuc93@gmail.com" },
    update: {},
    create: {
      email: "aleksandr.kuc93@gmail.com",
      name: "Aleksandr",
      company: "Webvibe",
      tier: 1, // Tier 1 — Лиды (фаза 1)
      resend_domain_verified: false,
      // Профиль для генерации писем (заглушка — заполнить перед фазой 2)
      profile: {
        name: "Aleksandr",
        company: "Webvibe",
        services: ["веб-дизайн", "разработка сайтов", "лендинги", "Next.js"],
        tone: "professional",
        portfolio_url: null,
      },
      // Вилка цен (заглушка)
      price_policy: {
        landing: { min: 500, max: 1500, currency: "EUR" },
        corporate: { min: 1500, max: 5000, currency: "EUR" },
      },
      // Первые ниши: стройка (41–43) + недвижимость (68)
      selected_niches: ["41", "42", "43", "68"],
      legal_form: "freelancer",
      status: SubscriberStatus.active,
      trial_ends_at: null,
    },
  });

  console.log(`Subscriber seeded: ${subscriber.email} (id: ${subscriber.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
