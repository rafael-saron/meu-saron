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
  
  // Fetch one sale with multiple payment methods
  const response = await axios.get(`${DAPIC_API_BASE_URL}/v1/vendaspdv`, {
    headers: { 'Authorization': `Bearer ${token}` },
    params: { DataInicial: '2025-11-23', DataFinal: '2025-11-23', Pagina: 1 }
  });

  const sales = response.data?.Resultado || response.data?.Dados || [];
  
  // Find a sale with multiple recebimentos
  let sampleSale = null;
  for (const sale of sales) {
    if (sale.Recebimentos && sale.Recebimentos.length > 1) {
      sampleSale = sale;
      break;
    }
  }
  
  if (!sampleSale) {
    sampleSale = sales[0];
  }

  console.log("\n=== RECEBIMENTOS STRUCTURE ===");
  console.log(JSON.stringify(sampleSale?.Recebimentos, null, 2));
  
  console.log("\n=== SALE TOTAL ===");
  console.log(`ValorLiquido: ${sampleSale?.ValorLiquido}`);
  console.log(`ValorTotal: ${sampleSale?.ValorTotal}`);
  
  // Sum recebimentos
  if (sampleSale?.Recebimentos) {
    let totalRecebimentos = 0;
    for (const rec of sampleSale.Recebimentos) {
      console.log(`\nRecebimento: ${rec.FormaPagamento} = ${rec.Valor || rec.ValorRecebido || rec.ValorPago}`);
      totalRecebimentos += parseFloat(rec.Valor || rec.ValorRecebido || rec.ValorPago || 0);
    }
    console.log(`\nTotal Recebimentos: ${totalRecebimentos}`);
  }
}

main().catch(console.error);
