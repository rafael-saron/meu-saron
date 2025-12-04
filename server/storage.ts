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
import { eq, and, or, desc, count, gte, lte, sql } from "drizzle-orm";

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
  
  getScheduleEvents(userId?: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
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

  async getScheduleEvents(userId?: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    let query = db.select().from(scheduleEvents);

    if (userId) {
      query = query.where(eq(scheduleEvents.userId, userId)) as any;
    }

    return await query.orderBy(scheduleEvents.startTime);
  }

  async createScheduleEvent(insertEvent: InsertScheduleEvent): Promise<ScheduleEvent> {
    const [event] = await db.insert(scheduleEvents).values(insertEvent).returning();
    return event;
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
}

export const storage = new DatabaseStorage();
