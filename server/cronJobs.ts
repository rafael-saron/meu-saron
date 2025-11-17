import cron from "node-cron";
import { salesSyncService } from "./salesSync";

export function initializeCronJobs() {
  cron.schedule('5 0 1 * *', async () => {
    console.log('[CRON] Iniciando sincronização mensal automática de vendas...');
    console.log(`[CRON] Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
    
    try {
      const results = await salesSyncService.syncCurrentMonth();
      
      const totalSales = results.reduce((sum, r) => sum + r.salesCount, 0);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log('[CRON] Sincronização mensal concluída:');
      console.log(`  - Total de vendas sincronizadas: ${totalSales}`);
      console.log(`  - Lojas sincronizadas com sucesso: ${successCount}/3`);
      console.log(`  - Lojas com erro: ${failCount}/3`);
      
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✓ ${result.store}: ${result.salesCount} vendas`);
        } else {
          console.log(`  ✗ ${result.store}: ERRO - ${result.error}`);
        }
      });
    } catch (error: any) {
      console.error('[CRON] Erro crítico na sincronização mensal:', error.message);
    }
  }, {
    timezone: "America/Sao_Paulo"
  });
  
  console.log('[CRON] Job de sincronização mensal configurado: todo dia 1 às 00:05');
}
