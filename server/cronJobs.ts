import cron from "node-cron";
import { salesSyncService } from "./salesSync";

async function syncTodaySales(triggerSource: string) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[CRON] ${triggerSource} - Sincronizando vendas de hoje (${today})...`);
  
  try {
    const results = await salesSyncService.syncAllStores(today, today);
    
    const totalSales = results.reduce((sum, r) => sum + r.salesCount, 0);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`[CRON] ${triggerSource} - Sincronização concluída:`);
    console.log(`  - Total de vendas sincronizadas: ${totalSales}`);
    console.log(`  - Lojas sincronizadas: ${successCount}/3`);
    
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✓ ${result.store}: ${result.salesCount} vendas`);
      } else {
        console.log(`  ✗ ${result.store}: ERRO - ${result.error}`);
      }
    });
  } catch (error: any) {
    console.error(`[CRON] ${triggerSource} - Erro:`, error.message);
  }
}

export function initializeCronJobs() {
  // Sincronização a cada hora durante horário comercial (8h às 19h)
  // Roda nos minutos 5, 35 para evitar picos de API
  cron.schedule('5,35 8-19 * * 1-6', async () => {
    await syncTodaySales('Sync horária');
  }, {
    timezone: "America/Sao_Paulo"
  });
  
  console.log('[CRON] Sincronização horária configurada: 08:05-19:35 (Seg-Sáb)');
  
  // Sincronização mensal completa (histórico)
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
  
  console.log('[CRON] Sincronização mensal configurada: todo dia 1 às 00:05');
  
  // Sincronização inicial ao iniciar o servidor (vendas de hoje)
  setTimeout(() => {
    syncTodaySales('Sync inicial');
  }, 5000); // Aguarda 5 segundos após o servidor iniciar
}
