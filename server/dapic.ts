import axios from 'axios';

const DAPIC_API_BASE_URL = 'https://api.dapic.com.br';

interface DapicAuthResponse {
  access_token: string;
  expires_in: string;
  token_type: string;
}

class DapicService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    if (!process.env.DAPIC_EMPRESA || !process.env.DAPIC_TOKEN_INTEGRACAO) {
      console.warn('Dapic credentials not configured. API calls will fail.');
    }
  }

  async getAccessToken(): Promise<string> {
    if (!process.env.DAPIC_EMPRESA || !process.env.DAPIC_TOKEN_INTEGRACAO) {
      throw new Error('Dapic credentials not configured');
    }
    const now = Date.now();
    
    if (this.accessToken && this.tokenExpiresAt > now) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<DapicAuthResponse>(
        `${DAPIC_API_BASE_URL}/autenticacao/v1/login`,
        {
          Empresa: process.env.DAPIC_EMPRESA,
          TokenIntegracao: process.env.DAPIC_TOKEN_INTEGRACAO,
        }
      );

      this.accessToken = response.data.access_token;
      const expiresInSeconds = parseInt(response.data.expires_in);
      this.tokenExpiresAt = now + (expiresInSeconds - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Error authenticating with Dapic:', error);
      throw new Error('Failed to authenticate with Dapic API');
    }
  }

  async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get<T>(`${DAPIC_API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error) {
      console.error(`Error calling Dapic endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  async getClientes(params?: { Pagina?: number; RegistrosPorPagina?: number }) {
    return this.makeRequest('/v1/clientes', params);
  }

  async getCliente(id: number) {
    return this.makeRequest(`/v1/clientes/${id}`);
  }

  async getOrcamentos(params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }) {
    return this.makeRequest('/v1/orcamentos', params);
  }

  async getOrcamento(id: number) {
    return this.makeRequest(`/v1/orcamentos/${id}`);
  }

  async getProdutos(params?: { Pagina?: number; RegistrosPorPagina?: number }) {
    return this.makeRequest('/v1/produtos', params);
  }

  async getProduto(id: number) {
    return this.makeRequest(`/v1/produtos/${id}`);
  }

  async getContasPagar(params?: {
    DataInicial?: string;
    DataFinal?: string;
    Pagina?: number;
    RegistrosPorPagina?: number;
  }) {
    return this.makeRequest('/v1/contas-pagar', params);
  }
}

export const dapicService = new DapicService();
