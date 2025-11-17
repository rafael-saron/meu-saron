import axios from 'axios';

const DAPIC_API_BASE_URL = 'https://api.dapic.com.br';

interface DapicAuthResponse {
  access_token: string;
  expires_in: string;
  token_type: string;
}

interface StoreCredentials {
  empresa: string;
  token: string;
}

const STORES: Record<string, StoreCredentials> = {
  'saron1': {
    empresa: process.env.DAPIC_EMPRESA || '',
    token: process.env.DAPIC_TOKEN_INTEGRACAO || '',
  },
  'saron2': {
    empresa: process.env.DAPIC_EMPRESA_SARON2 || '',
    token: process.env.DAPIC_TOKEN_INTEGRACAO_SARON2 || '',
  },
  'saron3': {
    empresa: process.env.DAPIC_EMPRESA_SARON3 || '',
    token: process.env.DAPIC_TOKEN_INTEGRACAO_SARON3 || '',
  },
};

class DapicService {
  private accessTokens: Map<string, string> = new Map();
  private tokenExpirations: Map<string, number> = new Map();

  constructor() {
    const missingStores: string[] = [];
    Object.entries(STORES).forEach(([storeId, creds]) => {
      if (!creds.empresa || !creds.token) {
        missingStores.push(storeId);
      }
    });
    
    if (missingStores.length > 0) {
      console.warn(`Dapic credentials not configured for stores: ${missingStores.join(', ')}`);
    }
  }

  async getAccessToken(storeId: string): Promise<string> {
    const credentials = STORES[storeId];
    if (!credentials || !credentials.empresa || !credentials.token) {
      throw new Error(`Dapic credentials not configured for store: ${storeId}`);
    }

    const now = Date.now();
    const cachedToken = this.accessTokens.get(storeId);
    const expiration = this.tokenExpirations.get(storeId) || 0;
    
    if (cachedToken && expiration > now) {
      return cachedToken;
    }

    try {
      const response = await axios.post<DapicAuthResponse>(
        `${DAPIC_API_BASE_URL}/autenticacao/v1/login`,
        {
          Empresa: credentials.empresa,
          TokenIntegracao: credentials.token,
        }
      );

      const accessToken = response.data.access_token;
      const expiresInSeconds = parseInt(response.data.expires_in);
      const tokenExpiresAt = now + (expiresInSeconds - 300) * 1000;

      this.accessTokens.set(storeId, accessToken);
      this.tokenExpirations.set(storeId, tokenExpiresAt);

      return accessToken;
    } catch (error) {
      console.error(`Error authenticating with Dapic for store ${storeId}:`, error);
      throw new Error(`Failed to authenticate with Dapic API for store ${storeId}`);
    }
  }

