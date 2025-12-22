import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { dapicService } from "./dapic";
import { salesSyncService } from "./salesSync";
import { salesPatternService } from "./salesPatternService";
import {
  insertChatMessageSchema,
  insertScheduleEventSchema,
  insertAnnouncementSchema,
  insertAnonymousMessageSchema,
  insertUserSchema,
  insertSalesGoalSchema,
  insertCashierGoalSchema,
} from "@shared/schema";

interface WebSocketMessage {
  type: "chat" | "announcement" | "schedule";
  data: any;
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    const userId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('userId');
    
    if (userId) {
      clients.set(userId, ws);
    }

    ws.on('message', async (rawMessage) => {
      try {
        const message: WebSocketMessage = JSON.parse(rawMessage.toString());

        if (message.type === 'chat' && message.data.receiverId) {
          const receiverWs = clients.get(message.data.receiverId);
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify(message));
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      });

      const { username, password } = loginSchema.parse(req.body);
      
      // Try to find user by username first, then by email
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.getUserByEmail(username);
      }
      
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
        avatar: user.avatar,
        isActive: user.isActive,
      };

      req.session.userId = user.id;
      
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(400).json({ 
        error: "Erro ao fazer login",
        message: error.message 
      });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
        avatar: user.avatar,
        isActive: user.isActive,
      };

      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Error fetching current user:', error);
      res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sortedUsers = allUsers.sort((a, b) => 
        (a.fullName || '').localeCompare(b.fullName || '', 'pt-BR')
      );
      res.json(sortedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const createSchema = insertUserSchema.extend({
        storeId: z.enum(['saron1', 'saron2', 'saron3']).nullable().optional(),
        bonusPercentageAchieved: z.coerce.number().min(0).max(100).nullable().optional(),
        bonusPercentageNotAchieved: z.coerce.number().min(0).max(100).nullable().optional(),
      });
      
      const parsedData = createSchema.parse(req.body);
      
      // Convert bonus percentages to strings for storage
      const dataForStorage: any = { ...parsedData };
      if (parsedData.bonusPercentageAchieved !== null && parsedData.bonusPercentageAchieved !== undefined) {
        dataForStorage.bonusPercentageAchieved = parsedData.bonusPercentageAchieved.toFixed(2);
      }
      if (parsedData.bonusPercentageNotAchieved !== null && parsedData.bonusPercentageNotAchieved !== undefined) {
        dataForStorage.bonusPercentageNotAchieved = parsedData.bonusPercentageNotAchieved.toFixed(2);
      }
      
      const newUser = await storage.createUser(dataForStorage);
      res.json(newUser);
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(400).json({ 
        error: "Invalid user data",
        message: error.message 
      });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updateSchema = z.object({
        fullName: z.string().min(3).optional(),
        email: z.string().email().optional(),
        role: z.enum(['administrador', 'gerente', 'vendedor', 'financeiro']).optional(),
        storeId: z.enum(['saron1', 'saron2', 'saron3']).nullable().optional(),
        password: z.string().min(6).optional(),
        avatar: z.string().nullable().optional(),
        bonusPercentageAchieved: z.coerce.number().min(0).max(100).nullable().optional(),
        bonusPercentageNotAchieved: z.coerce.number().min(0).max(100).nullable().optional(),
      });
      
      const parsedData = updateSchema.parse(req.body);
      
      if (Object.keys(parsedData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      // Convert bonus percentages to strings for storage
      const dataForStorage: Record<string, any> = { ...parsedData };
      if (parsedData.bonusPercentageAchieved !== null && parsedData.bonusPercentageAchieved !== undefined) {
        dataForStorage.bonusPercentageAchieved = parsedData.bonusPercentageAchieved.toFixed(2);
      }
      if (parsedData.bonusPercentageNotAchieved !== null && parsedData.bonusPercentageNotAchieved !== undefined) {
        dataForStorage.bonusPercentageNotAchieved = parsedData.bonusPercentageNotAchieved.toFixed(2);
      }
      
      const updatedUser = await storage.updateUser(id, dataForStorage as any);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error updating user:', error);
      res.status(400).json({ 
        error: "Failed to update user",
        message: error.message 
      });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(400).json({ 
        error: "Failed to delete user",
        message: error.message 
      });
    }
  });
  
  app.get("/api/users/:id/stores", async (req, res) => {
    try {
      const { id } = req.params;
      const stores = await storage.getUserStores(id);
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get user stores", message: error.message });
    }
  });
  
  app.put("/api/users/:id/stores", async (req, res) => {
    try {
      const { id } = req.params;
      const { storeIds } = req.body;
      
      if (!Array.isArray(storeIds)) {
        return res.status(400).json({ error: "storeIds must be an array" });
      }
      
      await storage.setUserStores(id, storeIds);
      const updatedStores = await storage.getUserStores(id);
      res.json(updatedStores);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set user stores", message: error.message });
    }
  });

  app.patch("/api/users/:id/password", async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!req.session?.userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (req.session.userId !== id) {
        return res.status(403).json({ error: "Não autorizado" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Senha atual incorreta" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(id, { password: hashedPassword });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: "Erro ao atualizar senha" });
    }
  });

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const userId = req.params.id;
      const userDir = path.join(uploadDir, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'));
      }
    }
  });

  app.post("/api/users/:id/avatar", uploadAvatar.single('avatar'), async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.session?.userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (req.session.userId !== id) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ error: "Não autorizado" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const avatarUrl = `/uploads/avatars/${id}/${req.file.filename}`;
      const updatedUser = await storage.updateUser(id, { avatar: avatarUrl });
      
      if (!updatedUser) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      res.json({ avatar: avatarUrl });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Erro ao fazer upload do avatar" });
    }
  });

  app.get("/api/chat/conversations/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const allUsers = await storage.getAllUsers();
      const conversations = await storage.getConversations(userId);
      const totalUnread = await storage.getUnreadCount(userId);
      
      // Create a map of partnerId -> conversation data
      const conversationMap = new Map(conversations.map(c => [c.partnerId, c]));
      
      // Create a map of userId -> user for active users
      const activeUserMap = new Map(allUsers.map(u => [u.id, u]));
      
      // Start with active users (excluding self)
      const usersWithConversations = allUsers
        .filter(u => u.id !== userId)
        .map(user => ({
          ...user,
          lastMessageAt: conversationMap.get(user.id)?.lastMessageAt || null,
          unreadCount: conversationMap.get(user.id)?.unreadCount || 0,
          lastMessage: conversationMap.get(user.id)?.lastMessage || null,
        }));
      
      // Add inactive users who have conversations (especially with unread messages)
      for (const conv of conversations) {
        if (!activeUserMap.has(conv.partnerId) && conv.partnerId !== userId) {
          // This is an inactive user with message history - fetch their info
          const inactiveUser = await storage.getUser(conv.partnerId);
          if (inactiveUser) {
            usersWithConversations.push({
              ...inactiveUser,
              lastMessageAt: conv.lastMessageAt,
              unreadCount: conv.unreadCount,
              lastMessage: conv.lastMessage,
            });
          }
        }
      }
      
      // Sort: users with messages come first by last message date, then alphabetically
      usersWithConversations.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
      
      res.json({ users: usersWithConversations, unreadCount: totalUnread });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/chat/messages/:userId1/:userId2", async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const messages = await storage.getChatMessages(userId1, userId2);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/chat/unread-count/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const count = await storage.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.post("/api/chat/mark-as-read", async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;
      if (!senderId || !receiverId) {
        return res.status(400).json({ error: "senderId and receiverId are required" });
      }
      await storage.markMessagesAsRead(senderId, receiverId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  const sendChatMessageHandler = async (req: any, res: any) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      const newMessage = await storage.createChatMessage(validatedData);
      
      const receiverWs = clients.get(validatedData.receiverId);
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
        receiverWs.send(JSON.stringify({
          type: 'chat',
          data: newMessage,
        }));
      }
      
      const senderWs = clients.get(validatedData.senderId);
      if (senderWs && senderWs.readyState === WebSocket.OPEN) {
        senderWs.send(JSON.stringify({
          type: 'chat',
          data: newMessage,
        }));
      }
      
      res.json(newMessage);
    } catch (error: any) {
      console.error('Error creating chat message:', error);
      res.status(400).json({ 
        error: "Invalid message data",
        message: error.message 
      });
    }
  };

  app.post("/api/chat/messages", sendChatMessageHandler);
  app.post("/api/chat/send", sendChatMessageHandler);

  app.get("/api/schedule", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { startDate, endDate, storeId } = req.query;
      
      // Admins can view any store, others can only view their own store
      let effectiveStoreId: string | undefined;
      if (user.role === 'administrador' && storeId) {
        effectiveStoreId = storeId as string;
      } else {
        effectiveStoreId = user.storeId || undefined;
      }
      
      const events = await storage.getScheduleEvents(
        effectiveStoreId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule events" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const currentUser = await storage.getUser(sessionUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      console.log('[Schedule] Creating event with data:', JSON.stringify(req.body, null, 2));
      
      // Validate storeId: admins can create for any store, others only for their store
      const requestedStoreId = req.body.storeId;
      let effectiveStoreId: string;
      
      if (currentUser.role === 'administrador' && requestedStoreId) {
        effectiveStoreId = requestedStoreId;
      } else if (currentUser.role === 'gerente' && requestedStoreId === currentUser.storeId && currentUser.storeId) {
        effectiveStoreId = currentUser.storeId;
      } else if (currentUser.storeId) {
        effectiveStoreId = currentUser.storeId;
      } else {
        return res.status(400).json({ error: "User has no store assigned" });
      }
      
      const eventData = { ...req.body, storeId: effectiveStoreId };
      const validatedData = insertScheduleEventSchema.parse(eventData);
      const newEvent = await storage.createScheduleEvent(validatedData);
      
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'schedule',
            data: newEvent,
          }));
        }
      });
      
      res.json(newEvent);
    } catch (error: any) {
      console.error('[Schedule] Error creating event:', error);
      res.status(400).json({ error: "Invalid event data", details: error.message || String(error) });
    }
  });

  app.get("/api/schedule/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getScheduleEvent(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.patch("/api/schedule/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUserId = req.session.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const currentUser = await storage.getUser(sessionUserId);
      if (!currentUser || (currentUser.role !== 'administrador' && currentUser.role !== 'gerente')) {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      // Process the update data - convert date/time strings to Date objects
      const { date, startTime: startTimeStr, endTime: endTimeStr, ...rest } = req.body;
      const updateData: any = { ...rest };
      
      // If date and time strings are provided, convert to Date objects
      if (date && startTimeStr) {
        updateData.startTime = new Date(`${date}T${startTimeStr}:00`);
      }
      if (date && endTimeStr) {
        updateData.endTime = new Date(`${date}T${endTimeStr}:00`);
      }
      // If startTime/endTime are already ISO strings (from direct Date objects)
      if (req.body.startTime && typeof req.body.startTime === 'string' && req.body.startTime.includes('T')) {
        updateData.startTime = new Date(req.body.startTime);
      }
      if (req.body.endTime && typeof req.body.endTime === 'string' && req.body.endTime.includes('T')) {
        updateData.endTime = new Date(req.body.endTime);
      }
      
      const updated = await storage.updateScheduleEvent(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error('[Schedule] Error updating event:', error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteScheduleEvent(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.get("/api/announcements", async (req, res) => {
    try {
      const allAnnouncements = await storage.getAnnouncements();
      res.json(allAnnouncements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const validatedData = insertAnnouncementSchema.parse(req.body);
      const newAnnouncement = await storage.createAnnouncement(validatedData);
      
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'announcement',
            data: newAnnouncement,
          }));
        }
      });
      
      res.json(newAnnouncement);
    } catch (error) {
      res.status(400).json({ error: "Invalid announcement data" });
    }
  });

  app.patch("/api/announcements/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateAnnouncement(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAnnouncement(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  app.get("/api/anonymous-messages", async (req, res) => {
    try {
      const allMessages = await storage.getAnonymousMessages();
      res.json(allMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch anonymous messages" });
    }
  });

  app.post("/api/anonymous-messages", async (req, res) => {
    try {
      const validatedData = insertAnonymousMessageSchema.parse(req.body);
      const newMessage = await storage.createAnonymousMessage(validatedData);
      
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'anonymous',
            data: newMessage,
          }));
        }
      });
      
      res.json(newMessage);
    } catch (error: any) {
      console.error('Error creating anonymous message:', error);
      res.status(400).json({ 
        error: "Invalid anonymous message data",
        message: error.message 
      });
    }
  });

  app.patch("/api/anonymous-messages/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markAnonymousMessageAsRead(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  app.get("/api/goals", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { storeId, sellerId, weekStart, weekEnd, type, isActive } = req.query;
      
      // Determine which storeId to use based on user role
      let effectiveStoreId = storeId as string | undefined;
      
      // For managers, filter by their assigned stores if no specific storeId is requested
      if (user.role === 'gerente') {
        const userStoresList = await storage.getUserStores(user.id);
        const managerStoreIds = userStoresList.length > 0 
          ? userStoresList.map(us => us.storeId) 
          : (user.storeId ? [user.storeId] : []);
        
        // If a specific storeId is requested, verify the manager has access to it
        if (storeId && storeId !== 'all') {
          if (!managerStoreIds.includes(storeId as string)) {
            return res.status(403).json({ error: "Sem permissão para ver metas desta loja" });
          }
          effectiveStoreId = storeId as string;
        } else {
          // Get all goals for manager's stores and filter in memory
          const allGoals = await storage.getSalesGoals({
            sellerId: sellerId as string | undefined,
            weekStart: weekStart as string | undefined,
            weekEnd: weekEnd as string | undefined,
            type: type as "individual" | "team" | undefined,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          });
          
          const filteredGoals = allGoals.filter(goal => managerStoreIds.includes(goal.storeId));
          return res.json(filteredGoals);
        }
      }
      
      const goals = await storage.getSalesGoals({
        storeId: effectiveStoreId,
        sellerId: sellerId as string | undefined,
        weekStart: weekStart as string | undefined,
        weekEnd: weekEnd as string | undefined,
        type: type as "individual" | "team" | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      
      res.json(goals);
    } catch (error: any) {
      console.error('Error fetching goals:', error);
      res.status(500).json({ 
        error: "Erro ao buscar metas",
        message: error.message 
      });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para criar metas" });
      }

      const validatedData = insertSalesGoalSchema.parse({
        ...req.body,
        createdById: userId,
      });

      const overlappingGoals = await storage.checkOverlappingGoals({
        storeId: validatedData.storeId,
        sellerId: validatedData.sellerId || null,
        type: validatedData.type,
        period: validatedData.period || "weekly",
        weekStart: validatedData.weekStart,
        weekEnd: validatedData.weekEnd,
      });

      if (overlappingGoals.length > 0) {
        const periodLabel = validatedData.period === "monthly" ? "mensal" : "semanal";
        const typeLabel = validatedData.type === "individual" ? "individual" : "conjunta";
        return res.status(409).json({ 
          error: `Já existe uma meta ${typeLabel} ${periodLabel} para este período que sobrepõe as datas selecionadas.`,
          overlappingGoals: overlappingGoals.map(g => ({
            id: g.id,
            weekStart: g.weekStart,
            weekEnd: g.weekEnd
          }))
        });
      }
      
      const newGoal = await storage.createSalesGoal(validatedData);
      res.json(newGoal);
    } catch (error: any) {
      console.error('Error creating goal:', error);
      res.status(400).json({ 
        error: "Erro ao criar meta",
        message: error.message 
      });
    }
  });

  app.patch("/api/goals/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para atualizar metas" });
      }

      const { id } = req.params;
      
      const existingGoal = await storage.getSalesGoals({ id });
      if (existingGoal.length === 0) {
        return res.status(404).json({ error: "Meta não encontrada" });
      }
      
      const currentGoal = existingGoal[0];
      const updateData = req.body;
      
      const storeId = updateData.storeId || currentGoal.storeId;
      const sellerId = updateData.sellerId !== undefined ? updateData.sellerId : currentGoal.sellerId;
      const type = updateData.type || currentGoal.type;
      const period = updateData.period || currentGoal.period;
      const weekStart = updateData.weekStart || currentGoal.weekStart;
      const weekEnd = updateData.weekEnd || currentGoal.weekEnd;
      
      if (updateData.weekStart || updateData.weekEnd || updateData.storeId || 
          updateData.sellerId !== undefined || updateData.type || updateData.period) {
        const overlappingGoals = await storage.checkOverlappingGoals({
          storeId,
          sellerId,
          type: type as "individual" | "team",
          period: period as "weekly" | "monthly",
          weekStart,
          weekEnd,
          excludeId: id,
        });

        if (overlappingGoals.length > 0) {
          const periodLabel = period === "monthly" ? "mensal" : "semanal";
          const typeLabel = type === "individual" ? "individual" : "conjunta";
          return res.status(409).json({ 
            error: `Já existe uma meta ${typeLabel} ${periodLabel} para este período que sobrepõe as datas selecionadas.`,
            overlappingGoals: overlappingGoals.map(g => ({
              id: g.id,
              weekStart: g.weekStart,
              weekEnd: g.weekEnd
            }))
          });
        }
      }

      const updatedGoal = await storage.updateSalesGoal(id, updateData);
      res.json(updatedGoal);
    } catch (error: any) {
      console.error('Error updating goal:', error);
      res.status(400).json({ 
        error: "Erro ao atualizar meta",
        message: error.message 
      });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para deletar metas" });
      }

      const { id } = req.params;
      await storage.deleteSalesGoal(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting goal:', error);
      res.status(500).json({ 
        error: "Erro ao deletar meta",
        message: error.message 
      });
    }
  });

  app.get("/api/goals/progress", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { goalId, storeId, weekStart, weekEnd } = req.query;

      if (!goalId && (!storeId || !weekStart || !weekEnd)) {
        return res.status(400).json({ 
          error: "goalId ou (storeId + weekStart + weekEnd) são obrigatórios" 
        });
      }

      let goal;
      if (goalId) {
        const goals = await storage.getSalesGoals({ id: goalId as string });
        goal = goals[0];
        if (!goal) {
          return res.status(404).json({ error: "Meta não encontrada" });
        }
      }

      const targetStoreId = (goalId && goal) ? goal.storeId : (storeId as string);
      const targetWeekStart = (goalId && goal) ? goal.weekStart : (weekStart as string);
      const targetWeekEnd = (goalId && goal) ? goal.weekEnd : (weekEnd as string);

      let totalSales = 0;
      
      if (goal && goal.type === 'individual' && goal.sellerId) {
        const sellerUser = await storage.getUser(goal.sellerId);
        const sellerName = sellerUser?.fullName;
        
        const sales = await storage.getSales({
          storeId: targetStoreId,
          sellerName: sellerName,
          startDate: targetWeekStart,
          endDate: targetWeekEnd,
        });
        
        totalSales = sales.reduce((sum, sale) => {
          const value = parseFloat(sale.totalValue);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);
      } else {
        const sales = await storage.getSales({
          storeId: targetStoreId,
          startDate: targetWeekStart,
          endDate: targetWeekEnd,
        });
        
        totalSales = sales.reduce((sum, sale) => {
          const value = parseFloat(sale.totalValue);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);
      }

      const progress = {
        goalId: goalId || null,
        storeId: targetStoreId,
        weekStart: targetWeekStart,
        weekEnd: targetWeekEnd,
        targetValue: goal ? parseFloat(goal.targetValue) : null,
        currentValue: totalSales,
        percentage: goal ? (totalSales / parseFloat(goal.targetValue)) * 100 : null,
      };

      res.json(progress);
    } catch (error: any) {
      console.error('Error calculating goal progress:', error);
      res.status(500).json({ 
        error: "Erro ao calcular progresso da meta",
        message: error.message 
      });
    }
  });

  app.get("/api/goals/dashboard", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { storeId } = req.query;
      
      // Use Brazil timezone (UTC-3) for consistent date comparison
      const getBrazilDate = () => {
        const now = new Date();
        const brazilOffset = -3 * 60; // UTC-3 in minutes
        const utcOffset = now.getTimezoneOffset();
        return new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
      };
      
      const now = getBrazilDate();
      const todayStr = now.toISOString().split('T')[0];
      const dayMs = 1000 * 60 * 60 * 24;
      const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      
      console.log('[GoalsDashboard] todayStr:', todayStr, 'storeId:', storeId, 'userRole:', user.role);
      
      const allActiveGoals = await storage.getSalesGoals({ isActive: true });
      
      let managerStoreIds: string[] = [];
      if (user.role === 'gerente') {
        const userStoresList = await storage.getUserStores(user.id);
        managerStoreIds = userStoresList.map(us => us.storeId);
        if (managerStoreIds.length === 0 && user.storeId) {
          managerStoreIds = [user.storeId];
        }
      }

      const currentGoals = allActiveGoals.filter(goal => {
        const isWithinRange = todayStr >= goal.weekStart && todayStr <= goal.weekEnd;
        if (goal.storeId === 'saron2') {
          console.log('[GoalsDashboard] Saron2 goal:', goal.id, 'period:', goal.period, 'weekStart:', goal.weekStart, 'weekEnd:', goal.weekEnd, 'isActive:', goal.isActive, 'isWithinRange:', isWithinRange);
        }
        return isWithinRange;
      });
      
      console.log('[GoalsDashboard] currentGoals count:', currentGoals.length, 'allActiveGoals count:', allActiveGoals.length);

      // Helper function to calculate goal progress
      const calculateGoalProgress = async (goal: typeof currentGoals[0], sellerName?: string, sellerUser?: typeof user) => {
        const sales = await storage.getSales({
          storeId: goal.storeId,
          sellerName: goal.type === 'individual' ? sellerName : undefined,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });
        
        const totalSales = sales.reduce((sum, sale) => {
          const value = parseFloat(sale.totalValue);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

        const targetValue = parseFloat(goal.targetValue);
        const percentage = targetValue > 0 ? (totalSales / targetValue) * 100 : 0;

        const [startYear, startMonth, startDay] = goal.weekStart.split('-').map(Number);
        const [endYear, endMonth, endDay] = goal.weekEnd.split('-').map(Number);
        const startDateUtc = Date.UTC(startYear, startMonth - 1, startDay);
        const endDateUtc = Date.UTC(endYear, endMonth - 1, endDay);
        
        const totalDays = Math.max(1, Math.floor((endDateUtc - startDateUtc) / dayMs) + 1);
        const elapsedDays = Math.floor((nowUtc - startDateUtc) / dayMs) + 1;
        
        // Use pattern-based expected percentage calculation
        const patternResult = await salesPatternService.calculateExpectedProgress(
          new Date(startYear, startMonth - 1, startDay),
          new Date(endYear, endMonth - 1, endDay),
          new Date(),
          goal.storeId
        );
        const expectedPercentage = patternResult.expectedPercentage;
        const isOnTrack = percentage >= expectedPercentage;

        // Calcular bonificação para metas individuais
        let bonusPercentageAchieved: number | null = null;
        let bonusPercentageNotAchieved: number | null = null;
        let estimatedBonus: number | null = null;

        if (goal.type === 'individual' && sellerUser) {
          bonusPercentageAchieved = sellerUser.bonusPercentageAchieved 
            ? parseFloat(sellerUser.bonusPercentageAchieved) 
            : null;
          bonusPercentageNotAchieved = sellerUser.bonusPercentageNotAchieved 
            ? parseFloat(sellerUser.bonusPercentageNotAchieved) 
            : null;

          if (bonusPercentageAchieved !== null || bonusPercentageNotAchieved !== null) {
            const bonusPercentage = percentage >= 100 
              ? (bonusPercentageAchieved || 0) 
              : (bonusPercentageNotAchieved || 0);
            estimatedBonus = totalSales * (bonusPercentage / 100);
          }
        }

        return {
          id: goal.id,
          storeId: goal.storeId,
          type: goal.type,
          period: goal.period,
          sellerId: goal.sellerId,
          sellerName: sellerName || null,
          weekStart: goal.weekStart,
          weekEnd: goal.weekEnd,
          targetValue,
          currentValue: totalSales,
          percentage,
          expectedPercentage,
          isOnTrack,
          elapsedDays,
          totalDays,
          bonusPercentageAchieved,
          bonusPercentageNotAchieved,
          estimatedBonus,
        };
      };

      if (user.role === 'vendedor') {
        // Vendedores da saron2 têm metas conjuntas (team), então mostram metas de equipe da loja
        const isSaron2Seller = user.storeId === 'saron2';
        
        let vendorGoals;
        if (isSaron2Seller) {
          // Para vendedores da saron2: mostrar metas de equipe da loja
          vendorGoals = currentGoals.filter(goal => 
            goal.storeId === 'saron2' && goal.type === 'team'
          );
        } else {
          // Para outros vendedores: mostrar apenas suas metas individuais
          vendorGoals = currentGoals.filter(goal => 
            goal.type === 'individual' && goal.sellerId === user.id
          );
        }

        const goalsWithProgress = await Promise.all(vendorGoals.map(goal => 
          calculateGoalProgress(goal, isSaron2Seller ? undefined : user.fullName, user)
        ));

        return res.json(goalsWithProgress);
      }

      // Gerentes: mostrar metas agregadas semanais e mensais da sua loja (individual + team)
      if (user.role === 'gerente') {
        // Filtrar todas as metas das lojas do gerente (individual + team)
        const managerStoreGoals = currentGoals.filter(goal => 
          managerStoreIds.includes(goal.storeId)
        );
        
        if (managerStoreGoals.length === 0) {
          return res.json([]);
        }
        
        const weeklyGoals = managerStoreGoals.filter(g => g.period === 'weekly');
        const monthlyGoals = managerStoreGoals.filter(g => g.period === 'monthly');
        
        const calculateManagerAggregatedProgress = async (goals: typeof managerStoreGoals, periodLabel: string) => {
          if (goals.length === 0) return null;

          let totalTarget = 0;
          let totalCurrent = 0;
          let earliestStart = goals[0].weekStart;
          let latestEnd = goals[0].weekEnd;

          for (const goal of goals) {
            totalTarget += parseFloat(goal.targetValue);
            
            if (goal.weekStart < earliestStart) earliestStart = goal.weekStart;
            if (goal.weekEnd > latestEnd) latestEnd = goal.weekEnd;

            if (goal.type === 'individual' && goal.sellerId) {
              const sellerUser = await storage.getUser(goal.sellerId);
              const sales = await storage.getSales({
                storeId: goal.storeId,
                sellerName: sellerUser?.fullName,
                startDate: goal.weekStart,
                endDate: goal.weekEnd,
              });
              totalCurrent += sales.reduce((sum, sale) => {
                const value = parseFloat(sale.totalValue);
                return sum + (isNaN(value) ? 0 : value);
              }, 0);
            } else {
              // Team goals: all store sales
              const sales = await storage.getSales({
                storeId: goal.storeId,
                startDate: goal.weekStart,
                endDate: goal.weekEnd,
              });
              totalCurrent += sales.reduce((sum, sale) => {
                const value = parseFloat(sale.totalValue);
                return sum + (isNaN(value) ? 0 : value);
              }, 0);
            }
          }

          const percentage = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

          const [startYear, startMonth, startDay] = earliestStart.split('-').map(Number);
          const [endYear, endMonth, endDay] = latestEnd.split('-').map(Number);
          const startDateUtc = Date.UTC(startYear, startMonth - 1, startDay);
          const endDateUtc = Date.UTC(endYear, endMonth - 1, endDay);
          
          const totalDays = Math.max(1, Math.floor((endDateUtc - startDateUtc) / dayMs) + 1);
          let elapsedDays: number;
          let expectedPercentage: number;
          
          if (nowUtc < startDateUtc) {
            elapsedDays = 0;
            expectedPercentage = 0;
          } else if (nowUtc > endDateUtc) {
            elapsedDays = totalDays;
            expectedPercentage = 100;
          } else {
            elapsedDays = Math.floor((nowUtc - startDateUtc) / dayMs) + 1;
            // Use pattern-based expected percentage calculation
            // For multi-store managers, use undefined to get combined pattern
            const patternResult = await salesPatternService.calculateExpectedProgress(
              new Date(startYear, startMonth - 1, startDay),
              new Date(endYear, endMonth - 1, endDay),
              new Date(),
              managerStoreIds.length === 1 ? managerStoreIds[0] : undefined
            );
            expectedPercentage = patternResult.expectedPercentage;
          }
          
          const isOnTrack = percentage >= expectedPercentage;

          const storeLabel = managerStoreIds.length > 1 ? 'Suas Lojas' : (managerStoreIds[0] || user.storeId);

          return {
            id: `aggregated-${periodLabel}`,
            storeId: storeLabel as string,
            type: 'aggregated' as const,
            period: periodLabel as 'weekly' | 'monthly',
            sellerId: null,
            sellerName: null,
            weekStart: earliestStart,
            weekEnd: latestEnd,
            targetValue: totalTarget,
            currentValue: totalCurrent,
            percentage,
            expectedPercentage,
            isOnTrack,
            elapsedDays,
            totalDays,
            goalsCount: goals.length,
            bonusPercentageAchieved: null,
            bonusPercentageNotAchieved: null,
            estimatedBonus: null,
          };
        };
        
        const results = [];
        
        const weeklyAggregated = await calculateManagerAggregatedProgress(weeklyGoals, 'weekly');
        if (weeklyAggregated) results.push(weeklyAggregated);
        
        const monthlyAggregated = await calculateManagerAggregatedProgress(monthlyGoals, 'monthly');
        if (monthlyAggregated) results.push(monthlyAggregated);
        
        return res.json(results);
      }

      // Administrador: metas agregadas
      let relevantGoals = currentGoals;
      if (storeId && storeId !== 'todas') {
        relevantGoals = currentGoals.filter(goal => goal.storeId === storeId);
      }

      const weeklyGoals = relevantGoals.filter(g => g.period === 'weekly');
      const monthlyGoals = relevantGoals.filter(g => g.period === 'monthly');

      const calculateAggregatedProgress = async (goals: typeof relevantGoals, periodLabel: string) => {
        if (goals.length === 0) return null;

        let totalTarget = 0;
        let totalCurrent = 0;
        let earliestStart = goals[0].weekStart;
        let latestEnd = goals[0].weekEnd;

        for (const goal of goals) {
          totalTarget += parseFloat(goal.targetValue);
          
          if (goal.weekStart < earliestStart) earliestStart = goal.weekStart;
          if (goal.weekEnd > latestEnd) latestEnd = goal.weekEnd;

          if (goal.type === 'individual' && goal.sellerId) {
            const sellerUser = await storage.getUser(goal.sellerId);
            const sales = await storage.getSales({
              storeId: goal.storeId,
              sellerName: sellerUser?.fullName,
              startDate: goal.weekStart,
              endDate: goal.weekEnd,
            });
            totalCurrent += sales.reduce((sum, sale) => {
              const value = parseFloat(sale.totalValue);
              return sum + (isNaN(value) ? 0 : value);
            }, 0);
          } else {
            const sales = await storage.getSales({
              storeId: goal.storeId,
              startDate: goal.weekStart,
              endDate: goal.weekEnd,
            });
            totalCurrent += sales.reduce((sum, sale) => {
              const value = parseFloat(sale.totalValue);
              return sum + (isNaN(value) ? 0 : value);
            }, 0);
          }
        }

        const percentage = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

        const [startYear, startMonth, startDay] = earliestStart.split('-').map(Number);
        const [endYear, endMonth, endDay] = latestEnd.split('-').map(Number);
        const startDateUtc = Date.UTC(startYear, startMonth - 1, startDay);
        const endDateUtc = Date.UTC(endYear, endMonth - 1, endDay);
        
        const totalDays = Math.max(1, Math.floor((endDateUtc - startDateUtc) / dayMs) + 1);
        let elapsedDays: number;
        let expectedPercentage: number;
        
        if (nowUtc < startDateUtc) {
          elapsedDays = 0;
          expectedPercentage = 0;
        } else if (nowUtc > endDateUtc) {
          elapsedDays = totalDays;
          expectedPercentage = 100;
        } else {
          elapsedDays = Math.floor((nowUtc - startDateUtc) / dayMs) + 1;
          // Use pattern-based expected percentage calculation
          const patternResult = await salesPatternService.calculateExpectedProgress(
            new Date(startYear, startMonth - 1, startDay),
            new Date(endYear, endMonth - 1, endDay),
            new Date(),
            typeof storeId === 'string' ? storeId : undefined
          );
          expectedPercentage = patternResult.expectedPercentage;
        }
        
        const isOnTrack = percentage >= expectedPercentage;

        const storeLabel = user.role === 'administrador' 
          ? (storeId && storeId !== 'todas' ? storeId : 'Todas as Lojas')
          : (managerStoreIds.length > 1 ? 'Suas Lojas' : managerStoreIds[0] || user.storeId);

        return {
          id: `aggregated-${periodLabel}`,
          storeId: storeLabel as string,
          type: 'aggregated' as const,
          period: periodLabel as 'weekly' | 'monthly',
          sellerId: null,
          sellerName: null,
          weekStart: earliestStart,
          weekEnd: latestEnd,
          targetValue: totalTarget,
          currentValue: totalCurrent,
          percentage,
          expectedPercentage,
          isOnTrack,
          elapsedDays,
          totalDays,
          goalsCount: goals.length,
        };
      };

      const results = [];
      
      const weeklyAggregated = await calculateAggregatedProgress(weeklyGoals, 'weekly');
      if (weeklyAggregated) results.push(weeklyAggregated);
      
      const monthlyAggregated = await calculateAggregatedProgress(monthlyGoals, 'monthly');
      if (monthlyAggregated) results.push(monthlyAggregated);

      res.json(results);
    } catch (error: any) {
      console.error('Error fetching dashboard goals:', error);
      res.status(500).json({ 
        error: "Erro ao buscar metas do dashboard",
        message: error.message 
      });
    }
  });

  // Cashier dashboard endpoint - shows weekly goal progress and payment method sales
  app.get("/api/cashier/dashboard", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'caixa') {
        return res.status(403).json({ error: "Acesso restrito a caixas" });
      }

      // Get current week dates (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = sunday.toISOString().split('T')[0];

      // Get cashier's active weekly goal for current week
      const cashierGoals = await storage.getCashierGoals({ 
        cashierId: user.id,
        isActive: true 
      });

      // Find goal that contains today's date (not exact match)
      const todayStr = now.toISOString().split('T')[0];
      const currentGoal = cashierGoals.find(g => 
        g.periodType === 'weekly' && 
        todayStr >= g.weekStart && 
        todayStr <= g.weekEnd
      );

      if (!currentGoal) {
        return res.json({
          hasGoal: false,
          message: "Nenhuma meta semanal encontrada para esta semana",
          weekStart: todayStr,
          weekEnd: todayStr,
        });
      }

      // Use goal's date range for fetching sales
      const goalWeekStart = currentGoal.weekStart;
      const goalWeekEnd = currentGoal.weekEnd;

      // Get store sales for the week
      const storeSales = await storage.getSales({
        storeId: currentGoal.storeId,
        startDate: goalWeekStart,
        endDate: goalWeekEnd,
      });

      const totalStoreSales = storeSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
      const paymentMethods = currentGoal.paymentMethods || [];

      // Get sales by target payment methods
      const receiptTotals = await storage.getReceiptsByPaymentMethod(
        currentGoal.storeId,
        goalWeekStart,
        goalWeekEnd,
        paymentMethods
      );

      let targetMethodSales = 0;
      for (const receipt of receiptTotals) {
        targetMethodSales += receipt.totalGross;
      }

      const percentageAchieved = totalStoreSales > 0 ? (targetMethodSales / totalStoreSales) * 100 : 0;
      const targetPercentage = parseFloat(currentGoal.targetPercentage);
      const isGoalMet = percentageAchieved >= targetPercentage;

      // Calculate elapsed time for on-track calculation
      const startDate = new Date(goalWeekStart + 'T00:00:00');
      const endDate = new Date(goalWeekEnd + 'T23:59:59');
      const totalDays = 7;
      let elapsedDays = 0;

      if (now >= startDate && now <= endDate) {
        elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else if (now > endDate) {
        elapsedDays = 7;
      }

      const expectedPercentage = (elapsedDays / totalDays) * targetPercentage;
      const isOnTrack = percentageAchieved >= expectedPercentage;

      res.json({
        hasGoal: true,
        goal: {
          id: currentGoal.id,
          storeId: currentGoal.storeId,
          weekStart: goalWeekStart,
          weekEnd: goalWeekEnd,
          paymentMethods,
          targetPercentage,
          currentPercentage: Math.round(percentageAchieved * 100) / 100,
          isGoalMet,
          isOnTrack,
          elapsedDays,
          totalDays,
          expectedPercentage: Math.round(expectedPercentage * 100) / 100,
          totalStoreSales: Math.round(totalStoreSales * 100) / 100,
          targetMethodSales: Math.round(targetMethodSales * 100) / 100,
          bonusPercentageAchieved: parseFloat(currentGoal.bonusPercentageAchieved),
          bonusPercentageNotAchieved: parseFloat(currentGoal.bonusPercentageNotAchieved),
        },
        salesByMethod: receiptTotals.map(r => ({
          method: r.paymentMethod,
          total: Math.round(r.totalGross * 100) / 100,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching cashier dashboard:', error);
      res.status(500).json({ 
        error: "Erro ao buscar dados do dashboard",
        message: error.message 
      });
    }
  });

  // Personal goals endpoint for vendedores, gerentes, and caixas (last 4 weeks with bonus)
  app.get("/api/goals/personal", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Only vendedores, gerentes, and caixas can access personal goals
      if (user.role !== 'vendedor' && user.role !== 'gerente' && user.role !== 'caixa') {
        return res.status(403).json({ error: "Sem permissão para acessar metas pessoais" });
      }

      // Calculate date range for last 4 weeks
      const now = new Date();
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      // For caixa users, fetch cashier goals instead of sales goals
      if (user.role === 'caixa') {
        const allCashierGoals = await storage.getCashierGoals({
          cashierId: user.id,
        });

        // Filter goals that fall within the last 4 weeks
        const recentGoals = allCashierGoals.filter(goal => {
          return goal.weekEnd >= fourWeeksAgoStr && goal.weekStart <= todayStr;
        });

        // Calculate progress for each cashier goal
        const goalsWithProgress = await Promise.all(recentGoals.map(async (goal) => {
          // Get total store sales for the period
          const storeSales = await storage.getSales({
            storeId: goal.storeId,
            startDate: goal.weekStart,
            endDate: goal.weekEnd,
          });

          const totalStoreSales = storeSales.reduce((sum, sale) => {
            const value = parseFloat(sale.totalValue);
            return sum + (isNaN(value) ? 0 : value);
          }, 0);

          // Get receipts by payment methods specified in the goal
          const paymentMethods = goal.paymentMethods || [];
          const receiptTotals = await storage.getReceiptsByPaymentMethod(
            goal.storeId,
            goal.weekStart,
            goal.weekEnd,
            paymentMethods
          );

          // Sum all target method sales from receipts
          let targetMethodSales = 0;
          for (const receipt of receiptTotals) {
            targetMethodSales += receipt.totalGross;
          }

          // Calculate percentage achieved
          const percentageAchieved = totalStoreSales > 0 
            ? (targetMethodSales / totalStoreSales) * 100 
            : 0;

          const targetPercentage = parseFloat(goal.targetPercentage);
          const achieved = percentageAchieved >= targetPercentage;
          const isFinished = goal.weekEnd < todayStr;

          // Calculate bonus
          const bonusPercentageAchieved = parseFloat(goal.bonusPercentageAchieved);
          const bonusPercentageNotAchieved = parseFloat(goal.bonusPercentageNotAchieved);
          const appliedBonusPercentage = achieved ? bonusPercentageAchieved : bonusPercentageNotAchieved;
          const bonusValue = (appliedBonusPercentage / 100) * targetMethodSales;

          return {
            id: goal.id,
            storeId: goal.storeId,
            period: goal.periodType,
            weekStart: goal.weekStart,
            weekEnd: goal.weekEnd,
            targetValue: targetPercentage, // For caixa, target is a percentage
            currentValue: percentageAchieved, // Current achieved percentage
            percentage: (percentageAchieved / targetPercentage) * 100, // Progress towards goal
            achieved,
            isFinished,
            bonusPercentageAchieved,
            bonusPercentageNotAchieved,
            appliedBonusPercentage,
            bonusValue,
            paymentMethods,
            totalStoreSales,
            targetMethodSales,
            isCashierGoal: true,
          };
        }));

        // Sort by weekStart descending
        goalsWithProgress.sort((a, b) => {
          return new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime();
        });

        // For cashier, calculate appropriate summary values
        const finishedGoals = goalsWithProgress.filter(g => g.isFinished);
        const totalBonus = finishedGoals.reduce((sum, g) => sum + g.bonusValue, 0);
        const totalTargetMethodSales = goalsWithProgress.reduce((sum, g) => sum + g.targetMethodSales, 0);

        return res.json({
          user: {
            id: user.id,
            fullName: user.fullName,
            role: user.role,
            storeId: user.storeId,
            bonusPercentageAchieved: null,
            bonusPercentageNotAchieved: null,
          },
          goals: goalsWithProgress,
          summary: {
            totalGoals: goalsWithProgress.length,
            achievedGoals: finishedGoals.filter(g => g.achieved).length,
            totalBonus: totalBonus,
            totalSales: totalTargetMethodSales, // For caixa, this is total sales in target payment methods
          },
          isCashierData: true,
        });
      }

      // For vendedores and gerentes, fetch sales goals
      // Special case: Saron 2 sellers see team goals instead of individual goals
      const isSaron2Seller = user.role === 'vendedor' && user.storeId === 'saron2';
      
      let allGoals;
      if (isSaron2Seller) {
        // Saron 2 sellers see team goals for their store
        allGoals = await storage.getSalesGoals({
          storeId: 'saron2',
          type: 'team',
        });
      } else {
        // Other sellers see their individual goals
        allGoals = await storage.getSalesGoals({
          sellerId: user.id,
          type: 'individual',
        });
      }

      // Filter goals that fall within the last 4 weeks
      const recentGoals = allGoals.filter(goal => {
        return goal.weekEnd >= fourWeeksAgoStr && goal.weekStart <= todayStr;
      });

      // Calculate progress and bonus for each goal
      const goalsWithProgress = await Promise.all(recentGoals.map(async (goal) => {
        // Get sales for this goal period
        // For team goals (Saron 2), get all store sales; for individual goals, get seller-specific sales
        const isTeamGoal = goal.type === 'team';
        const sales = await storage.getSales({
          storeId: goal.storeId,
          sellerName: isTeamGoal ? undefined : user.fullName,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });

        const totalSales = sales.reduce((sum, sale) => {
          const value = parseFloat(sale.totalValue);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

        const targetValue = parseFloat(goal.targetValue);
        const percentage = targetValue > 0 ? (totalSales / targetValue) * 100 : 0;
        const achieved = percentage >= 100;

        // Calculate bonus
        const bonusPercentageAchieved = user.bonusPercentageAchieved 
          ? parseFloat(user.bonusPercentageAchieved) 
          : null;
        const bonusPercentageNotAchieved = user.bonusPercentageNotAchieved 
          ? parseFloat(user.bonusPercentageNotAchieved) 
          : null;

        let bonusValue = 0;
        let appliedBonusPercentage = 0;

        if (achieved && bonusPercentageAchieved !== null) {
          appliedBonusPercentage = bonusPercentageAchieved;
          bonusValue = totalSales * (bonusPercentageAchieved / 100);
        } else if (!achieved && bonusPercentageNotAchieved !== null) {
          appliedBonusPercentage = bonusPercentageNotAchieved;
          bonusValue = totalSales * (bonusPercentageNotAchieved / 100);
        }

        // Check if this goal's period has ended
        const isFinished = goal.weekEnd < todayStr;

        return {
          id: goal.id,
          storeId: goal.storeId,
          period: goal.period,
          weekStart: goal.weekStart,
          weekEnd: goal.weekEnd,
          targetValue,
          currentValue: totalSales,
          percentage,
          achieved,
          isFinished,
          bonusPercentageAchieved,
          bonusPercentageNotAchieved,
          appliedBonusPercentage,
          bonusValue,
          isTeamGoal,
        };
      }));

      // Sort by weekStart descending (most recent first)
      goalsWithProgress.sort((a, b) => {
        return new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime();
      });

      res.json({
        user: {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          storeId: user.storeId,
          bonusPercentageAchieved: user.bonusPercentageAchieved ? parseFloat(user.bonusPercentageAchieved) : null,
          bonusPercentageNotAchieved: user.bonusPercentageNotAchieved ? parseFloat(user.bonusPercentageNotAchieved) : null,
        },
        goals: goalsWithProgress,
        summary: {
          totalGoals: goalsWithProgress.length,
          achievedGoals: goalsWithProgress.filter(g => g.achieved && g.isFinished).length,
          totalBonus: goalsWithProgress.filter(g => g.isFinished).reduce((sum, g) => sum + g.bonusValue, 0),
          totalSales: goalsWithProgress.reduce((sum, g) => sum + g.currentValue, 0),
        }
      });
    } catch (error: any) {
      console.error('Error fetching personal goals:', error);
      res.status(500).json({ 
        error: "Erro ao buscar metas pessoais",
        message: error.message 
      });
    }
  });

  // Cashier goals routes
  app.get("/api/cashier-goals", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { storeId, cashierId, isActive } = req.query;
      
      // Determine which storeId to use based on user role
      let effectiveStoreId = storeId as string | undefined;
      
      // For managers, filter by their assigned stores if no specific storeId is requested
      if (user.role === 'gerente') {
        const userStoresList = await storage.getUserStores(user.id);
        const managerStoreIds = userStoresList.length > 0 
          ? userStoresList.map(us => us.storeId) 
          : (user.storeId ? [user.storeId] : []);
        
        // If a specific storeId is requested, verify the manager has access to it
        if (storeId && storeId !== 'all') {
          if (!managerStoreIds.includes(storeId as string)) {
            return res.status(403).json({ error: "Sem permissão para ver metas de caixa desta loja" });
          }
          effectiveStoreId = storeId as string;
        } else {
          // Get all cashier goals and filter by manager's stores
          const allGoals = await storage.getCashierGoals({
            cashierId: cashierId as string | undefined,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          });
          
          const filteredGoals = allGoals.filter(goal => managerStoreIds.includes(goal.storeId));
          return res.json(filteredGoals);
        }
      }
      
      const goals = await storage.getCashierGoals({
        storeId: effectiveStoreId,
        cashierId: cashierId as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      
      res.json(goals);
    } catch (error: any) {
      console.error('Error fetching cashier goals:', error);
      res.status(500).json({ 
        error: "Erro ao buscar metas de caixa",
        message: error.message 
      });
    }
  });

  app.post("/api/cashier-goals", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para criar metas de caixa" });
      }

      const validatedData = insertCashierGoalSchema.parse({
        ...req.body,
        createdById: userId,
      });
      
      const newGoal = await storage.createCashierGoal(validatedData);
      res.json(newGoal);
    } catch (error: any) {
      console.error('Error creating cashier goal:', error);
      res.status(400).json({ 
        error: "Erro ao criar meta de caixa",
        message: error.message 
      });
    }
  });

  app.patch("/api/cashier-goals/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para atualizar metas de caixa" });
      }

      const { id } = req.params;
      const updatedGoal = await storage.updateCashierGoal(id, req.body);
      res.json(updatedGoal);
    } catch (error: any) {
      console.error('Error updating cashier goal:', error);
      res.status(400).json({ 
        error: "Erro ao atualizar meta de caixa",
        message: error.message 
      });
    }
  });

  app.delete("/api/cashier-goals/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para deletar metas de caixa" });
      }

      const { id } = req.params;
      await storage.deleteCashierGoal(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting cashier goal:', error);
      res.status(500).json({ 
        error: "Erro ao deletar meta de caixa",
        message: error.message 
      });
    }
  });

  // Cashier goals progress endpoint
  app.get("/api/cashier-goals/progress", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { goalId, storeId, weekStart, weekEnd } = req.query;
      
      // Get the goal(s) to calculate progress for
      const goals = await storage.getCashierGoals({
        id: goalId as string | undefined,
        storeId: storeId as string | undefined,
        isActive: true,
      });

      if (goals.length === 0) {
        return res.json([]);
      }

      const results = [];

      for (const goal of goals) {
        // Get total store sales for the period
        const storeSales = await storage.getSales({
          storeId: goal.storeId,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });

        // Calculate total sales value
        const totalStoreSales = storeSales.reduce((sum, sale) => sum + parseFloat(sale.totalValue), 0);

        // Get receipts by payment methods specified in the goal
        // This uses the saleReceipts table which has the actual value per payment method
        const paymentMethods = goal.paymentMethods || [];
        const receiptTotals = await storage.getReceiptsByPaymentMethod(
          goal.storeId,
          goal.weekStart,
          goal.weekEnd,
          paymentMethods
        );
        
        // Sum all target method sales from receipts (using grossValue)
        let targetMethodSales = 0;
        for (const receipt of receiptTotals) {
          targetMethodSales += receipt.totalGross;
        }

        // Calculate percentage achieved
        const percentageAchieved = totalStoreSales > 0 
          ? (targetMethodSales / totalStoreSales) * 100 
          : 0;

        // Calculate bonus based on whether target was met
        const targetPercentage = parseFloat(goal.targetPercentage);
        const isGoalMet = percentageAchieved >= targetPercentage;
        const bonusPercentage = isGoalMet 
          ? parseFloat(goal.bonusPercentageAchieved)
          : parseFloat(goal.bonusPercentageNotAchieved);
        
        const bonusValue = (bonusPercentage / 100) * targetMethodSales;

        // Custom rounding: ≤5 down, >5 up
        const roundedBonus = (() => {
          const factor = 100;
          const shifted = bonusValue * factor;
          const floored = Math.floor(shifted);
          const decimal = shifted - floored;
          if (decimal > 0.5) {
            return (floored + 1) / factor;
          }
          return floored / factor;
        })();

        results.push({
          goalId: goal.id,
          cashierId: goal.cashierId,
          storeId: goal.storeId,
          periodType: goal.periodType,
          weekStart: goal.weekStart,
          weekEnd: goal.weekEnd,
          paymentMethods: goal.paymentMethods,
          targetPercentage,
          percentageAchieved: Math.round(percentageAchieved * 100) / 100,
          isGoalMet,
          totalStoreSales,
          targetMethodSales,
          bonusPercentage,
          bonusValue: roundedBonus,
        });
      }

      res.json(results);
    } catch (error: any) {
      console.error('Error calculating cashier goal progress:', error);
      res.status(500).json({ 
        error: "Erro ao calcular progresso da meta de caixa",
        message: error.message 
      });
    }
  });

  // Bonus summary endpoint for admin dashboard
  app.get("/api/bonus/summary", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      const { periodType, storeId } = req.query;
      
      const now = new Date();
      const saoPauloOffset = -3 * 60; // UTC-3
      const localNow = new Date(now.getTime() + (saoPauloOffset + now.getTimezoneOffset()) * 60000);
      
      // Calculate current period dates
      const getWeekStart = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };
      
      const getWeekEnd = (date: Date) => {
        const start = getWeekStart(date);
        return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      };
      
      const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
      const getMonthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      const weekStart = formatDate(getWeekStart(localNow));
      const weekEnd = formatDate(getWeekEnd(localNow));
      const monthStart = formatDate(getMonthStart(localNow));
      const monthEnd = formatDate(getMonthEnd(localNow));

      // Custom rounding function
      const customRound = (value: number) => {
        const factor = 100;
        const shifted = value * factor;
        const floored = Math.floor(shifted);
        const decimal = shifted - floored;
        if (decimal > 0.5) {
          return (floored + 1) / factor;
        }
        return floored / factor;
      };

      // Get all active sales goals and calculate bonuses
      const allGoals = await storage.getSalesGoals({ isActive: true });
      const allUsers = await storage.getAllUsers();
      const activeUsers = allUsers.filter(u => u.isActive);

      // Calculate vendor and manager bonuses
      const calculateUserBonus = async (goal: any, periodStart: string, periodEnd: string) => {
        console.log('[BonusSummary] calculateUserBonus called:', { goalId: goal.id, sellerId: goal.sellerId });
        if (!goal.sellerId) {
          console.log('[BonusSummary] No sellerId, returning 0');
          return 0;
        }
        
        const seller = activeUsers.find(u => u.id === goal.sellerId);
        if (!seller) {
          console.log('[BonusSummary] Seller not found for id:', goal.sellerId);
          return 0;
        }
        
        console.log('[BonusSummary] Fetching sales:', { storeId: goal.storeId, sellerName: seller.fullName, startDate: goal.weekStart, endDate: goal.weekEnd });
        const sales = await storage.getSales({
          storeId: goal.storeId,
          sellerName: seller.fullName,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });
        
        console.log('[BonusSummary] Sales found:', sales.length);
        const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const targetValue = parseFloat(goal.targetValue);
        const percentage = targetValue > 0 ? (totalSales / targetValue) * 100 : 0;
        const isGoalMet = percentage >= 100;
        
        const bonusPercentageAchieved = parseFloat(seller.bonusPercentageAchieved || "0");
        const bonusPercentageNotAchieved = parseFloat(seller.bonusPercentageNotAchieved || "0");
        const bonusPercentage = isGoalMet ? bonusPercentageAchieved : bonusPercentageNotAchieved;
        console.log('[BonusSummary] Bonus calc:', { totalSales, targetValue, percentage, isGoalMet, bonusPercentage });
        
        if (seller.role === 'vendedor' || seller.role === 'caixa') {
          return customRound((bonusPercentage / 100) * totalSales);
        }
        
        if (seller.role === 'gerente') {
          // Manager gets bonus on own sales + sales of team members who hit their goals
          let managerBonus = customRound((bonusPercentage / 100) * totalSales);
          
          // Get team members' goals in the same store
          const teamGoals = allGoals.filter(g => 
            g.storeId === goal.storeId && 
            g.sellerId !== seller.id && 
            g.type === 'individual' &&
            g.weekStart === goal.weekStart &&
            g.weekEnd === goal.weekEnd
          );
          
          for (const teamGoal of teamGoals) {
            const teamMember = activeUsers.find(u => u.id === teamGoal.sellerId);
            if (!teamMember || teamMember.role !== 'vendedor') continue;
            
            const teamSales = await storage.getSales({
              storeId: teamGoal.storeId,
              sellerName: teamMember.fullName,
              startDate: teamGoal.weekStart,
              endDate: teamGoal.weekEnd,
            });
            
            const teamTotalSales = teamSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
            const teamTarget = parseFloat(teamGoal.targetValue);
            const teamPercentage = teamTarget > 0 ? (teamTotalSales / teamTarget) * 100 : 0;
            
            if (teamPercentage >= 100) {
              managerBonus += customRound((bonusPercentage / 100) * teamTotalSales);
            }
          }
          
          return managerBonus;
        }
        
        return 0;
      };

      // Filter goals by period - check if goal period overlaps with current period
      console.log('[BonusSummary] Current periods:', { weekStart, weekEnd, monthStart, monthEnd });
      console.log('[BonusSummary] All goals count:', allGoals.length);
      console.log('[BonusSummary] Goals sample:', allGoals.slice(0, 3).map(g => ({ 
        id: g.id, 
        period: g.period, 
        weekStart: g.weekStart, 
        weekEnd: g.weekEnd,
        sellerId: g.sellerId,
        type: g.type 
      })));
      
      // For weekly goals, check if goal's date range overlaps with current week
      // Accept 'all', 'todas', or empty as "all stores"
      const isAllStores = !storeId || storeId === 'all' || storeId === 'todas';
      console.log('[BonusSummary] storeId filter:', { storeId, isAllStores });
      
      const weeklyGoals = allGoals.filter(g => {
        if (g.period !== 'weekly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        // Check if periods overlap
        const goalStart = g.weekStart;
        const goalEnd = g.weekEnd;
        return goalStart <= weekEnd && goalEnd >= weekStart;
      });
      
      // For monthly goals, check if goal's date range overlaps with current month
      const monthlyGoals = allGoals.filter(g => {
        if (g.period !== 'monthly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        // Check if periods overlap
        const goalStart = g.weekStart;
        const goalEnd = g.weekEnd;
        return goalStart <= monthEnd && goalEnd >= monthStart;
      });
      
      console.log('[BonusSummary] Filtered weekly goals:', weeklyGoals.length);
      console.log('[BonusSummary] Filtered monthly goals:', monthlyGoals.length);

      // Calculate weekly bonuses
      let weeklyVendorBonus = 0;
      let weeklyManagerBonus = 0;
      
      console.log('[BonusSummary] Processing weekly goals...');
      for (const goal of weeklyGoals) {
        console.log('[BonusSummary] Weekly goal:', { 
          id: goal.id, 
          sellerId: goal.sellerId, 
          type: goal.type,
          weekStart: goal.weekStart,
          weekEnd: goal.weekEnd
        });
        if (goal.sellerId) {
          const seller = activeUsers.find(u => u.id === goal.sellerId);
          console.log('[BonusSummary] Found seller:', seller ? { id: seller.id, name: seller.fullName, role: seller.role } : null);
          if (seller) {
            const bonus = await calculateUserBonus(goal, weekStart, weekEnd);
            console.log('[BonusSummary] Calculated bonus:', { sellerId: goal.sellerId, bonus });
            if (seller.role === 'vendedor') {
              weeklyVendorBonus += bonus;
            } else if (seller.role === 'gerente') {
              weeklyManagerBonus += bonus;
            }
          }
        }
      }
      console.log('[BonusSummary] Weekly totals:', { weeklyVendorBonus, weeklyManagerBonus });

      // Calculate monthly bonuses
      let monthlyVendorBonus = 0;
      let monthlyManagerBonus = 0;
      
      for (const goal of monthlyGoals) {
        if (goal.sellerId) {
          const seller = activeUsers.find(u => u.id === goal.sellerId);
          if (seller) {
            const bonus = await calculateUserBonus(goal, monthStart, monthEnd);
            if (seller.role === 'vendedor') {
              monthlyVendorBonus += bonus;
            } else if (seller.role === 'gerente') {
              monthlyManagerBonus += bonus;
            }
          }
        }
      }

      // Get cashier bonuses
      const cashierGoals = await storage.getCashierGoals({ isActive: true });
      
      const weeklyCashierGoals = cashierGoals.filter(g => {
        if (g.periodType !== 'weekly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        const goalStart = g.weekStart;
        const goalEnd = g.weekEnd;
        return goalStart <= weekEnd && goalEnd >= weekStart;
      });
      
      const monthlyCashierGoals = cashierGoals.filter(g => {
        if (g.periodType !== 'monthly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        const goalStart = g.weekStart;
        const goalEnd = g.weekEnd;
        return goalStart <= monthEnd && goalEnd >= monthStart;
      });

      let weeklyCashierBonus = 0;
      for (const goal of weeklyCashierGoals) {
        const storeSales = await storage.getSales({
          storeId: goal.storeId,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });
        
        const totalStoreSales = storeSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const paymentMethods = goal.paymentMethods || [];
        let targetMethodSales = 0;
        
        for (const sale of storeSales) {
          const paymentMethod = (sale.paymentMethod || '').toLowerCase().trim();
          for (const method of paymentMethods) {
            const targetMethod = method.toLowerCase().trim();
            if (paymentMethod.includes(targetMethod) || 
                (targetMethod === 'pix' && paymentMethod.includes('pix')) ||
                (targetMethod === 'debito' && (paymentMethod.includes('debito') || paymentMethod.includes('débito'))) ||
                (targetMethod === 'dinheiro' && paymentMethod.includes('dinheiro'))) {
              targetMethodSales += parseFloat(sale.totalValue);
              break;
            }
          }
        }
        
        const percentageAchieved = totalStoreSales > 0 ? (targetMethodSales / totalStoreSales) * 100 : 0;
        const targetPercentage = parseFloat(goal.targetPercentage);
        const isGoalMet = percentageAchieved >= targetPercentage;
        const bonusPercentage = isGoalMet 
          ? parseFloat(goal.bonusPercentageAchieved)
          : parseFloat(goal.bonusPercentageNotAchieved);
        
        weeklyCashierBonus += customRound((bonusPercentage / 100) * targetMethodSales);
      }

      let monthlyCashierBonus = 0;
      for (const goal of monthlyCashierGoals) {
        const storeSales = await storage.getSales({
          storeId: goal.storeId,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });
        
        const totalStoreSales = storeSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const paymentMethods = goal.paymentMethods || [];
        let targetMethodSales = 0;
        
        for (const sale of storeSales) {
          const paymentMethod = (sale.paymentMethod || '').toLowerCase().trim();
          for (const method of paymentMethods) {
            const targetMethod = method.toLowerCase().trim();
            if (paymentMethod.includes(targetMethod) || 
                (targetMethod === 'pix' && paymentMethod.includes('pix')) ||
                (targetMethod === 'debito' && (paymentMethod.includes('debito') || paymentMethod.includes('débito'))) ||
                (targetMethod === 'dinheiro' && paymentMethod.includes('dinheiro'))) {
              targetMethodSales += parseFloat(sale.totalValue);
              break;
            }
          }
        }
        
        const percentageAchieved = totalStoreSales > 0 ? (targetMethodSales / totalStoreSales) * 100 : 0;
        const targetPercentage = parseFloat(goal.targetPercentage);
        const isGoalMet = percentageAchieved >= targetPercentage;
        const bonusPercentage = isGoalMet 
          ? parseFloat(goal.bonusPercentageAchieved)
          : parseFloat(goal.bonusPercentageNotAchieved);
        
        monthlyCashierBonus += customRound((bonusPercentage / 100) * targetMethodSales);
      }

      res.json({
        weekly: {
          vendorBonus: customRound(weeklyVendorBonus),
          managerBonus: customRound(weeklyManagerBonus),
          cashierBonus: customRound(weeklyCashierBonus),
          total: customRound(weeklyVendorBonus + weeklyManagerBonus + weeklyCashierBonus),
          period: { start: weekStart, end: weekEnd },
        },
        monthly: {
          vendorBonus: customRound(monthlyVendorBonus),
          managerBonus: customRound(monthlyManagerBonus),
          cashierBonus: customRound(monthlyCashierBonus),
          total: customRound(monthlyVendorBonus + monthlyManagerBonus + monthlyCashierBonus),
          period: { start: monthStart, end: monthEnd },
        },
      });
    } catch (error: any) {
      console.error('Error calculating bonus summary:', error);
      res.status(500).json({ 
        error: "Erro ao calcular resumo de bônus",
        message: error.message 
      });
    }
  });

  // Weekly bonus payment summary - for financial/admin use on Mondays
  // Shows bonuses to be paid for the previous week
  app.get("/api/bonus/payment-summary", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'financeiro')) {
        return res.status(403).json({ error: "Sem permissão - apenas administrador e financeiro" });
      }

      const { storeId } = req.query;
      
      const now = new Date();
      const saoPauloOffset = -3 * 60; // UTC-3
      const localNow = new Date(now.getTime() + (saoPauloOffset + now.getTimezoneOffset()) * 60000);
      
      // Get PREVIOUS week dates (Sunday to Saturday - matching goals creation)
      // Week starts on Sunday (day 0) and ends on Saturday (day 6)
      const getWeekStartSunday = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sunday, 6 = Saturday
        d.setDate(d.getDate() - day); // Go back to Sunday
        return d;
      };
      
      const getPreviousWeekStart = (date: Date) => {
        const currentWeekStart = getWeekStartSunday(date);
        return new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      };
      
      const getPreviousWeekEnd = (date: Date) => {
        const prevWeekStart = getPreviousWeekStart(date);
        return new Date(prevWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000); // +6 days = Saturday
      };
      
      // Get current week's Monday (payment date)
      const getCurrentMonday = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? 1 : (1 - day + 7) % 7 || 7; // If Sunday, Monday is tomorrow; otherwise find next/current Monday
        if (day === 0) {
          d.setDate(d.getDate() + 1); // Sunday -> Monday
        } else if (day === 1) {
          // Already Monday
        } else {
          d.setDate(d.getDate() - (day - 1)); // Go back to Monday
        }
        return d;
      };
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      const prevWeekStart = formatDate(getPreviousWeekStart(localNow));
      const prevWeekEnd = formatDate(getPreviousWeekEnd(localNow));

      // Custom rounding function
      const customRound = (value: number) => {
        const factor = 100;
        const shifted = value * factor;
        const floored = Math.floor(shifted);
        const decimal = shifted - floored;
        if (decimal > 0.5) {
          return (floored + 1) / factor;
        }
        return floored / factor;
      };

      // Get all goals for the previous week
      const allGoals = await storage.getSalesGoals({ isActive: true });
      const allUsers = await storage.getAllUsers();
      const activeUsers = allUsers.filter(u => u.isActive);

      const isAllStores = !storeId || storeId === 'all' || storeId === 'todas';

      // Filter goals for previous week
      const weeklyGoals = allGoals.filter(g => {
        if (g.period !== 'weekly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        // Check if goal's period matches previous week
        return g.weekStart === prevWeekStart && g.weekEnd === prevWeekEnd;
      });

      // Store name mapping
      const storeNames: Record<string, string> = {
        'saron1': 'Saron 1',
        'saron2': 'Saron 2', 
        'saron3': 'Saron 3',
      };

      // Calculate individual bonuses with detailed breakdown
      const bonusDetails: Array<{
        id: string;
        name: string;
        role: string;
        storeId: string;
        storeName: string;
        targetValue: number;
        actualSales: number;
        percentage: number;
        isGoalMet: boolean;
        bonusPercentage: number;
        bonusValue: number;
        goalType: string;
        managerTeamBonus?: number;
      }> = [];

      // Separate individual and team goals
      const individualGoals = weeklyGoals.filter(g => g.type === 'individual' && g.sellerId);
      const teamGoals = weeklyGoals.filter(g => g.type === 'team' && !g.sellerId);

      // Track which vendors met their individual goals (for manager bonus calculation)
      const vendorsMeetingGoals: Map<string, { sellerId: string; sales: number; storeId: string }> = new Map();

      // Process INDIVIDUAL goals first
      for (const goal of individualGoals) {
        const seller = activeUsers.find(u => u.id === goal.sellerId);
        if (!seller) continue;

        const sales = await storage.getSales({
          storeId: goal.storeId,
          sellerName: seller.fullName,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });

        const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const targetValue = parseFloat(goal.targetValue);
        const percentage = targetValue > 0 ? (totalSales / targetValue) * 100 : 0;
        const isGoalMet = percentage >= 100;

        const bonusPercentageAchieved = parseFloat(seller.bonusPercentageAchieved || "0");
        const bonusPercentageNotAchieved = parseFloat(seller.bonusPercentageNotAchieved || "0");
        const bonusPercentage = isGoalMet ? bonusPercentageAchieved : bonusPercentageNotAchieved;
        
        let bonusValue = 0;
        let managerTeamBonus = 0;

        if (seller.role === 'vendedor') {
          bonusValue = customRound((bonusPercentage / 100) * totalSales);
          // Track vendors who met their goals
          if (isGoalMet) {
            vendorsMeetingGoals.set(seller.id, { sellerId: seller.id, sales: totalSales, storeId: goal.storeId });
          }
        } else if (seller.role === 'gerente') {
          // Manager base bonus on own sales
          bonusValue = customRound((bonusPercentage / 100) * totalSales);
        }

        bonusDetails.push({
          id: seller.id,
          name: seller.fullName,
          role: seller.role,
          storeId: goal.storeId,
          storeName: storeNames[goal.storeId] || goal.storeId,
          targetValue,
          actualSales: customRound(totalSales),
          percentage: customRound(percentage),
          isGoalMet,
          bonusPercentage,
          bonusValue,
          goalType: goal.type,
          managerTeamBonus: 0,
        });
      }

      // Now add manager team bonus: 0.2% of sales from vendors who met their goals
      for (const detail of bonusDetails) {
        if (detail.role === 'gerente') {
          let teamBonusValue = 0;
          // Find vendors in the same store who met their goals
          const vendorEntries = Array.from(vendorsMeetingGoals.entries());
          for (const [vendorId, vendorData] of vendorEntries) {
            if (vendorData.storeId === detail.storeId) {
              // Add 0.2% of this vendor's sales as manager team bonus
              teamBonusValue += customRound((0.2 / 100) * vendorData.sales);
            }
          }
          detail.managerTeamBonus = teamBonusValue;
          detail.bonusValue = customRound(detail.bonusValue + teamBonusValue);
        }
      }

      // Process TEAM goals - for stores with team goals, all vendors/managers get bonus on total store sales
      for (const teamGoal of teamGoals) {
        // Get all sales for this store in the period
        const storeSales = await storage.getSales({
          storeId: teamGoal.storeId,
          startDate: teamGoal.weekStart,
          endDate: teamGoal.weekEnd,
        });
        
        const totalStoreSales = storeSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const targetValue = parseFloat(teamGoal.targetValue);
        const percentage = targetValue > 0 ? (totalStoreSales / targetValue) * 100 : 0;
        const isGoalMet = percentage >= 100;

        // Find all vendors and managers assigned to this store
        const storeUsers = activeUsers.filter(u => 
          u.storeId === teamGoal.storeId && 
          (u.role === 'vendedor' || u.role === 'gerente')
        );

        for (const storeUser of storeUsers) {
          // Skip if this user already has an individual goal for the same period
          const hasIndividualGoal = bonusDetails.some(d => 
            d.id === storeUser.id && 
            d.storeId === teamGoal.storeId
          );
          if (hasIndividualGoal) continue;

          const bonusPercentageAchieved = parseFloat(storeUser.bonusPercentageAchieved || "0");
          const bonusPercentageNotAchieved = parseFloat(storeUser.bonusPercentageNotAchieved || "0");
          const bonusPercentage = isGoalMet ? bonusPercentageAchieved : bonusPercentageNotAchieved;
          
          // For team goals, bonus is calculated on TOTAL STORE SALES
          const bonusValue = customRound((bonusPercentage / 100) * totalStoreSales);

          bonusDetails.push({
            id: storeUser.id,
            name: storeUser.fullName,
            role: storeUser.role,
            storeId: teamGoal.storeId,
            storeName: storeNames[teamGoal.storeId] || teamGoal.storeId,
            targetValue,
            actualSales: customRound(totalStoreSales),
            percentage: customRound(percentage),
            isGoalMet,
            bonusPercentage,
            bonusValue,
            goalType: 'team',
            managerTeamBonus: 0,
          });
        }
      }

      // Get cashier goals for previous week
      const cashierGoals = await storage.getCashierGoals({ isActive: true });
      const weeklyCashierGoals = cashierGoals.filter(g => {
        if (g.periodType !== 'weekly') return false;
        if (!isAllStores && g.storeId !== storeId) return false;
        return g.weekStart === prevWeekStart && g.weekEnd === prevWeekEnd;
      });

      const cashierBonusDetails: Array<{
        id: string;
        name: string;
        role: string;
        storeId: string;
        storeName: string;
        paymentMethods: string[];
        targetPercentage: number;
        actualPercentage: number;
        isGoalMet: boolean;
        totalStoreSales: number;
        targetMethodSales: number;
        bonusPercentage: number;
        bonusValue: number;
      }> = [];

      for (const goal of weeklyCashierGoals) {
        const cashier = activeUsers.find(u => u.id === goal.cashierId);
        if (!cashier) continue;

        const storeSales = await storage.getSales({
          storeId: goal.storeId,
          startDate: goal.weekStart,
          endDate: goal.weekEnd,
        });

        const totalStoreSales = storeSales.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);
        const paymentMethods = goal.paymentMethods || [];
        
        // Use saleReceipts table for accurate payment method values
        const receiptTotals = await storage.getReceiptsByPaymentMethod(
          goal.storeId,
          goal.weekStart,
          goal.weekEnd,
          paymentMethods
        );
        
        // Sum all target method sales from receipts (using grossValue)
        let targetMethodSales = 0;
        for (const receipt of receiptTotals) {
          targetMethodSales += receipt.totalGross;
        }

        const percentageAchieved = totalStoreSales > 0 ? (targetMethodSales / totalStoreSales) * 100 : 0;
        const targetPercentage = parseFloat(goal.targetPercentage);
        const isGoalMet = percentageAchieved >= targetPercentage;
        const bonusPercentage = isGoalMet 
          ? parseFloat(goal.bonusPercentageAchieved)
          : parseFloat(goal.bonusPercentageNotAchieved);
        const bonusValue = customRound((bonusPercentage / 100) * targetMethodSales);

        cashierBonusDetails.push({
          id: cashier.id,
          name: cashier.fullName,
          role: 'caixa',
          storeId: goal.storeId,
          storeName: storeNames[goal.storeId] || goal.storeId,
          paymentMethods,
          targetPercentage,
          actualPercentage: customRound(percentageAchieved),
          isGoalMet,
          totalStoreSales: customRound(totalStoreSales),
          targetMethodSales: customRound(targetMethodSales),
          bonusPercentage,
          bonusValue,
        });
      }

      // Calculate totals by role
      const vendorTotal = bonusDetails
        .filter(b => b.role === 'vendedor')
        .reduce((sum, b) => sum + b.bonusValue, 0);
      const managerTotal = bonusDetails
        .filter(b => b.role === 'gerente')
        .reduce((sum, b) => sum + b.bonusValue, 0);
      const cashierTotal = cashierBonusDetails
        .reduce((sum, b) => sum + b.bonusValue, 0);
      const grandTotal = vendorTotal + managerTotal + cashierTotal;

      // Calculate totals by store
      const storeIds = ['saron1', 'saron2', 'saron3'];
      const byStore = storeIds.map(sid => {
        const storeBonuses = bonusDetails.filter(b => b.storeId === sid);
        const storeCashierBonuses = cashierBonusDetails.filter(b => b.storeId === sid);
        return {
          storeId: sid,
          storeName: storeNames[sid],
          vendorTotal: customRound(storeBonuses.filter(b => b.role === 'vendedor').reduce((sum, b) => sum + b.bonusValue, 0)),
          managerTotal: customRound(storeBonuses.filter(b => b.role === 'gerente').reduce((sum, b) => sum + b.bonusValue, 0)),
          cashierTotal: customRound(storeCashierBonuses.reduce((sum, b) => sum + b.bonusValue, 0)),
          total: customRound(
            storeBonuses.reduce((sum, b) => sum + b.bonusValue, 0) +
            storeCashierBonuses.reduce((sum, b) => sum + b.bonusValue, 0)
          ),
        };
      });

      res.json({
        period: {
          start: prevWeekStart,
          end: prevWeekEnd,
          paymentDate: formatDate(getCurrentMonday(localNow)), // This Monday
        },
        salesGoals: bonusDetails,
        cashierGoals: cashierBonusDetails,
        totals: {
          vendorTotal: customRound(vendorTotal),
          managerTotal: customRound(managerTotal),
          cashierTotal: customRound(cashierTotal),
          grandTotal: customRound(grandTotal),
        },
        byStore,
      });
    } catch (error: any) {
      console.error('Error calculating payment summary:', error);
      res.status(500).json({ 
        error: "Erro ao calcular resumo de pagamento",
        message: error.message 
      });
    }
  });

  // Financial daily revenue comparison endpoint
  app.get("/api/financial/daily-revenue", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'financeiro')) {
        return res.status(403).json({ error: "Sem permissão - apenas administrador e financeiro" });
      }

      const { storeId, month, year, compareYears } = req.query;
      
      const now = new Date();
      const currentMonth = month ? parseInt(month as string) : now.getMonth() + 1;
      const currentYear = year ? parseInt(year as string) : now.getFullYear();
      
      let yearsToCompare: number[] = [];
      if (compareYears) {
        if (typeof compareYears === 'string') {
          yearsToCompare = compareYears.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
        }
      }

      const results = await storage.getDailyRevenueComparison({
        storeId: storeId as string || 'todas',
        month: currentMonth,
        year: currentYear,
        compareYears: yearsToCompare,
      });

      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      res.json({
        period: {
          month: currentMonth,
          monthName: monthNames[currentMonth - 1],
          year: currentYear,
          compareYears: yearsToCompare,
        },
        storeId: storeId || 'todas',
        series: results,
      });
    } catch (error: any) {
      console.error('Error fetching daily revenue:', error);
      res.status(500).json({ 
        error: "Erro ao buscar receita diária",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/stores", async (req, res) => {
    try {
      const stores = dapicService.getAvailableStores();
      res.json(stores);
    } catch (error: any) {
      console.error('Error fetching available stores:', error);
      res.status(500).json({ 
        error: "Failed to fetch available stores",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/clientes", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getClientes(storeId, {
        DataInicial: (DataInicial as string) || "2020-01-01",
        DataFinal: (DataFinal as string) || formatDate(today),
        Pagina: Pagina ? parseInt(Pagina as string) : undefined,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : undefined,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching clients from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch clients from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/clientes/:id", async (req, res) => {
    try {
      const { storeId, id } = req.params;
      const cliente = await dapicService.getCliente(storeId, parseInt(id));
      res.json(cliente);
    } catch (error: any) {
      console.error('Error fetching client from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch client from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/orcamentos", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getOrcamentos(storeId, {
        DataInicial: (DataInicial as string) || "2020-01-01",
        DataFinal: (DataFinal as string) || formatDate(today),
        Pagina: Pagina ? parseInt(Pagina as string) : undefined,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : undefined,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching orders from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch orders from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/orcamentos/:id", async (req, res) => {
    try {
      const { storeId, id } = req.params;
      const orcamento = await dapicService.getOrcamento(storeId, parseInt(id));
      res.json(orcamento);
    } catch (error: any) {
      console.error('Error fetching order from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch order from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/vendaspdv", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, FiltrarPor, Status, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const validateISODate = (dateStr: string): string => {
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateStr)) {
          throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
        }
        return dateStr;
      };
      
      const dataInicial = DataInicial ? validateISODate(DataInicial as string) : formatDate(thirtyDaysAgo);
      const dataFinal = DataFinal ? validateISODate(DataFinal as string) : formatDate(today);
      
      const result = await dapicService.getVendasPDV(storeId, {
        DataInicial: dataInicial,
        DataFinal: dataFinal,
        FiltrarPor: (FiltrarPor as string) || '0',
        Status: (Status as string) || '1',
        Pagina: Pagina ? parseInt(Pagina as string) : 1,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : 200,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching PDV sales from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch PDV sales from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/produtos", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getProdutos(storeId, {
        DataInicial: (DataInicial as string) || "2020-01-01",
        DataFinal: (DataFinal as string) || formatDate(today),
        Pagina: Pagina ? parseInt(Pagina as string) : undefined,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : undefined,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching products from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch products from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/produtos/:id", async (req, res) => {
    try {
      const { storeId, id } = req.params;
      const produto = await dapicService.getProduto(storeId, parseInt(id));
      res.json(produto);
    } catch (error: any) {
      console.error('Error fetching product from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch product from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/contas-pagar", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getContasPagar(storeId, {
        DataInicial: (DataInicial as string) || "2020-01-01",
        DataFinal: (DataFinal as string) || formatDate(today),
        Pagina: Pagina ? parseInt(Pagina as string) : undefined,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : undefined,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching bills from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch bills from Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/dapic/:storeId/contas-receber", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getContasReceber(storeId, {
        DataInicial: (DataInicial as string) || "2020-01-01",
        DataFinal: (DataFinal as string) || formatDate(today),
        Pagina: Pagina ? parseInt(Pagina as string) : undefined,
        RegistrosPorPagina: RegistrosPorPagina ? parseInt(RegistrosPorPagina as string) : undefined,
      }) as any;
      
      if (storeId === 'todas') {
        res.json({
          stores: result.data,
          errors: result.errors,
        });
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error fetching receivables from Dapic:', error);
      res.status(500).json({ 
        error: "Failed to fetch receivables from Dapic",
        message: error.message 
      });
    }
  });

  app.post("/api/sales/sync", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'administrador' && user.role !== 'gerente')) {
        return res.status(403).json({ error: "Sem permissão para sincronizar vendas" });
      }

      const syncSchema = z.object({
        storeId: z.enum(["saron1", "saron2", "saron3", "todas"]).optional(),
        startDate: z.string(),
        endDate: z.string(),
      });

      const { storeId, startDate, endDate } = syncSchema.parse(req.body);

      let results;
      if (storeId === "todas" || !storeId) {
        results = await salesSyncService.syncAllStores(startDate, endDate);
      } else {
        const result = await salesSyncService.syncStore(storeId, startDate, endDate);
        results = [result];
      }

      const allSuccess = results.every(r => r.success);
      const totalSales = results.reduce((sum, r) => sum + r.salesCount, 0);

      res.json({
        success: allSuccess,
        results,
        totalSales,
        message: `Sincronização concluída: ${totalSales} vendas processadas`,
      });
    } catch (error: any) {
      console.error('Error syncing sales:', error);
      res.status(500).json({ 
        error: "Erro ao sincronizar vendas",
        message: error.message 
      });
    }
  });

  // TEMPORARY: Endpoint to sync 2024 data without auth (REMOVE AFTER USE)
  // Additive sync for 2024 - won't delete existing data, safe to interrupt
  app.post("/api/sales/sync/2024-fix", async (req, res) => {
    try {
      console.log('[API] Iniciando sincronização ADITIVA de 2024...');
      
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      res.json({
        message: "Sincronização ADITIVA de 2024 iniciada. Não perde dados existentes.",
        startDate,
        endDate,
      });

      // Run additive sync asynchronously - safe to interrupt
      (async () => {
        const stores = ['saron1', 'saron2', 'saron3'];
        for (const store of stores) {
          console.log(`[2024-FIX-ADDITIVE] Sincronizando ${store}...`);
          try {
            const result = await salesSyncService.syncStoreAdditive(store, startDate, endDate);
            console.log(`[2024-FIX-ADDITIVE] ${store}: ${result.success ? 'OK' : 'ERRO'} - ${result.salesCount} novas vendas`);
          } catch (error: any) {
            console.error(`[2024-FIX-ADDITIVE] ${store}: ERRO - ${error.message}`);
          }
        }
        console.log('[2024-FIX-ADDITIVE] Sincronização de 2024 concluída!');
      })();
    } catch (error: any) {
      console.error('Error syncing 2024:', error);
      res.status(500).json({ 
        error: "Erro ao iniciar sincronização de 2024",
        message: error.message 
      });
    }
  });

  // Internal endpoint to sync historical data with secret token
  app.post("/api/sales/sync/historical", async (req, res) => {
    try {
      const { year, secret } = req.body;
      
      // Require secret token for security
      const SYNC_SECRET = process.env.SYNC_SECRET || 'saron-sync-2023-secure';
      if (secret !== SYNC_SECRET) {
        return res.status(401).json({ error: "Token inválido" });
      }
      
      if (!year || year < 2020 || year > 2025) {
        return res.status(400).json({ error: "Ano inválido (2020-2025)" });
      }
      
      console.log(`[API] Iniciando sincronização ADITIVA de ${year}...`);
      
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      res.json({
        message: `Sincronização ADITIVA de ${year} iniciada. Não perde dados existentes.`,
        startDate,
        endDate,
      });

      // Run additive sync asynchronously - safe to interrupt
      (async () => {
        const stores = ['saron1', 'saron2', 'saron3'];
        for (const store of stores) {
          console.log(`[${year}-FIX-ADDITIVE] Sincronizando ${store}...`);
          try {
            const result = await salesSyncService.syncStoreAdditive(store, startDate, endDate);
            console.log(`[${year}-FIX-ADDITIVE] ${store}: ${result.success ? 'OK' : 'ERRO'} - ${result.salesCount} novas vendas`);
          } catch (error: any) {
            console.error(`[${year}-FIX-ADDITIVE] ${store}: ERRO - ${error.message}`);
          }
        }
        console.log(`[${year}-FIX-ADDITIVE] Sincronização de ${year} concluída!`);
      })();
    } catch (error: any) {
      console.error('Error syncing historical data:', error);
      res.status(500).json({ 
        error: "Erro ao iniciar sincronização histórica",
        message: error.message 
      });
    }
  });

  // Endpoint to force sync today's sales with secret token (no auth required)
  app.post("/api/sales/sync/today", async (req, res) => {
    try {
      const { secret } = req.body;
      
      // Require secret token for security
      const SYNC_SECRET = process.env.SYNC_SECRET || 'saron-sync-2023-secure';
      if (secret !== SYNC_SECRET) {
        return res.status(401).json({ error: "Token inválido" });
      }
      
      // Get today's date in São Paulo timezone
      const now = new Date();
      const spOffset = -3 * 60; // UTC-3
      const localOffset = now.getTimezoneOffset();
      const spTime = new Date(now.getTime() + (localOffset + spOffset) * 60 * 1000);
      const today = spTime.toISOString().split('T')[0];
      
      console.log(`[SYNC-TODAY] Iniciando sincronização forçada de ${today}...`);
      
      const stores = ['saron1', 'saron2', 'saron3'];
      const results: Array<{
        store: string;
        success: boolean;
        salesCount: number;
        error?: string;
      }> = [];
      
      for (const store of stores) {
        try {
          // Use syncStore (not additive) to replace all sales for today
          const result = await salesSyncService.syncStore(store, today, today);
          results.push({
            store,
            success: result.success,
            salesCount: result.salesCount,
            error: result.error,
          });
          console.log(`[SYNC-TODAY] ${store}: ${result.success ? 'OK' : 'ERRO'} - ${result.salesCount} vendas`);
        } catch (error: any) {
          results.push({
            store,
            success: false,
            salesCount: 0,
            error: error.message,
          });
          console.error(`[SYNC-TODAY] ${store}: ERRO - ${error.message}`);
        }
      }
      
      const totalSynced = results.reduce((sum, r) => sum + r.salesCount, 0);
      const allSuccess = results.every(r => r.success);
      
      console.log(`[SYNC-TODAY] Concluído: ${totalSynced} vendas processadas`);
      
      res.json({
        success: allSuccess,
        date: today,
        totalSynced,
        results,
        message: `Sincronização de ${today} concluída: ${totalSynced} vendas`,
      });
    } catch (error: any) {
      console.error('Error syncing today:', error);
      res.status(500).json({ 
        error: "Erro ao sincronizar vendas de hoje",
        message: error.message 
      });
    }
  });

  // Endpoint to sync a specific month for a specific store (faster, avoids timeout)
  app.post("/api/sales/sync/month", async (req, res) => {
    try {
      const { storeId, year, month } = req.body;
      
      if (!storeId || !year || !month) {
        return res.status(400).json({ error: "storeId, year e month são obrigatórios" });
      }
      
      const validStores = ['saron1', 'saron2', 'saron3'];
      if (!validStores.includes(storeId)) {
        return res.status(400).json({ error: "storeId inválido" });
      }
      
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2025) {
        return res.status(400).json({ error: "Ano inválido" });
      }
      
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: "Mês inválido (1-12)" });
      }
      
      const monthStr = String(monthNum).padStart(2, '0');
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      
      const startDate = `${yearNum}-${monthStr}-01`;
      const endDate = `${yearNum}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      
      console.log(`[MONTH-SYNC] Iniciando: ${storeId} ${monthStr}/${yearNum} (${startDate} a ${endDate})`);
      
      const result = await salesSyncService.syncStoreAdditive(storeId, startDate, endDate);
      
      console.log(`[MONTH-SYNC] Concluído: ${storeId} ${monthStr}/${yearNum} - ${result.salesCount} novas vendas`);
      
      res.json({
        success: result.success,
        storeId,
        month: monthNum,
        year: yearNum,
        startDate,
        endDate,
        newSalesCount: result.salesCount,
        error: result.error,
      });
    } catch (error: any) {
      console.error('[MONTH-SYNC] Erro:', error);
      res.status(500).json({ 
        error: "Erro ao sincronizar mês",
        message: error.message 
      });
    }
  });

  app.post("/api/sales/sync/full", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'administrador') {
        return res.status(403).json({ error: "Apenas administradores podem fazer sincronização completa" });
      }

      console.log('[API] Iniciando sincronização completa do histórico...');
      
      const results = await salesSyncService.syncFullHistory();
      
      const allSuccess = results.every(r => r.success);
      const totalSales = results.reduce((sum, r) => sum + r.salesCount, 0);

      res.json({
        success: allSuccess,
        results,
        totalSales,
        message: `Sincronização completa concluída: ${totalSales} vendas desde janeiro/2024`,
      });
    } catch (error: any) {
      console.error('Error syncing full history:', error);
      res.status(500).json({ 
        error: "Erro ao sincronizar histórico completo",
        message: error.message 
      });
    }
  });

  app.get("/api/sales/sync/status", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { storeId, startDate, endDate } = req.query;
      
      if (!storeId || !startDate || !endDate) {
        return res.status(400).json({ error: "storeId, startDate e endDate são obrigatórios" });
      }

      const status = salesSyncService.getSyncStatus(
        storeId as string,
        startDate as string,
        endDate as string
      );

      res.json(status || { status: 'not_started' });
    } catch (error: any) {
      console.error('Error getting sync status:', error);
      res.status(500).json({ 
        error: "Erro ao buscar status da sincronização",
        message: error.message 
      });
    }
  });

  // Endpoint to check sync discrepancies for last N days (admin only)
  app.get("/api/sales/sync/check", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
      }

      const days = parseInt(req.query.days as string) || 10;
      const stores = ['saron1', 'saron2', 'saron3'];
      
      // Generate date range for last N days
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // Adjust to Brazil timezone (UTC-3)
        const brazilOffset = -3 * 60;
        const utcOffset = date.getTimezoneOffset();
        const brazilTime = new Date(date.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
        dates.push(brazilTime.toISOString().split('T')[0]);
      }

      const discrepancies: Array<{
        date: string;
        store: string;
        localCount: number;
        localTotal: number;
        dapicCount: number;
        dapicTotal: number;
        countDiff: number;
        totalDiff: number;
      }> = [];

      // Check each store and date
      for (const store of stores) {
        for (const date of dates) {
          try {
            // Get local counts
            const localSales = await storage.getSales({ storeId: store, startDate: date, endDate: date });
            const localCount = localSales.length;
            const localTotal = localSales.reduce((sum: number, s) => sum + (Number(s.totalValue) || 0), 0);

            // Get Dapic counts (single page just to get totals)
            const dapicResponse = await dapicService.getVendasPDV(store, {
              DataInicial: date,
              DataFinal: date,
              Pagina: 1,
              RegistrosPorPagina: 1,
            }) as any;

            const dapicCount = dapicResponse?.TotalRegistros || 0;
            // Estimate total from Dapic (would need full fetch for exact total)
            
            const countDiff = dapicCount - localCount;

            if (countDiff !== 0) {
              discrepancies.push({
                date,
                store,
                localCount,
                localTotal: Math.round(localTotal * 100) / 100,
                dapicCount,
                dapicTotal: 0, // Would require full fetch
                countDiff,
                totalDiff: 0,
              });
            }
          } catch (error: any) {
            console.error(`Error checking ${store} for ${date}:`, error.message);
          }
        }
      }

      // Sort by date (most recent first) then by count difference
      discrepancies.sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return Math.abs(b.countDiff) - Math.abs(a.countDiff);
      });

      res.json({
        daysChecked: days,
        totalDiscrepancies: discrepancies.length,
        discrepancies,
        checkedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error checking sync discrepancies:', error);
      res.status(500).json({ 
        error: "Erro ao verificar discrepâncias",
        message: error.message 
      });
    }
  });

  // Endpoint to resync specific dates with discrepancies (admin only)
  app.post("/api/sales/sync/resync", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
      }

      const { dates, stores } = req.body;
      
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: "dates é obrigatório (array de datas)" });
      }

      const targetStores = stores && Array.isArray(stores) && stores.length > 0 
        ? stores 
        : ['saron1', 'saron2', 'saron3'];

      const results: Array<{
        date: string;
        store: string;
        success: boolean;
        salesCount: number;
        error?: string;
      }> = [];

      for (const date of dates) {
        for (const store of targetStores) {
          try {
            const result = await salesSyncService.syncStore(store, date, date);
            results.push({
              date,
              store,
              success: result.success,
              salesCount: result.salesCount,
              error: result.error,
            });
          } catch (error: any) {
            results.push({
              date,
              store,
              success: false,
              salesCount: 0,
              error: error.message,
            });
          }
        }
      }

      const totalSynced = results.reduce((sum, r) => sum + r.salesCount, 0);
      const allSuccess = results.every(r => r.success);

      res.json({
        success: allSuccess,
        totalSynced,
        results,
        message: `Resincronização concluída: ${totalSynced} vendas processadas`,
      });
    } catch (error: any) {
      console.error('Error resyncing:', error);
      res.status(500).json({ 
        error: "Erro ao resincronizar",
        message: error.message 
      });
    }
  });

  // Debug endpoint to see Dapic sales structure
  app.get("/api/debug/dapic-sale-structure", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
      }

      const { storeId, date } = req.query;
      const targetStoreId = (storeId as string) || 'saron1';
      const targetDate = (date as string) || new Date().toISOString().split('T')[0];

      const response = await dapicService.getVendasPDV(targetStoreId, {
        DataInicial: targetDate,
        DataFinal: targetDate,
        Pagina: 1,
        RegistrosPorPagina: 5,
      }) as any;

      const salesData = response?.Dados || [];
      
      res.json({
        message: `Estrutura de ${salesData.length} vendas do Dapic`,
        sampleSales: salesData.slice(0, 3).map((sale: any) => ({
          allKeys: Object.keys(sale),
          sampleData: sale,
        })),
      });
    } catch (error: any) {
      console.error('Error debugging Dapic structure:', error);
      res.status(500).json({ 
        error: "Erro ao buscar estrutura do Dapic",
        message: error.message 
      });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { storeId, sellerName, startDate, endDate } = req.query;

      const sales = await storage.getSales({
        storeId: storeId as string,
        sellerName: sellerName as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json(sales);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      res.status(500).json({ 
        error: "Erro ao buscar vendas",
        message: error.message 
      });
    }
  });

  app.get("/api/sales/summary", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { storeId } = req.query;
      
      // Usar fuso horário do Brasil (UTC-3)
      const getBrazilDate = () => {
        const now = new Date();
        const brazilOffset = -3 * 60; // UTC-3 em minutos
        const utcOffset = now.getTimezoneOffset();
        return new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
      };
      
      const now = getBrazilDate();
      const todayStr = now.toISOString().split('T')[0];
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      // Vendedores da saron2 veem vendas da loja toda (meta conjunta)
      const isSaron2Seller = user.role === 'vendedor' && user.storeId === 'saron2';
      const sellerFilter = (user.role === 'vendedor' && !isSaron2Seller) ? user.fullName : undefined;
      
      // Tratar storeId vazio ou undefined como "todas"
      const storeFilter = (storeId && storeId !== 'todas' && storeId !== '') ? storeId as string : undefined;

      console.log('[SalesSummary] Filters:', { 
        storeId, 
        storeFilter, 
        sellerFilter, 
        todayStr, 
        weekStartStr, 
        weekEndStr,
        userRole: user.role,
        isSaron2Seller
      });

      const [todaySales, weekSales, monthSales] = await Promise.all([
        storage.getSales({
          storeId: storeFilter,
          sellerName: sellerFilter,
          startDate: todayStr,
          endDate: todayStr,
        }),
        storage.getSales({
          storeId: storeFilter,
          sellerName: sellerFilter,
          startDate: weekStartStr,
          endDate: weekEndStr,
        }),
        storage.getSales({
          storeId: storeFilter,
          sellerName: sellerFilter,
          startDate: monthStartStr,
          endDate: monthEndStr,
        }),
      ]);

      const sumSales = (salesList: typeof todaySales) => 
        salesList.reduce((sum, sale) => {
          const value = parseFloat(sale.totalValue);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

      res.json({
        today: sumSales(todaySales),
        week: sumSales(weekSales),
        month: sumSales(monthSales),
        todayCount: todaySales.length,
        weekCount: weekSales.length,
        monthCount: monthSales.length,
        periods: {
          today: todayStr,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          monthStart: monthStartStr,
          monthEnd: monthEndStr,
        }
      });
    } catch (error: any) {
      console.error('Error fetching sales summary:', error);
      res.status(500).json({ 
        error: "Erro ao buscar resumo de vendas",
        message: error.message 
      });
    }
  });

  return httpServer;
}
