import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    clerkId: text("clerk_id").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name"),
    username: text("username").unique(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // gamification
    points: integer("points").default(0).notNull(),
    longestStreak: integer("longest_streak").default(0).notNull(),
    currentStreak: integer("current_streak").default(0).notNull(),
    level: integer("level").default(1).notNull(),
    lastActive: timestamp("last_active"),
}, (table) => ({
    clerkIdIdx: uniqueIndex("clerk_id_idx").on(table.clerkId),
    emailIdx: uniqueIndex("email_idx").on(table.email),
    usernameIdx: uniqueIndex("username_idx").on(table.username),
}));
