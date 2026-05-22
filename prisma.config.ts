import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load both .env and .env.local (local takes precedence)
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
