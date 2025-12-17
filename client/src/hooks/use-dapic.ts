import { useQuery } from "@tanstack/react-query";

export function useDapicStores() {
  return useQuery<string[]>({
    queryKey: ["/api/dapic/stores"],
    queryFn: async () => {
      const response = await fetch("/api/dapic/stores");
      if (!response.ok) throw new Error("Failed to fetch stores");
      return response.json();
    },
  });
}

export function useDapicClientes(storeId: string, params?: { Pagina?: number; RegistrosPorPagina?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["/api/dapic/clientes", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/clientes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch clients from Dapic");
      return response.json();
    },
    enabled: !!storeId && (params?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDapicOrcamentos(storeId: string, params?: { 
  DataInicial?: string; 
  DataFinal?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
}) {
  return useQuery({
    queryKey: ["/api/dapic/orcamentos", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/orcamentos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch orders from Dapic");
      return response.json();
    },
    enabled: !!storeId,
  });
}

export function useDapicVendasPDV(storeId: string, params?: { 
  DataInicial?: string; 
  DataFinal?: string;
  FiltrarPor?: string;
  Status?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["/api/dapic/vendaspdv", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.FiltrarPor) queryParams.append("FiltrarPor", params.FiltrarPor);
      if (params?.Status) queryParams.append("Status", params.Status);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/vendaspdv${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch PDV sales from Dapic");
      return response.json();
    },
    enabled: !!storeId && (params?.enabled !== false),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useDapicProdutos(storeId: string, params?: { Pagina?: number; RegistrosPorPagina?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["/api/dapic/produtos", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/produtos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch products from Dapic");
      return response.json();
    },
    enabled: !!storeId && (params?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDapicContasPagar(storeId: string, params?: {
  DataInicial?: string;
  DataFinal?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["/api/dapic/contas-pagar", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/contas-pagar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch bills from Dapic");
      return response.json();
    },
    enabled: !!storeId && (params?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDapicContasReceber(storeId: string, params?: {
  DataInicial?: string;
  DataFinal?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["/api/dapic/contas-receber", storeId, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/${storeId}/contas-receber${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch receivables from Dapic");
      return response.json();
    },
    enabled: !!storeId && (params?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}