  async makeRequest<T>(storeId: string, endpoint: string, params?: Record<string, any>): Promise<T> {
    const token = await this.getAccessToken(storeId);
    
    try {
      const response = await axios.get<T>(`${DAPIC_API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error) {
      console.error(`Error calling Dapic endpoint ${endpoint} for store ${storeId}:`, error);
      throw error;
    }
  }

  async makeRequestAllStores<T>(endpoint: string, params?: Record<string, any>): Promise<{
    data: Record<string, T>;
    errors: Record<string, string>;
  }> {
    const data: Record<string, T> = {};
    const errors: Record<string, string> = {};
    const storeIds = Object.keys(STORES).filter(id => STORES[id].empresa && STORES[id].token);
    
    await Promise.all(
      storeIds.map(async (storeId) => {
        try {
          data[storeId] = await this.makeRequest<T>(storeId, endpoint, params);
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          console.error(`Error fetching data from store ${storeId}:`, errorMsg);
          errors[storeId] = errorMsg;
        }
      })
    );
    
    return { data, errors };
  }

  async getClientes(storeId: string, params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }): Promise<any> {
    // Clientes são compartilhados entre todas as lojas no Dapic
    // Para "todas", buscar de uma loja e replicar resultado para todas (evita chamadas duplicadas)
    if (storeId === 'todas') {
      const availableStores = this.getAvailableStores();
      if (availableStores.length === 0) {
        return { data: {}, errors: { todas: 'Nenhuma loja configurada' } };
      }
      
      // Tentar buscar de cada loja até conseguir
      let canonicalData: any = null;
      const errors: Record<string, string> = {};
      
      // Remover Pagina do params para forçar paginação automática completa
      const paramsWithoutPagina = params ? { ...params } : {};
      delete paramsWithoutPagina.Pagina;
      
      for (const store of availableStores) {
        try {
          canonicalData = await this.getClientes(store, paramsWithoutPagina);
          break; // Sucesso, não precisa tentar outras lojas
        } catch (error: any) {
          errors[store] = error.message || 'Erro ao buscar clientes';
        }
      }
      
      if (!canonicalData) {
        return { data: {}, errors };
      }
      
      // Replicar dados para todas as lojas disponíveis (manter contrato de resposta)
      const data: Record<string, any> = {};
      for (const store of availableStores) {
        data[store] = canonicalData;
      }
      
      // Preservar erros de lojas que falharam antes de conseguir sucesso
      return { data, errors };
    }
    
    // Se o usuário especificou uma página, não fazer paginação automática
    if (params?.Pagina) {
      return this.makeRequest(storeId, '/v1/clientes', params);
    }
    
    // Paginação automática para obter todos os registros
    const requestParams = {
      ...params,
      RegistrosPorPagina: params?.RegistrosPorPagina || 200,
    };
    
    const registrosPorPagina = requestParams.RegistrosPorPagina;
    let paginaAtual = 1;
    let todosResultados: any[] = [];
    let ultimoResultado: any = null;
    let continuar = true;
    
    while (continuar) {
      const resultado = await this.makeRequest(storeId, '/v1/clientes', {
        ...requestParams,
        Pagina: paginaAtual,
      }) as any;
      
      ultimoResultado = resultado;
      const dados = resultado?.Dados || [];
      todosResultados = todosResultados.concat(dados);
      
      if (dados.length < registrosPorPagina) {
        continuar = false;
      } else {
        paginaAtual++;
      }
      
      // Limite de segurança: não buscar mais de 100 páginas (20.000 registros)
      if (paginaAtual > 100) {
        console.log(`Aviso: Limite de paginação atingido (100 páginas) para clientes`);
        continuar = false;
      }
    }
    
    return {
      ...ultimoResultado,
      Dados: todosResultados,
    };
  }

  async getCliente(storeId: string, id: number) {
    return this.makeRequest(storeId, `/v1/clientes/${id}`);
  }

  async getOrcamentos(storeId: string, params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }) {
    if (storeId === 'todas') {
      return this.makeRequestAllStores('/v1/orcamentos', params);
    }
    return this.makeRequest(storeId, '/v1/orcamentos', params);
  }

  async getOrcamento(storeId: string, id: number) {
    return this.makeRequest(storeId, `/v1/orcamentos/${id}`);
  }

  async getVendasPDV(storeId: string, params?: {
    DataInicial?: string;
    DataFinal?: string;
    FiltrarPor?: string;
    Status?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }) {
    const requestParams = {
      ...params,
      FiltrarPor: params?.FiltrarPor || '0',
      Status: params?.Status || '1',
      RegistrosPorPagina: params?.RegistrosPorPagina || 200,
    };
    
    // Se pedir "todas", buscar de cada loja em paralelo mantendo dados separados
    if (storeId === 'todas') {
      const data: Record<string, any> = {};
      const errors: Record<string, string> = {};
      const availableStores = this.getAvailableStores();
      
      await Promise.all(
        availableStores.map(async (store) => {
          try {
            data[store] = await this.getVendasPDV(store, params);
          } catch (error: any) {
            const errorMsg = error.message || 'Unknown error';
            console.error(`Erro ao buscar vendas PDV da loja ${store}:`, errorMsg);
            errors[store] = errorMsg;
          }
        })
      );
      
      return { data, errors };
    }
    
    // Implementar paginação automática para obter todos os registros de uma loja
    const registrosPorPagina = requestParams.RegistrosPorPagina;
    let paginaAtual = params?.Pagina || 1;
    let todosResultados: any[] = [];
    let continuar = true;
    let ultimoResultado: any = null;
    
    while (continuar) {
      const resultado = await this.makeRequest(storeId, '/v1/vendaspdv', {
        ...requestParams,
        Pagina: paginaAtual,
      }) as any;
      
      ultimoResultado = resultado;
      const dados = resultado?.Dados || [];
      todosResultados = todosResultados.concat(dados);
      
      // Se recebeu menos registros que o máximo, chegamos na última página
      if (dados.length < registrosPorPagina) {
        continuar = false;
      } else {
        paginaAtual++;
      }
      
      // Limite de segurança: não buscar mais de 50 páginas (10.000 registros)
      if (paginaAtual > 50) {
        console.log(`Aviso: Limite de paginação atingido (50 páginas = 10.000 registros) para vendas PDV da loja ${storeId}`);
        continuar = false;
      }
    }

    
    return {
      ...ultimoResultado,
      Dados: todosResultados,
    };
  }

  async getProdutos(storeId: string, params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }): Promise<any> {
    // Produtos são compartilhados entre todas as lojas no Dapic
    // Para "todas", buscar de uma loja e replicar resultado para todas (evita chamadas duplicadas)
    if (storeId === 'todas') {
      const availableStores = this.getAvailableStores();
      if (availableStores.length === 0) {
        return { data: {}, errors: { todas: 'Nenhuma loja configurada' } };
      }
      
      // Tentar buscar de cada loja até conseguir
      let canonicalData: any = null;
      const errors: Record<string, string> = {};
      
      // Remover Pagina do params para forçar paginação automática completa
      const paramsWithoutPagina = params ? { ...params } : {};
      delete paramsWithoutPagina.Pagina;
      
      for (const store of availableStores) {
        try {
          canonicalData = await this.getProdutos(store, paramsWithoutPagina);
          break; // Sucesso, não precisa tentar outras lojas
        } catch (error: any) {
          errors[store] = error.message || 'Erro ao buscar produtos';
        }
      }
      
      if (!canonicalData) {
        return { data: {}, errors };
      }
      
      // Replicar dados para todas as lojas disponíveis (manter contrato de resposta)
      const data: Record<string, any> = {};
      for (const store of availableStores) {
        data[store] = canonicalData;
      }
      
      // Preservar erros de lojas que falharam antes de conseguir sucesso
      return { data, errors };
    }
    
    // Se o usuário especificou uma página, não fazer paginação automática
    if (params?.Pagina) {
      return this.makeRequest(storeId, '/v1/produtos', params);
    }
    
    // Paginação automática para obter todos os registros
    const requestParams = {
      ...params,
      RegistrosPorPagina: params?.RegistrosPorPagina || 200,
    };
    
    const registrosPorPagina = requestParams.RegistrosPorPagina;
    let paginaAtual = 1;
    let todosResultados: any[] = [];
    let ultimoResultado: any = null;
    let continuar = true;
    
    while (continuar) {
      const resultado = await this.makeRequest(storeId, '/v1/produtos', {
        ...requestParams,
        Pagina: paginaAtual,
      }) as any;
      
      ultimoResultado = resultado;
      const dados = resultado?.Dados || [];
      todosResultados = todosResultados.concat(dados);
      
      if (dados.length < registrosPorPagina) {
        continuar = false;
      } else {
        paginaAtual++;
      }
      
      // Limite de segurança: não buscar mais de 10 páginas (2.000 registros)
      if (paginaAtual > 10) {
        console.log(`Aviso: Limite de paginação atingido (10 páginas) para produtos`);
        continuar = false;
      }
    }
    
    return {
      ...ultimoResultado,
      Dados: todosResultados,
    };
  }

  async getProduto(storeId: string, id: number) {
    return this.makeRequest(storeId, `/v1/produtos/${id}`);
  }

  async getContasPagar(storeId: string, params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }) {
    if (storeId === 'todas') {
      return this.makeRequestAllStores('/v1/contas-pagar', params);
    }
    return this.makeRequest(storeId, '/v1/contas-pagar', params);
  }

  getAvailableStores(): string[] {
    return Object.keys(STORES).filter(id => STORES[id].empresa && STORES[id].token);
  }
}

export const dapicService = new DapicService();
