export function parseBrazilianCurrency(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  const cleaned = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
}
