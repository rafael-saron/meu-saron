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
import {
  insertChatMessageSchema,
  insertScheduleEventSchema,
  insertAnnouncementSchema,
  insertAnonymousMessageSchema,
  insertUserSchema,
  insertSalesGoalSchema,
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
      res.json(allUsers);
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
      const dataForStorage: Partial<typeof parsedData> = { ...parsedData };
      if (parsedData.bonusPercentageAchieved !== null && parsedData.bonusPercentageAchieved !== undefined) {
        dataForStorage.bonusPercentageAchieved = parsedData.bonusPercentageAchieved.toFixed(2) as any;
      }
      if (parsedData.bonusPercentageNotAchieved !== null && parsedData.bonusPercentageNotAchieved !== undefined) {
        dataForStorage.bonusPercentageNotAchieved = parsedData.bonusPercentageNotAchieved.toFixed(2) as any;
      }
      
      const updatedUser = await storage.updateUser(id, dataForStorage);
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
      const unreadCount = await storage.getUnreadCount(userId);
      
      res.json({ users: allUsers, unreadCount });
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
      const { userId, startDate, endDate } = req.query;
      const events = await storage.getScheduleEvents(
        userId as string | undefined,
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
      const validatedData = insertScheduleEventSchema.parse(req.body);
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
    } catch (error) {
      res.status(400).json({ error: "Invalid event data" });
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

      const { storeId, sellerId, weekStart, weekEnd, type, isActive } = req.query;
      
      const goals = await storage.getSalesGoals({
        storeId: storeId as string | undefined,
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
      const updatedGoal = await storage.updateSalesGoal(id, req.body);
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
      
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const dayMs = 1000 * 60 * 60 * 24;
      const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      
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
        return todayStr >= goal.weekStart && todayStr <= goal.weekEnd;
      });

      if (user.role === 'vendedor') {
        const vendorGoals = currentGoals.filter(goal => 
          goal.type === 'individual' && goal.sellerId === user.id
        );

        const goalsWithProgress = await Promise.all(vendorGoals.map(async (goal) => {
          const sales = await storage.getSales({
            storeId: goal.storeId,
            sellerName: user.fullName,
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
          const expectedPercentage = (elapsedDays / totalDays) * 100;
          const isOnTrack = percentage >= expectedPercentage;

          return {
            id: goal.id,
            storeId: goal.storeId,
            type: goal.type,
            period: goal.period,
            sellerId: goal.sellerId,
            sellerName: user.fullName,
            weekStart: goal.weekStart,
            weekEnd: goal.weekEnd,
            targetValue,
            currentValue: totalSales,
            percentage,
            expectedPercentage,
            isOnTrack,
            elapsedDays,
            totalDays,
          };
        }));

        return res.json(goalsWithProgress);
      }

      let relevantGoals = currentGoals;
      if (user.role === 'gerente') {
        relevantGoals = currentGoals.filter(goal => {
          if (storeId && storeId !== 'todas') {
            return goal.storeId === storeId && managerStoreIds.includes(goal.storeId);
          }
          return managerStoreIds.includes(goal.storeId);
        });
      } else if (user.role === 'administrador') {
        if (storeId && storeId !== 'todas') {
          relevantGoals = currentGoals.filter(goal => goal.storeId === storeId);
        }
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
          expectedPercentage = (elapsedDays / totalDays) * 100;
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
      
      const now = new Date();
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

      const sellerFilter = user.role === 'vendedor' ? user.fullName : undefined;
      const storeFilter = storeId as string;

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
