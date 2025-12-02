import { storage } from "./storage";
import { dapicService } from "./dapic";
import type { InsertSale, InsertSaleItem } from "@shared/schema";

interface SyncResult {
  success: boolean;
  store: string;
  salesCount: number;
  error?: string;
}

interface SyncProgress {
  store: string;
  status: 'in_progress' | 'completed' | 'failed';
  salesCount: number;
  error?: string;
}

export class SalesSyncService {
  private syncInProgress: Map<string, SyncProgress> = new Map();

  async syncStore(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<SyncResult> {
    const syncKey = `${storeId}-${startDate}-${endDate}`;
    
    if (this.syncInProgress.get(syncKey)?.status === 'in_progress') {
      return {
        success: false,
        store: storeId,
        salesCount: 0,
        error: 'Sincronização já em andamento para este período',
      };
    }

    this.syncInProgress.set(syncKey, {
      store: storeId,
      status: 'in_progress',
      salesCount: 0,
    });

    try {
      console.log(`[SalesSync] Iniciando sincronização: ${storeId} (${startDate} a ${endDate})`);
      
      await storage.deleteSalesByPeriod(storeId, startDate, endDate);
      console.log(`[SalesSync] Vendas antigas deletadas para ${storeId}`);

      let salesCount = 0;
      let duplicatesSkipped = 0;
      let page = 1;
      let hasMore = true;
      const maxPages = 100;
      
      // Track processed sale codes to avoid duplicates within sync session
      const processedSaleCodes = new Set<string>();

      while (hasMore && page <= maxPages) {
        console.log(`[SalesSync] Buscando página ${page} de vendas do Dapic...`);
        
        const response = await dapicService.getVendasPDV(storeId, {
          DataInicial: startDate,
          DataFinal: endDate,
          Pagina: page,
        }) as any;

        const salesData = response?.Resultado || response?.Dados || [];
        
        if (!salesData || salesData.length === 0) {
          console.log(`[SalesSync] Nenhuma venda encontrada na página ${page}`);
          hasMore = false;
          break;
        }

        for (const dapicSale of salesData) {
          try {
            const saleCode = String(dapicSale.Codigo || dapicSale.CodigoVenda || '');
            
            // Skip if we've already processed this sale code in this sync session
            if (processedSaleCodes.has(saleCode)) {
              duplicatesSkipped++;
              continue;
            }
            
            processedSaleCodes.add(saleCode);
            
            const sale: InsertSale = {
              saleCode,
              saleDate: dapicSale.DataFechamento || dapicSale.DataEmissao || dapicSale.Data || new Date().toISOString().split('T')[0],
              totalValue: String(dapicSale.ValorLiquido || dapicSale.ValorTotal || 0),
              sellerName: dapicSale.NomeVendedor || dapicSale.Vendedor || 'Sem Vendedor',
              clientName: dapicSale.NomeCliente || dapicSale.Cliente || null,
              storeId: storeId as "saron1" | "saron2" | "saron3",
              status: dapicSale.Status || 'Finalizado',
              paymentMethod: dapicSale.FormaPagamento || dapicSale.MeioPagamento || dapicSale.TipoPagamento || null,
            };

            const items: InsertSaleItem[] = [];
            
            if (dapicSale.Itens && Array.isArray(dapicSale.Itens)) {
              for (const dapicItem of dapicSale.Itens) {
                items.push({
                  saleId: '',
                  productCode: String(dapicItem.CodigoProduto || dapicItem.Codigo || ''),
                  productDescription: dapicItem.Descricao || dapicItem.NomeProduto || 'Sem Descrição',
                  quantity: String(dapicItem.Quantidade || 1),
                  unitPrice: String(dapicItem.ValorUnitario || dapicItem.PrecoUnitario || 0),
                  totalPrice: String(dapicItem.ValorTotal || dapicItem.Total || 0),
                });
              }
            }

            await storage.createSaleWithItems(sale, items);
            salesCount++;
          } catch (itemError: any) {
            console.error(`[SalesSync] Erro ao processar venda ${dapicSale.Codigo}:`, itemError.message);
          }
        }

        if (salesData.length < 200) {
          hasMore = false;
        } else {
          page++;
        }
      }
      
      if (duplicatesSkipped > 0) {
        console.log(`[SalesSync] ${duplicatesSkipped} duplicatas ignoradas`);
      }

      console.log(`[SalesSync] Sincronização concluída: ${storeId} - ${salesCount} vendas`);
      
      this.syncInProgress.set(syncKey, {
        store: storeId,
        status: 'completed',
        salesCount,
      });

      return {
        success: true,
        store: storeId,
        salesCount,
      };
    } catch (error: any) {
      console.error(`[SalesSync] Erro na sincronização ${storeId}:`, error);
      
      this.syncInProgress.set(syncKey, {
        store: storeId,
        status: 'failed',
        salesCount: 0,
        error: error.message,
      });

      return {
        success: false,
        store: storeId,
        salesCount: 0,
        error: error.message,
      };
    }
  }

  async syncAllStores(startDate: string, endDate: string): Promise<SyncResult[]> {
    const stores = ['saron1', 'saron2', 'saron3'];
    const results: SyncResult[] = [];

    for (const store of stores) {
      const result = await this.syncStore(store, startDate, endDate);
      results.push(result);
    }

    return results;
  }

  async syncFullHistory(): Promise<SyncResult[]> {
    const startDate = '2024-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    console.log(`[SalesSync] Iniciando sincronização completa desde ${startDate}`);
    return await this.syncAllStores(startDate, endDate);
  }

  async syncCurrentMonth(): Promise<SyncResult[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const startDate = `${year}-${month}-01`;
    
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    console.log(`[SalesSync] Sincronizando mês atual: ${startDate} a ${endDate}`);
    return await this.syncAllStores(startDate, endDate);
  }

  getSyncStatus(storeId: string, startDate: string, endDate: string): SyncProgress | null {
    const syncKey = `${storeId}-${startDate}-${endDate}`;
    return this.syncInProgress.get(syncKey) || null;
  }
}

export const salesSyncService = new SalesSyncService();
