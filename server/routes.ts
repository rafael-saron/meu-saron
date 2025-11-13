import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { dapicService } from "./dapic";
import {
  insertChatMessageSchema,
  insertScheduleEventSchema,
  insertAnnouncementSchema,
  insertAnonymousMessageSchema,
  insertUserSchema,
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
      const validatedData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(validatedData);
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
        password: z.string().min(6).optional(),
        avatar: z.string().nullable().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedUser = await storage.updateUser(id, validatedData);
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

  const sendChatMessageHandler = async (req: express.Request, res: express.Response) => {
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
      const oneYearAgo = new Date();
      oneYearAgo.setDate(today.getDate() - 365);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getClientes(storeId, {
        DataInicial: (DataInicial as string) || formatDate(oneYearAgo),
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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getOrcamentos(storeId, {
        DataInicial: (DataInicial as string) || formatDate(thirtyDaysAgo),
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

  app.get("/api/dapic/:storeId/produtos", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { DataInicial, DataFinal, Pagina, RegistrosPorPagina } = req.query;
      
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setDate(today.getDate() - 365);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getProdutos(storeId, {
        DataInicial: (DataInicial as string) || formatDate(oneYearAgo),
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
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(today.getDate() - 90);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      const result = await dapicService.getContasPagar(storeId, {
        DataInicial: (DataInicial as string) || formatDate(ninetyDaysAgo),
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
