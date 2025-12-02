import { useState } from "react";
import { Plus, Search, Upload, KeyRound, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/use-users";
import { useUser } from "@/lib/user-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

const userFormSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
  fullName: z.string().min(3, "Nome completo obrigatório"),
  role: z.enum(["administrador", "gerente", "vendedor", "financeiro", "caixa"]),
  storeId: z.enum(["saron1", "saron2", "saron3"]).nullable().optional(),
  cpf: z.string().optional(),
  bonusPercentageAchieved: z.string().optional(),
  bonusPercentageNotAchieved: z.string().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

const roleLabels: Record<string, string> = {
  administrador: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  caixa: "Caixa",
};

const roleBadges: Record<string, string> = {
  administrador: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  gerente: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  vendedor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  financeiro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  caixa: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

export default function Usuarios() {
  const { user: currentUser } = useUser();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: "vendedor",
      storeId: null,
      cpf: "",
      bonusPercentageAchieved: "",
      bonusPercentageNotAchieved: "",
    },
  });

  const isAdmin = currentUser?.role === "administrador";

  const filteredUsers = users?.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      form.reset({
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role as any,
        storeId: user.storeId as any,
        cpf: "",
        bonusPercentageAchieved: user.bonusPercentageAchieved || "",
        bonusPercentageNotAchieved: user.bonusPercentageNotAchieved || "",
      });
    } else {
      setEditingUser(null);
      form.reset({
        username: "",
        email: "",
        password: "",
        fullName: "",
        role: "vendedor",
        storeId: null,
        cpf: "",
        bonusPercentageAchieved: "",
        bonusPercentageNotAchieved: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (data: UserFormData) => {
    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          data: {
            fullName: data.fullName,
            email: data.email,
            role: data.role,
            storeId: data.storeId || null,
            bonusPercentageAchieved: data.bonusPercentageAchieved || null,
            bonusPercentageNotAchieved: data.bonusPercentageNotAchieved || null,
          },
        });
        toast({
          title: "Usuário atualizado",
          description: "As informações foram salvas com sucesso.",
        });
      } else {
        await createUser.mutateAsync({
          username: data.username,
          email: data.email,
          password: data.password || "senha123",
          fullName: data.fullName,
          role: data.role,
          storeId: data.storeId || null,
          bonusPercentageAchieved: data.bonusPercentageAchieved || null,
          bonusPercentageNotAchieved: data.bonusPercentageNotAchieved || null,
        });
        toast({
          title: "Usuário criado",
          description: "O novo usuário foi criado com sucesso.",
        });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar usuário",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog || !newPassword) return;

    try {
      await updateUser.mutateAsync({
        id: resetPasswordDialog.id,
        data: { password: newPassword },
      });
      toast({
        title: "Senha redefinida",
        description: "A nova senha foi configurada com sucesso.",
      });
      setResetPasswordDialog(null);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao redefinir senha",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      await deleteUser.mutateAsync(userId);
      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido do sistema.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao excluir usuário",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6">
          <p className="text-muted-foreground">Acesso negado. Apenas administradores podem gerenciar usuários.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie acessos e permissões dos funcionários</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {user.avatar && <AvatarImage src={user.avatar} />}
                            <AvatarFallback className="text-sm">
                              {user.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{user.fullName}</p>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={roleBadges[user.role as keyof typeof roleBadges]}>
                          {roleLabels[user.role as keyof typeof roleLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "destructive"}>
                          {user.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setResetPasswordDialog(user)}
                            data-testid={`button-reset-password-${user.id}`}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize as informações do usuário"
                : "Preencha os dados para criar um novo acesso"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="João da Silva" {...field} data-testid="input-fullname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Usuário</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="joao.silva"
                        {...field}
                        disabled={!!editingUser}
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="joao@saron.com.br" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!editingUser && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Selecione uma função" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="gerente">Gerente</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="caixa">Caixa</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loja</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-store">
                          <SelectValue placeholder="Selecione uma loja (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="saron1">Saron 1</SelectItem>
                        <SelectItem value="saron2">Saron 2</SelectItem>
                        <SelectItem value="saron3">Saron 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Configure a loja principal do usuário (vendedores devem ter loja configurada)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(form.watch("role") === "vendedor" || form.watch("role") === "gerente") && (
                <>
                  <FormField
                    control={form.control}
                    name="bonusPercentageAchieved"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% Bônus (Meta Alcançada)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="Ex: 5.00"
                            {...field}
                            data-testid="input-bonus-achieved"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {form.watch("role") === "gerente" 
                            ? "Percentual sobre suas vendas + vendas da equipe que bateu meta"
                            : "Percentual de bônus sobre vendas quando a meta é atingida"
                          }
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bonusPercentageNotAchieved"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% Bônus (Meta Não Alcançada)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="Ex: 2.50"
                            {...field}
                            data-testid="input-bonus-not-achieved"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {form.watch("role") === "gerente"
                            ? "Percentual sobre suas vendas quando a meta não é atingida"
                            : "Percentual de bônus sobre vendas quando a meta não é atingida"
                          }
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending} data-testid="button-save">
                  {editingUser ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPasswordDialog} onOpenChange={() => setResetPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Digite uma nova senha para {resetPasswordDialog?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nova Senha</label>
              <Input
                type="password"
                placeholder="••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog(null)} data-testid="button-cancel-reset">
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword || updateUser.isPending}
              data-testid="button-confirm-reset"
            >
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
