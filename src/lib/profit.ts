type ProfitProduct = {
  id?: string;
  purchase_price: number;
  initial_stock?: number;
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
 * Per-unit cost for a product = total batch cost (purchase_price) / initial batch size.
 * Falls back to current stock + units already sold when initial_stock isn't tracked.
 */
export function getUnitCost(product: ProfitProduct, soldCount = 0) {
  const initial =
    product.initial_stock && product.initial_stock > 0
      ? product.initial_stock
      : Math.max(1, (product.stock_quantity ?? 0) + soldCount);
  return product.purchase_price / initial;
}

/**
 * Profit per sale = (selling_price - per_unit_cost) * quantity.
 */
export function calculateSaleProfit({
  unitCost,
  sellingPrice,
  quantity,
}: {
  unitCost: number;
  sellingPrice: number;
  quantity: number;
}) {
  return roundCurrency((sellingPrice - unitCost) * quantity);
}

export function calculateProductSaleProfits<T extends ProfitSale>(product: ProfitProduct, sales: T[]) {
  const soldCount = sales.reduce((sum, s) => sum + s.quantity_sold, 0);
  const unitCost = getUnitCost(product, soldCount);
  return sales.map((sale) => ({
    ...sale,
    total_profit: calculateSaleProfit({
      unitCost,
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
  const soldByProduct = new Map<string, number>();
  for (const s of sales) {
    soldByProduct.set(s.product_id, (soldByProduct.get(s.product_id) ?? 0) + s.quantity_sold);
  }
  return sales.map((sale) => {
    const product = productById.get(sale.product_id);
    const unitCost = product
      ? getUnitCost(product, soldByProduct.get(sale.product_id) ?? 0)
      : sale.purchase_price;
    return {
      ...sale,
      total_profit: calculateSaleProfit({
        unitCost,
        sellingPrice: sale.selling_price,
        quantity: sale.quantity_sold,
      }),
    };
  });
}
