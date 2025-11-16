import axios from 'axios';

async function testPaginacao() {
  try {
    console.log('🔍 Testando paginação manual da API Dapic...\n');
    
    const saron1Empresa = process.env.DAPIC_EMPRESA || 'saron';
    const saron1Token = process.env.DAPIC_TOKEN_INTEGRACAO;
    
    if (!saron1Token) {
      console.error('❌ Token não configurado!');
      return;
    }
    
    //  Login na API Dapic
    console.log('🔑 Fazendo login na API Dapic...');
    const loginResponse = await axios.post('https://api.dapic.com.br/autenticacao/v1/login', {
      Empresa: saron1Empresa,
      Token: saron1Token
    });
    
    const token = loginResponse.data.Token;
    console.log(`✅ Login bem-sucedido!\n`);
    
    // Testar paginação
    const baseUrl = 'https://api.dapic.com.br/v1/vendaspdv';
    const params = {
      DataInicial: '2020-01-01',
      DataFinal: '2025-11-16',
      FiltrarPor: '0',
      Status: '1',
      RegistrosPorPagina: 200
    };
    
    for (let pagina = 1; pagina <= 5; pagina++) {
      console.log(`📄 Página ${pagina}:`);
      
      const response = await axios.get(baseUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          ...params,
          Pagina: pagina
        }
      });
      
      const vendas = response.data.Dados || [];
      console.log(`  - Registros: ${vendas.length}`);
      
      if (vendas.length > 0) {
        // Filtrar novembro
        const vendasNov = vendas.filter(v => v.DataFechamento && v.DataFechamento.startsWith('2025-11'));
        const totalNov = vendasNov.reduce((sum, v) => {
          const valor = typeof v.ValorLiquido === 'string' 
            ? parseFloat(v.ValorLiquido.replace(/\./g, '').replace(',', '.'))
            : v.ValorLiquido;
          return sum + (valor || 0);
        }, 0);
        
        console.log(`  - Novembro: ${vendasNov.length} vendas | R$ ${totalNov.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
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

testPaginacao();
