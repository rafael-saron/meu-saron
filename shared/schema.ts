import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("vendedor"),
  storeId: text("store_id"),
  avatar: text("avatar"),
  bonusPercentageAchieved: decimal("bonus_percentage_achieved", { precision: 5, scale: 2 }),
  bonusPercentageNotAchieved: decimal("bonus_percentage_not_achieved", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduleEvents = pgTable("schedule_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  type: text("type").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  description: text("description"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("normal"),
  authorId: varchar("author_id").notNull().references(() => users.id),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const anonymousMessages = pgTable("anonymous_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const salesGoals = pgTable("sales_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  storeId: text("store_id").notNull(),
  sellerId: varchar("seller_id").references(() => users.id),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  targetValue: decimal("target_value", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sentMessages: many(chatMessages, { relationName: "sentMessages" }),
  receivedMessages: many(chatMessages, { relationName: "receivedMessages" }),
  scheduleEvents: many(scheduleEvents, { relationName: "userSchedule" }),
  createdEvents: many(scheduleEvents, { relationName: "createdEvents" }),
  announcements: many(announcements),
  anonymousMessages: many(anonymousMessages),
  salesGoals: many(salesGoals, { relationName: "sellerGoals" }),
  createdGoals: many(salesGoals, { relationName: "createdGoals" }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  receiver: one(users, {
    fields: [chatMessages.receiverId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
}));

export const scheduleEventsRelations = relations(scheduleEvents, ({ one }) => ({
  user: one(users, {
    fields: [scheduleEvents.userId],
    references: [users.id],
    relationName: "userSchedule",
  }),
  createdBy: one(users, {
    fields: [scheduleEvents.createdById],
    references: [users.id],
    relationName: "createdEvents",
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const anonymousMessagesRelations = relations(anonymousMessages, ({ one }) => ({
  sender: one(users, {
    fields: [anonymousMessages.senderId],
    references: [users.id],
  }),
}));

export const salesGoalsRelations = relations(salesGoals, ({ one }) => ({
  seller: one(users, {
    fields: [salesGoals.sellerId],
    references: [users.id],
    relationName: "sellerGoals",
  }),
  createdBy: one(users, {
    fields: [salesGoals.createdById],
    references: [users.id],
    relationName: "createdGoals",
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(6),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEvents).omit({
  id: true,
  createdAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnonymousMessageSchema = createInsertSchema(anonymousMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertSalesGoalSchema = createInsertSchema(salesGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(["individual", "team"]),
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  targetValue: z.string().or(z.number()).transform((val) => String(val)),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnonymousMessage = typeof anonymousMessages.$inferSelect;
export type InsertAnonymousMessage = z.infer<typeof insertAnonymousMessageSchema>;
export type SalesGoal = typeof salesGoals.$inferSelect;
export type InsertSalesGoal = z.infer<typeof insertSalesGoalSchema>;

export type UserRole = "administrador" | "gerente" | "vendedor" | "financeiro";
export type ScheduleEventType = "normal" | "extra";
export type AnnouncementPriority = "normal" | "important" | "urgent";
export type GoalType = "individual" | "team";
export type StoreId = "saron1" | "saron2" | "saron3";
