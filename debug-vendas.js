import axios from 'axios';

async function debugVendas() {
  try {
    console.log('🔍 Buscando dados de vendas PDV da Saron 1...\n');
    
    const response = await axios.get('http://localhost:5000/api/dapic/saron1/vendaspdv');
    const vendas = response.data.Dados || [];
    
    console.log(`📊 Total de vendas retornadas: ${vendas.length}`);
    
    // Filtrar vendas de novembro 2025
    const vendasNovembro = vendas.filter(v => {
      const data = v.DataFechamento;
      return data && data.startsWith('2025-11');
    });
    
    console.log(`📅 Vendas de novembro/2025: ${vendasNovembro.length}`);
    
    // Calcular total
    let totalNovembro = 0;
    vendasNovembro.forEach(v => {
      const valor = typeof v.ValorLiquido === 'string' 
        ? parseFloat(v.ValorLiquido.replace(/\./g, '').replace(',', '.'))
        : v.ValorLiquido;
      totalNovembro += valor || 0;
    });
    
    console.log(`💰 Total vendas novembro: R$ ${totalNovembro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    
    // Mostrar algumas vendas de exemplo
    console.log('\n📋 Primeiras 5 vendas de novembro:');
    vendasNovembro.slice(0, 5).forEach((v, i) => {
      console.log(`  ${i+1}. Data: ${v.DataFechamento} | Valor: ${v.ValorLiquido} | Status: ${v.Status} | ID: ${v.Id}`);
    });
    
    // Verificar status das vendas
    const statusCounts = {};
    vendasNovembro.forEach(v => {
      statusCounts[v.Status] = (statusCounts[v.Status] || 0) + 1;
    });
    console.log('\n📊 Vendas por Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} vendas`);
    });
    
    // Verificar parâmetros da requisição original
    console.log('\n🔧 Investigando endpoint original da API Dapic...');
    const saron1Empresa = process.env.DAPIC_EMPRESA;
    const saron1Token = process.env.DAPIC_TOKEN_INTEGRACAO;
    
    console.log(`  Empresa: ${saron1Empresa}`);
    console.log(`  Token configurado: ${saron1Token ? 'Sim' : 'Não'}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
  }
}

debugVendas();
