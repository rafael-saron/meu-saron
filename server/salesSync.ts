import { storage } from "./storage";
import { dapicService } from "./dapic";
import type { InsertSale, InsertSaleItem, InsertSaleReceipt } from "@shared/schema";

// Convert Dapic date format (DD/MM/YYYY or DD/MM/YYYY HH:MM:SS) to ISO format (YYYY-MM-DD)
function parseDapicDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }
  
  const str = String(dateStr).trim();
  
  // Already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0].split(' ')[0];
  }
  
  // Brazilian format: DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  // Try to parse as date
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through to default
  }
  
  console.warn(`[SalesSync] Could not parse date: "${dateStr}", using current date`);
  return new Date().toISOString().split('T')[0];
}

// Parse Brazilian currency format to number
function parseCurrencyValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  
  // Handle Brazilian format: 1.234,56
  if (str.includes(',') && str.includes('.')) {
    // Has both separators, assume Brazilian format
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  
  // Handle Brazilian format: 1234,56 (no thousands separator)
  if (str.includes(',') && !str.includes('.')) {
    return parseFloat(str.replace(',', '.')) || 0;
  }
  
  return parseFloat(str) || 0;
}

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

  // Normalize payment method names to standard format for easier matching
  private normalizePaymentMethod(rawMethod: string): string {
    if (!rawMethod) return '';
    
    const method = rawMethod.toLowerCase().trim();
    
    // Normalize PIX
    if (method.includes('pix')) {
      return 'pix';
    }
    
    // Normalize Dinheiro
    if (method.includes('dinheiro') || method.includes('especie') || method.includes('espécie')) {
      return 'dinheiro';
    }
    
    // Normalize Débito
    if (method.includes('débito') || method.includes('debito') || method.includes('tef débito') || method.includes('tef debito')) {
      return 'debito';
    }
    
    // Normalize Crédito
    if (method.includes('crédito') || method.includes('credito') || method.includes('tef crédito') || method.includes('tef credito')) {
      return 'credito';
    }
    
    // Normalize Boleto
    if (method.includes('boleto')) {
      return 'boleto';
    }
    
    // Normalize Crediário/Carnê
    if (method.includes('crediário') || method.includes('crediario') || method.includes('carnê') || method.includes('carne')) {
      return 'crediario';
    }
    
    // Normalize Transferência
    if (method.includes('transferência') || method.includes('transferencia') || method.includes('ted') || method.includes('doc')) {
      return 'transferencia';
    }
    
    // Return cleaned version of original if no match
    return method.replace(/^\d+\s*-\s*/, '').trim() || rawMethod;
  }

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
            
            // Extract payment method from Recebimentos array
            let paymentMethod: string | null = null;
            if (dapicSale.Recebimentos && Array.isArray(dapicSale.Recebimentos) && dapicSale.Recebimentos.length > 0) {
              // Get the payment method from the first (or main) recebimento
              // Normalize payment method names for easier matching
              const rawPaymentMethod = dapicSale.Recebimentos[0].FormaPagamento || '';
              paymentMethod = this.normalizePaymentMethod(rawPaymentMethod);
              
              // If there are multiple payment methods, concatenate them
              if (dapicSale.Recebimentos.length > 1) {
                const allMethods = dapicSale.Recebimentos.map((r: any) => 
                  this.normalizePaymentMethod(r.FormaPagamento || '')
                ).filter((m: string) => m);
                // Use unique methods
                const uniqueMethods = Array.from(new Set(allMethods as string[]));
                if (uniqueMethods.length > 1) {
                  paymentMethod = uniqueMethods.join(', ');
                }
              }
            }

            // Parse and normalize the sale date from Dapic format to ISO
            const rawDate = dapicSale.DataFechamento || dapicSale.DataEmissao || dapicSale.Data;
            const parsedDate = parseDapicDate(rawDate);
            
            // Parse and normalize the total value
            const totalValue = parseCurrencyValue(dapicSale.ValorLiquido || dapicSale.ValorTotal || 0);
            
            const sale: InsertSale = {
              saleCode,
              saleDate: parsedDate,
              totalValue: String(totalValue),
              sellerName: dapicSale.NomeVendedor || dapicSale.Vendedor || 'Sem Vendedor',
              clientName: dapicSale.NomeCliente || dapicSale.Cliente || null,
              storeId: storeId as "saron1" | "saron2" | "saron3",
              status: dapicSale.Status || 'Finalizado',
              paymentMethod: paymentMethod,
            };

            const items: InsertSaleItem[] = [];
            
            if (dapicSale.Itens && Array.isArray(dapicSale.Itens)) {
              for (const dapicItem of dapicSale.Itens) {
                items.push({
                  saleId: '',
                  productCode: String(dapicItem.CodigoProduto || dapicItem.Codigo || ''),
                  productDescription: dapicItem.Descricao || dapicItem.NomeProduto || 'Sem Descrição',
                  quantity: String(parseCurrencyValue(dapicItem.Quantidade) || 1),
                  unitPrice: String(parseCurrencyValue(dapicItem.ValorUnitario || dapicItem.PrecoUnitario || 0)),
                  totalPrice: String(parseCurrencyValue(dapicItem.ValorTotal || dapicItem.Total || 0)),
                });
              }
            }

            // Extract individual receipts with their specific values
            const receipts: InsertSaleReceipt[] = [];
            
            if (dapicSale.Recebimentos && Array.isArray(dapicSale.Recebimentos)) {
              for (const recebimento of dapicSale.Recebimentos) {
                const rawMethod = recebimento.FormaPagamento || '';
                const normalizedMethod = this.normalizePaymentMethod(rawMethod);
                const grossValue = parseFloat(recebimento.ValorBruto || recebimento.Valor || 0);
                const netValue = parseFloat(recebimento.Valor || recebimento.ValorBruto || 0);
                
                if (normalizedMethod && grossValue > 0) {
                  receipts.push({
                    saleId: '',
                    paymentMethod: normalizedMethod,
                    grossValue: String(grossValue),
                    netValue: String(netValue),
                  });
                }
              }
            }

            await storage.createSaleWithItemsAndReceipts(sale, items, receipts);
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

  // Additive sync - doesn't delete existing data, only adds new sales
  async syncStoreAdditive(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<SyncResult> {
    const syncKey = `additive-${storeId}-${startDate}-${endDate}`;
    
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
      console.log(`[SalesSync-Additive] Iniciando: ${storeId} (${startDate} a ${endDate})`);
      
      let salesCount = 0;
      let skippedExisting = 0;
      let page = 1;
      let hasMore = true;
      const maxPages = 100;
      
      const processedSaleCodes = new Set<string>();

      while (hasMore && page <= maxPages) {
        console.log(`[SalesSync-Additive] ${storeId} - Página ${page}...`);
        
        const response = await dapicService.getVendasPDV(storeId, {
          DataInicial: startDate,
          DataFinal: endDate,
          Pagina: page,
        }) as any;

        const salesData = response?.Resultado || response?.Dados || [];
        
        if (!salesData || salesData.length === 0) {
          console.log(`[SalesSync-Additive] ${storeId} - Sem vendas na página ${page}`);
          hasMore = false;
          break;
        }

        for (const dapicSale of salesData) {
          try {
            const saleCode = String(dapicSale.Codigo || dapicSale.CodigoVenda || '');
            
            if (processedSaleCodes.has(saleCode)) {
              continue;
            }
            processedSaleCodes.add(saleCode);
            
            // Check if sale already exists in database
            const exists = await storage.saleExists(saleCode, storeId);
            if (exists) {
              skippedExisting++;
              continue;
            }
            
            let paymentMethod: string | null = null;
            if (dapicSale.Recebimentos && Array.isArray(dapicSale.Recebimentos) && dapicSale.Recebimentos.length > 0) {
              const rawPaymentMethod = dapicSale.Recebimentos[0].FormaPagamento || '';
              paymentMethod = this.normalizePaymentMethod(rawPaymentMethod);
              
              if (dapicSale.Recebimentos.length > 1) {
                const allMethods = dapicSale.Recebimentos.map((r: any) => 
                  this.normalizePaymentMethod(r.FormaPagamento || '')
                ).filter((m: string) => m);
                const uniqueMethods = Array.from(new Set(allMethods as string[]));
                if (uniqueMethods.length > 1) {
                  paymentMethod = uniqueMethods.join(', ');
                }
              }
            }

            const rawDate = dapicSale.DataFechamento || dapicSale.DataEmissao || dapicSale.Data;
            const parsedDate = parseDapicDate(rawDate);
            const totalValue = parseCurrencyValue(dapicSale.ValorLiquido || dapicSale.ValorTotal || 0);
            
            const sale: InsertSale = {
              saleCode,
              saleDate: parsedDate,
              totalValue: String(totalValue),
              sellerName: dapicSale.NomeVendedor || dapicSale.Vendedor || 'Sem Vendedor',
              clientName: dapicSale.NomeCliente || dapicSale.Cliente || null,
              storeId: storeId as "saron1" | "saron2" | "saron3",
              status: dapicSale.Status || 'Finalizado',
              paymentMethod: paymentMethod,
            };

            const items: InsertSaleItem[] = [];
            if (dapicSale.Itens && Array.isArray(dapicSale.Itens)) {
              for (const dapicItem of dapicSale.Itens) {
                items.push({
                  saleId: '',
                  productCode: String(dapicItem.CodigoProduto || dapicItem.Codigo || ''),
                  productDescription: dapicItem.Descricao || dapicItem.NomeProduto || 'Sem Descrição',
                  quantity: String(parseCurrencyValue(dapicItem.Quantidade) || 1),
                  unitPrice: String(parseCurrencyValue(dapicItem.ValorUnitario || dapicItem.PrecoUnitario || 0)),
                  totalPrice: String(parseCurrencyValue(dapicItem.ValorTotal || dapicItem.Total || 0)),
                });
              }
            }

            const receipts: InsertSaleReceipt[] = [];
            if (dapicSale.Recebimentos && Array.isArray(dapicSale.Recebimentos)) {
              for (const recebimento of dapicSale.Recebimentos) {
                const rawMethod = recebimento.FormaPagamento || '';
                const normalizedMethod = this.normalizePaymentMethod(rawMethod);
                const grossValue = parseFloat(recebimento.ValorBruto || recebimento.Valor || 0);
                const netValue = parseFloat(recebimento.Valor || recebimento.ValorBruto || 0);
                
                if (normalizedMethod && grossValue > 0) {
                  receipts.push({
                    saleId: '',
                    paymentMethod: normalizedMethod,
                    grossValue: String(grossValue),
                    netValue: String(netValue),
                  });
                }
              }
            }

            await storage.createSaleWithItemsAndReceipts(sale, items, receipts);
            salesCount++;
          } catch (itemError: any) {
            console.error(`[SalesSync-Additive] Erro venda ${dapicSale.Codigo}:`, itemError.message);
          }
        }

        if (salesData.length < 200) {
          hasMore = false;
        } else {
          page++;
        }
      }
      
      console.log(`[SalesSync-Additive] ${storeId}: ${salesCount} novas, ${skippedExisting} existentes`);
      
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
      console.error(`[SalesSync-Additive] Erro ${storeId}:`, error);
      
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

  // Get current date in Brazil timezone (UTC-3)
  private getBrazilDate(): Date {
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3 in minutes
    const utcOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
  }

  async syncFullHistory(): Promise<SyncResult[]> {
    const startDate = '2024-01-01';
    const endDate = this.getBrazilDate().toISOString().split('T')[0];
    
    console.log(`[SalesSync] Iniciando sincronização completa desde ${startDate}`);
    return await this.syncAllStores(startDate, endDate);
  }

  async syncCurrentMonth(): Promise<SyncResult[]> {
    const now = this.getBrazilDate();
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
