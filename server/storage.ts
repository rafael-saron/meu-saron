import bcrypt from "bcryptjs";
import {
  users,
  chatMessages,
  scheduleEvents,
  announcements,
  anonymousMessages,
  salesGoals,
  userStores,
  sales,
  saleItems,
  saleReceipts,
  cashierGoals,
  type User,
  type InsertUser,
  type ChatMessage,
  type InsertChatMessage,
  type ScheduleEvent,
  type InsertScheduleEvent,
  type Announcement,
  type InsertAnnouncement,
  type AnonymousMessage,
  type InsertAnonymousMessage,
  type SalesGoal,
  type InsertSalesGoal,
  type UserStore,
  type InsertUserStore,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type SaleReceipt,
  type InsertSaleReceipt,
  type CashierGoal,
  type InsertCashierGoal,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, count, gte, lte, sql, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  getChatMessages(userId1: string, userId2: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  markMessagesAsRead(senderId: string, receiverId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  getConversations(userId: string): Promise<{ partnerId: string; lastMessageAt: Date; unreadCount: number; lastMessage: string }[]>;
  
  getScheduleEvents(storeId?: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  getScheduleEvent(id: string): Promise<ScheduleEvent | undefined>;
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
  updateScheduleEvent(id: string, event: Partial<ScheduleEvent>): Promise<ScheduleEvent | undefined>;
  deleteScheduleEvent(id: string): Promise<void>;
  
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, announcement: Partial<Announcement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<void>;
  
  getAnonymousMessages(): Promise<AnonymousMessage[]>;
  createAnonymousMessage(message: InsertAnonymousMessage): Promise<AnonymousMessage>;
  markAnonymousMessageAsRead(id: string): Promise<void>;
  
  getSalesGoals(filters?: {
    id?: string;
    storeId?: string;
    sellerId?: string;
    weekStart?: string;
    weekEnd?: string;
    type?: "individual" | "team";
    isActive?: boolean;
  }): Promise<SalesGoal[]>;
  createSalesGoal(goal: InsertSalesGoal): Promise<SalesGoal>;
  updateSalesGoal(id: string, goal: Partial<SalesGoal>): Promise<SalesGoal | undefined>;
  deleteSalesGoal(id: string): Promise<void>;
  
  getUserStores(userId: string): Promise<UserStore[]>;
  setUserStores(userId: string, storeIds: string[]): Promise<void>;
  
  saleExists(saleCode: string, storeId: string): Promise<boolean>;
  createSale(sale: InsertSale): Promise<Sale>;
  createSaleItem(item: InsertSaleItem): Promise<SaleItem>;
  createSaleReceipt(receipt: InsertSaleReceipt): Promise<SaleReceipt>;
  createSaleWithItemsAndReceipts(sale: InsertSale, items: InsertSaleItem[], receipts: InsertSaleReceipt[]): Promise<Sale>;
  createSaleWithItems(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  getReceiptsByPaymentMethod(storeId: string, startDate: string, endDate: string, paymentMethods: string[]): Promise<{ paymentMethod: string; totalGross: number; totalNet: number }[]>;
  getSales(filters?: {
    storeId?: string;
    sellerName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Sale[]>;
  getSalesWithItems(filters?: {
    storeId?: string;
    sellerName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<(Sale & { items: SaleItem[] })[]>;
  deleteSalesByPeriod(storeId: string, startDate: string, endDate: string): Promise<void>;
  
  getCashierGoals(filters?: {
    id?: string;
    cashierId?: string;
    storeId?: string;
    isActive?: boolean;
  }): Promise<CashierGoal[]>;
  createCashierGoal(goal: InsertCashierGoal): Promise<CashierGoal>;
  updateCashierGoal(id: string, goal: Partial<CashierGoal>): Promise<CashierGoal | undefined>;
  deleteCashierGoal(id: string): Promise<void>;
  
  getDailyRevenueComparison(filters: {
    storeId?: string;
    month: number;
    year: number;
    compareYears?: number[];
  }): Promise<{
    year: number;
    daily: { date: string; day: number; totalValue: number }[];
    total: number;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword,
    }).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { ...userData };
    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.update(users).set({ isActive: false }).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async getChatMessages(userId1: string, userId2: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.senderId, userId1), eq(chatMessages.receiverId, userId2)),
          and(eq(chatMessages.senderId, userId2), eq(chatMessages.receiverId, userId1))
        )
      )
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
    await db
      .update(chatMessages)
      .set({ isRead: true })
      .where(and(eq(chatMessages.senderId, senderId), eq(chatMessages.receiverId, receiverId)));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(chatMessages)
      .where(and(eq(chatMessages.receiverId, userId), eq(chatMessages.isRead, false)));
    
    return Number(result[0]?.count) || 0;
  }

  async getConversations(userId: string): Promise<{ partnerId: string; lastMessageAt: Date; unreadCount: number; lastMessage: string }[]> {
    // Get all messages involving this user
    const allMessages = await db
      .select()
      .from(chatMessages)
      .where(
        or(
          eq(chatMessages.senderId, userId),
          eq(chatMessages.receiverId, userId)
        )
      )
      .orderBy(desc(chatMessages.createdAt));

    // Group by conversation partner
    const conversationMap = new Map<string, { lastMessageAt: Date; unreadCount: number; lastMessage: string }>();
    
    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
          lastMessage: msg.content,
        });
      }
      
      // Count unread messages (messages sent to this user that are not read)
      if (msg.receiverId === userId && !msg.isRead) {
        const conv = conversationMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }
    
    // Convert to array and sort by lastMessageAt descending
    return Array.from(conversationMap.entries())
      .map(([partnerId, data]) => ({ partnerId, ...data }))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getScheduleEvents(storeId?: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    const conditions = [];
    
    if (storeId) {
      conditions.push(eq(scheduleEvents.storeId, storeId));
    }
    
    if (startDate) {
      conditions.push(gte(scheduleEvents.startTime, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(scheduleEvents.endTime, endDate));
    }

    if (conditions.length > 0) {
      return await db.select().from(scheduleEvents)
        .where(and(...conditions))
        .orderBy(scheduleEvents.startTime);
    }

    return await db.select().from(scheduleEvents).orderBy(scheduleEvents.startTime);
  }

  async getScheduleEvent(id: string): Promise<ScheduleEvent | undefined> {
    const [event] = await db.select().from(scheduleEvents).where(eq(scheduleEvents.id, id));
    return event || undefined;
  }

  async createScheduleEvent(insertEvent: InsertScheduleEvent): Promise<ScheduleEvent> {
    const [event] = await db.insert(scheduleEvents).values(insertEvent).returning();
    return event;
  }

  async updateScheduleEvent(id: string, updateData: Partial<ScheduleEvent>): Promise<ScheduleEvent | undefined> {
    const [event] = await db
      .update(scheduleEvents)
      .set(updateData)
      .where(eq(scheduleEvents.id, id))
      .returning();
    return event || undefined;
  }

  async deleteScheduleEvent(id: string): Promise<void> {
    await db.delete(scheduleEvents).where(eq(scheduleEvents.id, id));
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(insertAnnouncement: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values(insertAnnouncement).returning();
    return announcement;
  }

  async updateAnnouncement(id: string, updateData: Partial<Announcement>): Promise<Announcement | undefined> {
    const [announcement] = await db
      .update(announcements)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return announcement || undefined;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getAnonymousMessages(): Promise<AnonymousMessage[]> {
    return await db.select().from(anonymousMessages).orderBy(desc(anonymousMessages.createdAt));
  }

  async createAnonymousMessage(insertMessage: InsertAnonymousMessage): Promise<AnonymousMessage> {
    const [message] = await db.insert(anonymousMessages).values(insertMessage).returning();
    return message;
  }

  async markAnonymousMessageAsRead(id: string): Promise<void> {
    await db
      .update(anonymousMessages)
      .set({ isRead: true })
      .where(eq(anonymousMessages.id, id));
  }

  async getSalesGoals(filters?: {
    id?: string;
    storeId?: string;
    sellerId?: string;
    weekStart?: string;
    weekEnd?: string;
    type?: "individual" | "team";
    isActive?: boolean;
  }): Promise<SalesGoal[]> {
    let query = db.select().from(salesGoals);
    const conditions = [];

    if (filters?.id) {
      conditions.push(eq(salesGoals.id, filters.id));
    }
    if (filters?.storeId) {
      conditions.push(eq(salesGoals.storeId, filters.storeId));
    }
    if (filters?.sellerId) {
      conditions.push(eq(salesGoals.sellerId, filters.sellerId));
    }
    if (filters?.weekStart) {
      conditions.push(gte(salesGoals.weekStart, filters.weekStart));
    }
    if (filters?.weekEnd) {
      conditions.push(lte(salesGoals.weekEnd, filters.weekEnd));
    }
    if (filters?.type) {
      conditions.push(eq(salesGoals.type, filters.type));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(salesGoals.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(salesGoals.createdAt));
  }

  async createSalesGoal(insertGoal: InsertSalesGoal): Promise<SalesGoal> {
    const [goal] = await db.insert(salesGoals).values(insertGoal).returning();
    return goal;
  }

  async updateSalesGoal(id: string, updateData: Partial<SalesGoal>): Promise<SalesGoal | undefined> {
    const [goal] = await db
      .update(salesGoals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(salesGoals.id, id))
      .returning();
    return goal || undefined;
  }

  async deleteSalesGoal(id: string): Promise<void> {
    await db.delete(salesGoals).where(eq(salesGoals.id, id));
  }

  async checkOverlappingGoals(params: {
    storeId: string;
    sellerId: string | null;
    type: "individual" | "team";
    period: "weekly" | "monthly";
    weekStart: string;
    weekEnd: string;
    excludeId?: string;
  }): Promise<SalesGoal[]> {
    const conditions = [
      eq(salesGoals.storeId, params.storeId),
      eq(salesGoals.type, params.type),
      eq(salesGoals.period, params.period),
      eq(salesGoals.isActive, true),
      or(
        and(
          lte(salesGoals.weekStart, params.weekStart),
          gte(salesGoals.weekEnd, params.weekStart)
        ),
        and(
          lte(salesGoals.weekStart, params.weekEnd),
          gte(salesGoals.weekEnd, params.weekEnd)
        ),
        and(
          gte(salesGoals.weekStart, params.weekStart),
          lte(salesGoals.weekEnd, params.weekEnd)
        )
      )
    ];

    if (params.type === "individual" && params.sellerId) {
      conditions.push(eq(salesGoals.sellerId, params.sellerId));
    } else if (params.type === "team") {
      conditions.push(isNull(salesGoals.sellerId));
    }

    if (params.excludeId) {
      conditions.push(sql`${salesGoals.id} != ${params.excludeId}`);
    }

    return await db.select().from(salesGoals).where(and(...conditions));
  }
  
  async getUserStores(userId: string): Promise<UserStore[]> {
    return await db.select().from(userStores).where(eq(userStores.userId, userId));
  }
  
  async setUserStores(userId: string, storeIds: string[]): Promise<void> {
    await db.delete(userStores).where(eq(userStores.userId, userId));
    
    if (storeIds.length > 0) {
      const values = storeIds.map(storeId => ({
        userId,
        storeId,
      }));
      await db.insert(userStores).values(values);
    }
  }
  
  async saleExists(saleCode: string, storeId: string): Promise<boolean> {
    const [existing] = await db.select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.saleCode, saleCode), eq(sales.storeId, storeId)))
      .limit(1);
    return !!existing;
  }
  
  async createSale(insertSale: InsertSale): Promise<Sale> {
    const [sale] = await db.insert(sales).values(insertSale).returning();
    return sale;
  }
  
  async createSaleItem(insertItem: InsertSaleItem): Promise<SaleItem> {
    const [item] = await db.insert(saleItems).values(insertItem).returning();
    return item;
  }
  
  async createSaleReceipt(insertReceipt: InsertSaleReceipt): Promise<SaleReceipt> {
    const [receipt] = await db.insert(saleReceipts).values(insertReceipt).returning();
    return receipt;
  }
  
  async createSaleWithItemsAndReceipts(insertSale: InsertSale, insertItems: InsertSaleItem[], insertReceipts: InsertSaleReceipt[]): Promise<Sale> {
    return await db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values(insertSale).returning();
      
      if (insertItems.length > 0) {
        const itemsWithSaleId = insertItems.map(item => ({
          ...item,
          saleId: sale.id,
        }));
        await tx.insert(saleItems).values(itemsWithSaleId);
      }
      
      if (insertReceipts.length > 0) {
        const receiptsWithSaleId = insertReceipts.map(receipt => ({
          ...receipt,
          saleId: sale.id,
        }));
        await tx.insert(saleReceipts).values(receiptsWithSaleId);
      }
      
      return sale;
    });
  }
  
  async createSaleWithItems(insertSale: InsertSale, insertItems: InsertSaleItem[]): Promise<Sale> {
    return await db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values(insertSale).returning();
      
      if (insertItems.length > 0) {
        const itemsWithSaleId = insertItems.map(item => ({
          ...item,
          saleId: sale.id,
        }));
        await tx.insert(saleItems).values(itemsWithSaleId);
      }
      
      return sale;
    });
  }
  
  async getReceiptsByPaymentMethod(storeId: string, startDate: string, endDate: string, paymentMethods: string[]): Promise<{ paymentMethod: string; totalGross: number; totalNet: number }[]> {
    // Get all receipts for the period that match any of the payment methods
    const receipts = await db
      .select({
        paymentMethod: saleReceipts.paymentMethod,
        grossValue: saleReceipts.grossValue,
        netValue: saleReceipts.netValue,
      })
      .from(saleReceipts)
      .innerJoin(sales, eq(saleReceipts.saleId, sales.id))
      .where(
        and(
          eq(sales.storeId, storeId),
          gte(sales.saleDate, startDate),
          lte(sales.saleDate, endDate)
        )
      );
    
    // Group by payment method and sum values
    const methodTotals: Record<string, { totalGross: number; totalNet: number }> = {};
    
    for (const receipt of receipts) {
      const method = receipt.paymentMethod.toLowerCase();
      // Check if this method matches any of the target methods
      for (const targetMethod of paymentMethods) {
        if (method.includes(targetMethod.toLowerCase())) {
          if (!methodTotals[targetMethod]) {
            methodTotals[targetMethod] = { totalGross: 0, totalNet: 0 };
          }
          methodTotals[targetMethod].totalGross += parseFloat(receipt.grossValue);
          methodTotals[targetMethod].totalNet += parseFloat(receipt.netValue);
          break; // Only count once per receipt
        }
      }
    }
    
    return Object.entries(methodTotals).map(([paymentMethod, totals]) => ({
      paymentMethod,
      ...totals,
    }));
  }
  
  async getSales(filters?: {
    storeId?: string;
    sellerName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Sale[]> {
    let query = db.select().from(sales);
    const conditions = [];
    
    if (filters?.storeId && filters.storeId !== 'todas') {
      conditions.push(eq(sales.storeId, filters.storeId));
    }
    if (filters?.sellerName) {
      const normalizedName = filters.sellerName.toLowerCase().trim();
      conditions.push(sql`LOWER(TRIM(${sales.sellerName})) = ${normalizedName}`);
    }
    if (filters?.startDate) {
      conditions.push(gte(sales.saleDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(sales.saleDate, filters.endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(sales.saleDate));
  }
  
  async getSalesWithItems(filters?: {
    storeId?: string;
    sellerName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<(Sale & { items: SaleItem[] })[]> {
    const salesList = await this.getSales(filters);
    
    const salesWithItems = await Promise.all(
      salesList.map(async (sale) => {
        const items = await db
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, sale.id));
        return { ...sale, items };
      })
    );
    
    return salesWithItems;
  }
  
  async deleteSalesByPeriod(storeId: string, startDate: string, endDate: string): Promise<void> {
    await db.delete(sales).where(
      and(
        eq(sales.storeId, storeId),
        gte(sales.saleDate, startDate),
        lte(sales.saleDate, endDate)
      )
    );
  }
  
  async getCashierGoals(filters?: {
    id?: string;
    cashierId?: string;
    storeId?: string;
    isActive?: boolean;
  }): Promise<CashierGoal[]> {
    let query = db.select().from(cashierGoals);
    const conditions = [];
    
    if (filters?.id) {
      conditions.push(eq(cashierGoals.id, filters.id));
    }
    if (filters?.cashierId) {
      conditions.push(eq(cashierGoals.cashierId, filters.cashierId));
    }
    if (filters?.storeId) {
      conditions.push(eq(cashierGoals.storeId, filters.storeId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(cashierGoals.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(cashierGoals.createdAt));
  }
  
  async createCashierGoal(goal: InsertCashierGoal): Promise<CashierGoal> {
    const [created] = await db.insert(cashierGoals).values(goal).returning();
    return created;
  }
  
  async updateCashierGoal(id: string, goal: Partial<CashierGoal>): Promise<CashierGoal | undefined> {
    const [updated] = await db
      .update(cashierGoals)
      .set({ ...goal, updatedAt: new Date() })
      .where(eq(cashierGoals.id, id))
      .returning();
    return updated;
  }
  
  async deleteCashierGoal(id: string): Promise<void> {
    await db.delete(cashierGoals).where(eq(cashierGoals.id, id));
  }
  
  async getDailyRevenueComparison(filters: {
    storeId?: string;
    month: number;
    year: number;
    compareYears?: number[];
  }): Promise<{
    year: number;
    daily: { date: string; day: number; totalValue: number }[];
    total: number;
  }[]> {
    const { storeId, month, year, compareYears = [] } = filters;
    const yearsToQuery = [year, ...compareYears].sort((a, b) => b - a);
    const results: {
      year: number;
      daily: { date: string; day: number; totalValue: number }[];
      total: number;
    }[] = [];

    for (const queryYear of yearsToQuery) {
      const startDate = `${queryYear}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(queryYear, month, 0).getDate();
      const endDate = `${queryYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const conditions = [
        gte(sales.saleDate, startDate),
        lte(sales.saleDate, endDate),
      ];

      if (storeId && storeId !== 'todas') {
        conditions.push(eq(sales.storeId, storeId));
      }

      const dailySales = await db
        .select({
          date: sales.saleDate,
          totalValue: sql<string>`SUM(CAST(${sales.totalValue} AS NUMERIC))`,
        })
        .from(sales)
        .where(and(...conditions))
        .groupBy(sales.saleDate)
        .orderBy(sales.saleDate);

      const dailyData = dailySales.map(row => ({
        date: row.date,
        day: parseInt(row.date.split('-')[2]),
        totalValue: parseFloat(row.totalValue) || 0,
      }));

      const total = dailyData.reduce((sum, d) => sum + d.totalValue, 0);

      results.push({
        year: queryYear,
        daily: dailyData,
        total,
      });
    }

    return results;
  }
}

export const storage = new DatabaseStorage();
