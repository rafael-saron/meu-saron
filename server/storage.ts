import bcrypt from "bcryptjs";
import {
  users,
  chatMessages,
  scheduleEvents,
  announcements,
  anonymousMessages,
  salesGoals,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, count, gte, lte } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
