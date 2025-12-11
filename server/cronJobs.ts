import cron from "node-cron";
import { salesSyncService } from "./salesSync";

// Track if cron jobs have been initialized to prevent duplicate timers on hot reload
let cronInitialized = false;

// Get current date in Brazil timezone (UTC-3)
function getBrazilDate(): string {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3 in minutes
  const utcOffset = now.getTimezoneOffset();
  const brazilTime = new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
  return brazilTime.toISOString().split('T')[0];
}

async function syncTodaySales(triggerSource: string) {
  const today = getBrazilDate();
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
  // Prevent duplicate initialization on hot reload
  if (cronInitialized) {
    console.log('[CRON] Cron jobs already initialized, skipping...');
    return;
  }
  cronInitialized = true;
  
  // Sincronização a cada hora durante horário comercial estendido (8h às 22h)
  // Roda nos minutos 5, 35 para evitar picos de API
  // Estendido até 22h para capturar vendas de fechamento das lojas
  cron.schedule('5,35 8-22 * * 1-6', async () => {
    await syncTodaySales('Sync horária');
  }, {
    timezone: "America/Sao_Paulo"
  });
  
  console.log('[CRON] Sincronização horária configurada: 08:05-22:35 (Seg-Sáb)');
  
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
  
  // Skip initial sync in production to allow health checks to pass first
  // In production, data will be synced by the hourly cron job
  const isProduction = process.env.NODE_ENV === 'production';
  const skipInitialSync = process.env.SKIP_INITIAL_SYNC === 'true';
  
  if (isProduction || skipInitialSync) {
    console.log('[CRON] Sincronização inicial pulada (ambiente de produção ou SKIP_INITIAL_SYNC=true)');
    console.log('[CRON] Dados serão sincronizados pelo próximo job agendado');
  } else {
    // In development, delay initial sync by 30 seconds
    console.log('[CRON] Sincronização inicial agendada para 30 segundos após o início');
    setTimeout(() => {
      syncTodaySales('Sync inicial');
    }, 30000);
  }
}
