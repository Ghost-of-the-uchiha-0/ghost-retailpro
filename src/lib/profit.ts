type ProfitProduct = {
  id?: string;
  purchase_price: number;
  stock_quantity: number;
};

type ProfitSale = {
  id?: string;
  product_id?: string;
  quantity_sold: number;
  selling_price: number;
};

export function getBatchSize(stockRemaining: number, totalUnitsSold: number) {
  return Math.max(stockRemaining + totalUnitsSold, 0);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSaleProfit({
  batchPurchasePrice,
  batchSize,
  saleQuantity,
  sellingPrice,
}: {
  batchPurchasePrice: number;
  batchSize: number;
  saleQuantity: number;
  sellingPrice: number;
}) {
  const perUnitCost = batchSize > 0 ? batchPurchasePrice / batchSize : 0;
  return roundCurrency((sellingPrice - perUnitCost) * saleQuantity);
}

export function calculateProductSaleProfits<T extends ProfitSale>(product: ProfitProduct, sales: T[]) {
  const totalUnitsSold = sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  const batchSize = getBatchSize(product.stock_quantity, totalUnitsSold);

  return sales.map((sale) => ({
    ...sale,
    total_profit: calculateSaleProfit({
      batchPurchasePrice: product.purchase_price,
      batchSize,
      saleQuantity: sale.quantity_sold,
      sellingPrice: sale.selling_price,
    }),
  }));
}

export function calculateProductTotalProfit(product: ProfitProduct, sales: ProfitSale[]) {
  return calculateProductSaleProfits(product, sales).reduce((sum, sale) => sum + sale.total_profit, 0);
}

export function calculateSalesWithCorrectProfit<
  T extends ProfitSale & { id: string; product_id: string; total_profit: number },
  P extends ProfitProduct & { id: string },
>(products: P[], sales: T[]) {
  const profitBySaleId = new Map<string, number>();

  products.forEach((product) => {
    const productSales = sales.filter((sale) => sale.product_id === product.id);
    calculateProductSaleProfits(product, productSales).forEach((sale) => {
      profitBySaleId.set(sale.id!, sale.total_profit);
    });
  });

  return sales.map((sale) => ({
    ...sale,
    total_profit: profitBySaleId.get(sale.id) ?? sale.total_profit,
  }));
}