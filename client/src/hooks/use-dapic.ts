import { useQuery } from "@tanstack/react-query";

export function useDapicClientes(params?: { Pagina?: number; RegistrosPorPagina?: number }) {
  return useQuery({
    queryKey: ["/api/dapic/clientes", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/clientes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch clients from Dapic");
      return response.json();
    },
  });
}

export function useDapicOrcamentos(params?: { 
  DataInicial?: string; 
  DataFinal?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
}) {
  return useQuery({
    queryKey: ["/api/dapic/orcamentos", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/orcamentos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch orders from Dapic");
      return response.json();
    },
  });
}

export function useDapicProdutos(params?: { Pagina?: number; RegistrosPorPagina?: number }) {
  return useQuery({
    queryKey: ["/api/dapic/produtos", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/produtos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch products from Dapic");
      return response.json();
    },
  });
}

export function useDapicContasPagar(params?: {
  DataInicial?: string;
  DataFinal?: string;
  Pagina?: number;
  RegistrosPorPagina?: number;
}) {
  return useQuery({
    queryKey: ["/api/dapic/contas-pagar", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.DataInicial) queryParams.append("DataInicial", params.DataInicial);
      if (params?.DataFinal) queryParams.append("DataFinal", params.DataFinal);
      if (params?.Pagina) queryParams.append("Pagina", params.Pagina.toString());
      if (params?.RegistrosPorPagina) queryParams.append("RegistrosPorPagina", params.RegistrosPorPagina.toString());
      
      const url = `/api/dapic/contas-pagar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch bills from Dapic");
      return response.json();
    },
  });
}
