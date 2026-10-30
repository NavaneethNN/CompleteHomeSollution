import { db } from "../lib/db";

async function seedRaffles() {
  console.log("Seeding initial raffles...");

  // Check if any raffle already exists
  const count = await db.raffle.count();
  if (count > 0) {
    console.log(`Already found ${count} raffles. Skipping initial seed.`);
    return;
  }

  // Find sample products
  const bed = await db.product.findFirst({ where: { name: { contains: "Bed", mode: "insensitive" } } });
  const chair = await db.product.findFirst({ where: { name: { contains: "Chair", mode: "insensitive" } } });
  const table = await db.product.findFirst({ where: { name: { contains: "Table", mode: "insensitive" } } });

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const drawDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const raffle1 = await db.raffle.create({
    data: {
      title: "Grand Spring Home Luxury Raffle",
      slug: "grand-spring-home-luxury-raffle",
      shortDescription: "Win a King Platform Bed for free or get exclusive $79 luxury office chairs!",
      description: `Welcome to our biggest giveaway of the season! At Complete Home Sollution, we love rewarding our wonderful community with premium home essentials.
      
Enter for free today to win incredible multi-tier prizes including a brand new luxury King Size Platform Bed shipped directly to your door, or exclusive discounted purchase privileges on designer ergonomic chairs!`,
      bannerImage: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80",
      images: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
      ],
      status: "ACTIVE",
      entryPrice: 0,
      isPaid: false,
      visibility: "ALL",
      maxEntriesPerUser: 5,
      minEntriesPerUser: 1,
      totalMaxEntries: 1000,
      allowMultipleEntries: true,
      startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endDate: nextMonth,
      drawDate: drawDate,
      automaticClosure: true,
      isFeatured: true,
      displayOnHomepage: true,
      terms: "1. Open to all Australian residents aged 18+. 2. Multiple entries permitted up to 5 per account. 3. Free product winners receive complimentary delivery to Australian addresses. 4. Paid product winners can redeem at the exclusive discounted price within 14 days.",
      prizes: {
        create: [
          {
            rank: 1,
            name: "Grand Prize: King Size Platform Bed (100% FREE)",
            description: "Handcrafted timber platform bed with upholstered headboard. Includes free doorstep delivery nationwide.",
            images: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"],
            value: 899,
            prizeType: "FREE_PRODUCT",
            price: 0,
            quantity: 1,
            productId: bed?.id || null,
          },
          {
            rank: 2,
            name: "Runner Up: Ergonomic Executive Chair (Special $79 Winner Price)",
            description: "Normally $449. Selected winners receive the exclusive pass to purchase this high-end ergonomic chair for only $79!",
            images: ["https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80"],
            value: 449,
            prizeType: "PAID_PRODUCT",
            price: 79,
            quantity: 2,
            productId: chair?.id || null,
          },
          {
            rank: 3,
            name: "3rd Tier: Scandinavian Designer Table (100% FREE)",
            description: "Minimalist oak coffee table perfect for modern living rooms. Shipped free directly to the winner.",
            images: ["https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80"],
            value: 299,
            prizeType: "FREE_PRODUCT",
            price: 0,
            quantity: 3,
            productId: table?.id || null,
          },
        ],
      },
    },
  });

  const raffle2 = await db.raffle.create({
    data: {
      title: "VIP Members Exclusive Armchair Giveaway",
      slug: "vip-members-exclusive-armchair-giveaway",
      shortDescription: "Special appreciation giveaway for our active VIP Club members.",
      description: "Exclusive to our VIP Members! Win a premium Scandinavian lounge accent chair with complimentary home assembly.",
      bannerImage: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
      images: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80"],
      status: "ACTIVE",
      entryPrice: 0,
      isPaid: false,
      visibility: "MEMBERS_ONLY",
      maxEntriesPerUser: 1,
      minEntriesPerUser: 1,
      totalMaxEntries: 500,
      allowMultipleEntries: false,
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      drawDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      automaticClosure: true,
      isFeatured: false,
      displayOnHomepage: true,
      terms: "Exclusive to active Complete Home Sollution VIP members. 1 entry per member.",
      prizes: {
        create: [
          {
            rank: 1,
            name: "Premium Scandinavian Lounge Armchair (100% FREE)",
            description: "High-density foam cushion and solid oak wood frame. Shipped directly to your doorstep.",
            images: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80"],
            value: 599,
            prizeType: "FREE_PRODUCT",
            price: 0,
            quantity: 1,
          },
        ],
      },
    },
  });

  console.log("Seeded raffles successfully:", raffle1.id, raffle2.id);
}

seedRaffles()
  .catch(console.error)
  .finally(() => process.exit(0));

