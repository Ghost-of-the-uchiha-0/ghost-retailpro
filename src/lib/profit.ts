type ProfitProduct = {
  purchase_price: number;
  stock_quantity: number;
};

type ProfitSale = {
  id?: string;
  quantity_sold: number;
  selling_price: number;
};

export function getBatchSize(stockRemaining: number, totalUnitsSold: number) {
  return Math.max(stockRemaining + totalUnitsSold, 0);
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
  return (sellingPrice - perUnitCost) * saleQuantity;
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