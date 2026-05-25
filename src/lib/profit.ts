type ProfitProduct = {
  id?: string;
  purchase_price: number;
  stock_quantity?: number;
};

type ProfitSale = {
  id?: string;
  product_id?: string;
  quantity_sold: number;
  selling_price: number;
  purchase_price?: number;
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Profit = (selling_price - purchase_price) * quantity.
 * purchase_price is the per-unit cost of the product.
 */
export function calculateSaleProfit({
  purchasePrice,
  sellingPrice,
  quantity,
}: {
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
}) {
  return roundCurrency((sellingPrice - purchasePrice) * quantity);
}

export function calculateProductSaleProfits<T extends ProfitSale>(product: ProfitProduct, sales: T[]) {
  return sales.map((sale) => ({
    ...sale,
    total_profit: calculateSaleProfit({
      purchasePrice: product.purchase_price,
      sellingPrice: sale.selling_price,
      quantity: sale.quantity_sold,
    }),
  }));
}

export function calculateProductTotalProfit(product: ProfitProduct, sales: ProfitSale[]) {
  return calculateProductSaleProfits(product, sales).reduce((sum, sale) => sum + sale.total_profit, 0);
}

export function calculateSalesWithCorrectProfit<
  T extends ProfitSale & { id: string; product_id: string; total_profit: number; purchase_price: number },
  P extends ProfitProduct & { id: string },
>(products: P[], sales: T[]) {
  const productById = new Map(products.map((p) => [p.id, p]));
  return sales.map((sale) => {
    const product = productById.get(sale.product_id);
    const purchasePrice = product?.purchase_price ?? sale.purchase_price;
    return {
      ...sale,
      total_profit: calculateSaleProfit({
        purchasePrice,
        sellingPrice: sale.selling_price,
        quantity: sale.quantity_sold,
      }),
    };
  });
}
