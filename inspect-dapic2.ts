import axios from 'axios';

const DAPIC_API_BASE_URL = 'https://api.dapic.com.br';

async function getToken(): Promise<string> {
  const response = await axios.post(`${DAPIC_API_BASE_URL}/autenticacao/v1/login`, {
    Empresa: process.env.DAPIC_EMPRESA,
    TokenIntegracao: process.env.DAPIC_TOKEN_INTEGRACAO,
  });
  return response.data.access_token;
}

async function main() {
  const token = await getToken();
  
  const response = await axios.get(`${DAPIC_API_BASE_URL}/v1/vendaspdv`, {
    headers: { 'Authorization': `Bearer ${token}` },
    params: { DataInicial: '2025-11-23', DataFinal: '2025-11-23', Pagina: 1 }
  });

  console.log("=== FULL RESPONSE KEYS ===");
  console.log(Object.keys(response.data));
  
  const sales = response.data?.Resultado || response.data?.Dados || response.data;
  
  if (Array.isArray(sales) && sales.length > 0) {
    console.log("\n=== FIRST SALE KEYS ===");
    console.log(Object.keys(sales[0]));
    
    console.log("\n=== FIRST 2 SALES (full) ===");
    console.log(JSON.stringify(sales.slice(0, 2), null, 2));
  } else {
    console.log("\n=== RAW DATA ===");
    console.log(JSON.stringify(response.data, null, 2).substring(0, 3000));
  }
}

main().catch(console.error);
