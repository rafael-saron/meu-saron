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
      
      const user = await storage.getUserByUsername(username);
      
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

      const salesData = await dapicService.getVendasPDV(targetStoreId, {
        DataInicial: targetWeekStart,
        DataFinal: targetWeekEnd,
      }) as any;

      let totalSales = 0;
      
      if (targetStoreId === 'todas' && salesData.data) {
        Object.values(salesData.data).forEach((storeData: any) => {
          const sales = storeData?.Resultado || storeData?.Dados || [];
          sales.forEach((sale: any) => {
            const value = parseFloat(sale.ValorLiquido || sale.ValorTotal || 0);
            if (!isNaN(value)) {
              totalSales += value;
            }
          });
        });
      } else {
        const sales = salesData?.Resultado || salesData?.Dados || [];
        if (goal && goal.type === 'individual' && goal.sellerId) {
          const sellerUser = await storage.getUser(goal.sellerId);
          sales.forEach((sale: any) => {
            const salesperson = sale.NomeVendedor || sale.Vendedor;
            if (salesperson === sellerUser?.fullName) {
              const value = parseFloat(sale.ValorLiquido || sale.ValorTotal || 0);
              if (!isNaN(value)) {
                totalSales += value;
              }
            }
          });
        } else {
          sales.forEach((sale: any) => {
            const value = parseFloat(sale.ValorLiquido || sale.ValorTotal || 0);
            if (!isNaN(value)) {
              totalSales += value;
            }
          });
        }
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

  return httpServer;
}
