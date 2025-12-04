import { dapicService } from "./server/dapic";

async function main() {
  console.log("Buscando venda do Dapic para análise...");
  
  const sales = await dapicService.getSales('saron1', '2025-11-23', '2025-11-23', 1);
  
  if (sales.length > 0) {
    const sale = sales[0];
    console.log("\n=== VENDA COMPLETA ===");
    console.log(JSON.stringify(sale, null, 2));
    
    console.log("\n=== RECEBIMENTOS ===");
    if (sale.Recebimentos) {
      for (const rec of sale.Recebimentos) {
        console.log(`- FormaPagamento: ${rec.FormaPagamento}, Valor: ${rec.Valor}`);
      }
    }
  }
}

main().catch(console.error);
