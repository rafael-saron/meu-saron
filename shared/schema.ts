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
  userId: varchar("user_id").references(() => users.id),
  storeId: text("store_id").notNull(),
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
  storeIds: text("store_ids").array().default(sql`ARRAY[]::text[]`),
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
  period: text("period").notNull().default("weekly"),
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

export const userStores = pgTable("user_stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  storeId: text("store_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleCode: text("sale_code").notNull(),
  saleDate: date("sale_date").notNull(),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull(),
  sellerName: text("seller_name").notNull(),
  clientName: text("client_name"),
  storeId: text("store_id").notNull(),
  status: text("status").notNull(),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: 'cascade' }),
  productCode: text("product_code").notNull(),
  productDescription: text("product_description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recebimentos de vendas - armazena o valor por método de pagamento
export const saleReceipts = pgTable("sale_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: 'cascade' }),
  paymentMethod: text("payment_method").notNull(), // pix, dinheiro, debito, credito, crediario
  grossValue: decimal("gross_value", { precision: 12, scale: 2 }).notNull(), // ValorBruto
  netValue: decimal("net_value", { precision: 12, scale: 2 }).notNull(), // Valor (líquido)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Metas de caixa - baseadas em percentual de vendas em meios específicos
export const cashierGoals = pgTable("cashier_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashierId: varchar("cashier_id").notNull().references(() => users.id),
  storeId: text("store_id").notNull(),
  periodType: text("period_type").notNull().default("weekly"), // weekly ou monthly
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  paymentMethods: text("payment_methods").array().notNull(), // Meios de pagamento: PIX, Débito, Dinheiro
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }).notNull(), // Meta de % das vendas nesses meios
  bonusPercentageAchieved: decimal("bonus_percentage_achieved", { precision: 5, scale: 2 }).notNull(),
  bonusPercentageNotAchieved: decimal("bonus_percentage_not_achieved", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contas a Pagar - armazenamento local de dados do Dapic
export const accountsPayable = pgTable("accounts_payable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dapicId: integer("dapic_id").notNull(),
  storeId: text("store_id").notNull(),
  document: text("document"),
  supplier: text("supplier"),
  description: text("description"),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  competenceDate: text("competence_date"),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  openValue: decimal("open_value", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method"),
  status: text("status").notNull(),
  accountPlan: text("account_plan"),
  paymentDate: date("payment_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contas a Receber - armazenamento local de dados do Dapic
export const accountsReceivable = pgTable("accounts_receivable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dapicId: integer("dapic_id").notNull(),
  storeId: text("store_id").notNull(),
  document: text("document"),
  client: text("client"),
  description: text("description"),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  competenceDate: text("competence_date"),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  openValue: decimal("open_value", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method"),
  status: text("status").notNull(),
  accountPlan: text("account_plan"),
  receivedDate: date("received_date"),
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
  userStores: many(userStores),
  cashierGoals: many(cashierGoals, { relationName: "cashierGoals" }),
  createdCashierGoals: many(cashierGoals, { relationName: "createdCashierGoals" }),
}));

export const userStoresRelations = relations(userStores, ({ one }) => ({
  user: one(users, {
    fields: [userStores.userId],
    references: [users.id],
  }),
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

export const salesRelations = relations(sales, ({ many }) => ({
  items: many(saleItems),
  receipts: many(saleReceipts),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
}));

export const saleReceiptsRelations = relations(saleReceipts, ({ one }) => ({
  sale: one(sales, {
    fields: [saleReceipts.saleId],
    references: [sales.id],
  }),
}));

export const cashierGoalsRelations = relations(cashierGoals, ({ one }) => ({
  cashier: one(users, {
    fields: [cashierGoals.cashierId],
    references: [users.id],
    relationName: "cashierGoals",
  }),
  createdBy: one(users, {
    fields: [cashierGoals.createdById],
    references: [users.id],
    relationName: "createdCashierGoals",
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(6),
  storeId: z.enum(["saron1", "saron2", "saron3"]).nullable().optional(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEvents, {
  startTime: z.string().or(z.date()).transform((val) => typeof val === 'string' ? new Date(val) : val),
  endTime: z.string().or(z.date()).transform((val) => typeof val === 'string' ? new Date(val) : val),
}).omit({
  id: true,
  createdAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  storeIds: z.array(z.enum(["saron1", "saron2", "saron3"])).optional().default([]),
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
  period: z.enum(["weekly", "monthly"]).default("weekly"),
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  targetValue: z.string().or(z.number()).transform((val) => String(val)),
});

export const insertUserStoreSchema = createInsertSchema(userStores).omit({
  id: true,
  createdAt: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  totalValue: z.string().or(z.number()).transform((val) => String(val)),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
  createdAt: true,
}).extend({
  quantity: z.string().or(z.number()).transform((val) => String(val)),
  unitPrice: z.string().or(z.number()).transform((val) => String(val)),
  totalPrice: z.string().or(z.number()).transform((val) => String(val)),
});

export const insertSaleReceiptSchema = createInsertSchema(saleReceipts).omit({
  id: true,
  createdAt: true,
}).extend({
  grossValue: z.string().or(z.number()).transform((val) => String(val)),
  netValue: z.string().or(z.number()).transform((val) => String(val)),
});

export const insertCashierGoalSchema = createInsertSchema(cashierGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  periodType: z.enum(["weekly", "monthly"]).default("weekly"),
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  paymentMethods: z.array(z.string()).min(1, "Selecione pelo menos um meio de pagamento"),
  targetPercentage: z.string().or(z.number()).transform((val) => String(val)),
  bonusPercentageAchieved: z.string().or(z.number()).transform((val) => String(val)),
  bonusPercentageNotAchieved: z.string().or(z.number()).transform((val) => String(val)),
});

export const insertAccountPayableSchema = createInsertSchema(accountsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  value: z.string().or(z.number()).transform((val) => String(val)),
  openValue: z.string().or(z.number()).transform((val) => String(val)).nullable().optional(),
});

export const insertAccountReceivableSchema = createInsertSchema(accountsReceivable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  storeId: z.enum(["saron1", "saron2", "saron3"]),
  value: z.string().or(z.number()).transform((val) => String(val)),
  openValue: z.string().or(z.number()).transform((val) => String(val)).nullable().optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserStore = typeof userStores.$inferSelect;
export type InsertUserStore = z.infer<typeof insertUserStoreSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleReceipt = typeof saleReceipts.$inferSelect;
export type InsertSaleReceipt = z.infer<typeof insertSaleReceiptSchema>;
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
export type CashierGoal = typeof cashierGoals.$inferSelect;
export type InsertCashierGoal = z.infer<typeof insertCashierGoalSchema>;
export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = z.infer<typeof insertAccountPayableSchema>;
export type AccountReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountReceivable = z.infer<typeof insertAccountReceivableSchema>;

export type UserRole = "administrador" | "gerente" | "vendedor" | "financeiro" | "caixa";
export type ScheduleEventType = "normal" | "extra";
export type AnnouncementPriority = "normal" | "important" | "urgent";
export type GoalType = "individual" | "team";
export type StoreId = "saron1" | "saron2" | "saron3";
