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
  
  // Try today's date
  const today = new Date().toISOString().split('T')[0];
  console.log("Buscando vendas de:", today);
  
  const response = await axios.get(`${DAPIC_API_BASE_URL}/v1/vendaspdv`, {
    headers: { 'Authorization': `Bearer ${token}` },
    params: { DataInicial: today, DataFinal: today, Pagina: 1 }
  });

  const sales = response.data?.Dados || [];
  
  if (sales.length > 0) {
    console.log("\n=== FIRST SALE KEYS ===");
    console.log(Object.keys(sales[0]));
    
    console.log("\n=== FIRST SALE (full) ===");
    console.log(JSON.stringify(sales[0], null, 2));
  } else {
    console.log("Nenhuma venda encontrada para hoje");
    console.log(JSON.stringify(response.data, null, 2));
  }
}

main().catch(console.error);
