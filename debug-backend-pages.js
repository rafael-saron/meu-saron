import axios from 'axios';

async function testBackendPagination() {
  try {
    console.log('🔍 Testando paginação através do backend local...\n');
    
    // Testar múltiplas páginas através do nosso backend
    for (let pagina = 1; pagina <= 5; pagina++) {
      console.log(`📄 Testando Página ${pagina} via backend local:`);
      
      const response = await axios.get(`http://localhost:5000/api/dapic/saron1/vendaspdv?Pagina=${pagina}&RegistrosPorPagina=200`);
      
      const vendas = response.data.Dados || [];
      console.log(`  - Total de registros retornados: ${vendas.length}`);
      
      if (vendas.length > 0) {
        // Filtrar novembro
        const vendasNov = vendas.filter(v => v.DataFechamento && v.DataFechamento.startsWith('2025-11'));
        const totalNov = vendasNov.reduce((sum, v) => {
          const valor = typeof v.ValorLiquido === 'string' 
            ? parseFloat(v.ValorLiquido.replace(/\./g, '').replace(',', '.'))
            : v.ValorLiquido;
          return sum + (valor || 0);
        }, 0);
        
        console.log(`  - Novembro/2025: ${vendasNov.length} vendas | R$ ${totalNov.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        
        // Mostrar primeira venda de exemplo
        if (vendas.length > 0) {
          const primeira = vendas[0];
          console.log(`  - Primeira venda: ID ${primeira.Id} | Data: ${primeira.DataFechamento} | Valor: ${primeira.ValorLiquido}`);
        }
      }
      
      // Se recebeu menos de 200, é a última página
      if (vendas.length < 200) {
        console.log(`\n✅ Última página alcançada (${pagina})`);
        break;
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
  }
}

testBackendPagination();
