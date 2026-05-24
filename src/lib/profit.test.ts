import { describe, it, expect } from "vitest";
import {
  getBatchSize,
  calculateSaleProfit,
  calculateProductSaleProfits,
  calculateProductTotalProfit,
  calculateSalesWithCorrectProfit,
} from "./profit";

describe("getBatchSize", () => {
  it("sums remaining stock and units sold", () => {
    expect(getBatchSize(10, 5)).toBe(15);
  });

  it("returns 0 when both are 0", () => {
    expect(getBatchSize(0, 0)).toBe(0);
  });

  it("clamps negative totals to 0", () => {
    expect(getBatchSize(-5, 0)).toBe(0);
    expect(getBatchSize(-3, 1)).toBe(0);
  });

  it("handles a fully sold-out batch", () => {
    expect(getBatchSize(0, 20)).toBe(20);
  });
});

describe("calculateSaleProfit", () => {
  it("calculates profit for a single unit", () => {
    // perUnit cost = 100/10 = 10; profit = (25-10)*1 = 15
    expect(
      calculateSaleProfit({ batchPurchasePrice: 100, batchSize: 10, saleQuantity: 1, sellingPrice: 25 }),
    ).toBe(15);
  });

  it("calculates profit for multiple units", () => {
    // perUnit = 200/20 = 10; profit = (15-10)*5 = 25
    expect(
      calculateSaleProfit({ batchPurchasePrice: 200, batchSize: 20, saleQuantity: 5, sellingPrice: 15 }),
    ).toBe(25);
  });

  it("returns 0 cost basis when batchSize is 0 (treats selling price as full profit)", () => {
    expect(
      calculateSaleProfit({ batchPurchasePrice: 100, batchSize: 0, saleQuantity: 3, sellingPrice: 10 }),
    ).toBe(30);
  });

  it("rounds to 2 decimal places", () => {
    // perUnit = 10/3 = 3.3333...; profit = (5 - 3.3333) * 3 = 4.9999... -> 5
    const result = calculateSaleProfit({
      batchPurchasePrice: 10,
      batchSize: 3,
      saleQuantity: 3,
      sellingPrice: 5,
    });
    expect(result).toBe(5);
  });

  it("can return a negative profit when sold below cost", () => {
    // perUnit = 100/10 = 10; profit = (5 - 10) * 2 = -10
    expect(
      calculateSaleProfit({ batchPurchasePrice: 100, batchSize: 10, saleQuantity: 2, sellingPrice: 5 }),
    ).toBe(-10);
  });

  it("returns 0 when quantity is 0", () => {
    expect(
      calculateSaleProfit({ batchPurchasePrice: 100, batchSize: 10, saleQuantity: 0, sellingPrice: 25 }),
    ).toBe(0);
  });

  it("handles fractional pricing without drifting", () => {
    // perUnit = 33.33/3 = 11.11; profit = (20 - 11.11) * 3 = 26.67
    const result = calculateSaleProfit({
      batchPurchasePrice: 33.33,
      batchSize: 3,
      saleQuantity: 3,
      sellingPrice: 20,
    });
    expect(result).toBeCloseTo(26.67, 2);
  });
});

describe("calculateProductSaleProfits", () => {
  it("uses batch size = remaining stock + total sold across all sales", () => {
    const product = { purchase_price: 100, stock_quantity: 5 };
    const sales = [
      { id: "a", quantity_sold: 2, selling_price: 20 },
      { id: "b", quantity_sold: 3, selling_price: 20 },
    ];
    // batchSize = 5 + 5 = 10; perUnit = 10
    const result = calculateProductSaleProfits(product, sales);
    expect(result[0].total_profit).toBe((20 - 10) * 2); // 20
    expect(result[1].total_profit).toBe((20 - 10) * 3); // 30
  });

  it("preserves all other sale fields", () => {
    const product = { purchase_price: 50, stock_quantity: 5 };
    const sales = [{ id: "x", product_id: "p1", quantity_sold: 5, selling_price: 15 }];
    const result = calculateProductSaleProfits(product, sales);
    expect(result[0]).toMatchObject({ id: "x", product_id: "p1", quantity_sold: 5, selling_price: 15 });
  });

  it("returns empty array when no sales", () => {
    expect(calculateProductSaleProfits({ purchase_price: 100, stock_quantity: 5 }, [])).toEqual([]);
  });
});

describe("calculateProductTotalProfit", () => {
  it("sums profits across all sales of a product", () => {
    const product = { purchase_price: 100, stock_quantity: 0 };
    const sales = [
      { quantity_sold: 4, selling_price: 30 },
      { quantity_sold: 6, selling_price: 20 },
    ];
    // batchSize = 10; perUnit = 10; profits = 80 + 60 = 140
    expect(calculateProductTotalProfit(product, sales)).toBe(140);
  });

  it("returns 0 when there are no sales", () => {
    expect(calculateProductTotalProfit({ purchase_price: 100, stock_quantity: 10 }, [])).toBe(0);
  });
});

describe("calculateSalesWithCorrectProfit", () => {
  it("recomputes profit per product independently", () => {
    const products = [
      { id: "p1", purchase_price: 100, stock_quantity: 0 },
      { id: "p2", purchase_price: 50, stock_quantity: 5 },
    ];
    const sales = [
      { id: "s1", product_id: "p1", quantity_sold: 10, selling_price: 20, total_profit: 999 },
      { id: "s2", product_id: "p2", quantity_sold: 5, selling_price: 15, total_profit: 999 },
    ];
    const result = calculateSalesWithCorrectProfit(products, sales);
    // p1: batch=10, perUnit=10, profit=(20-10)*10=100
    expect(result.find((s) => s.id === "s1")!.total_profit).toBe(100);
    // p2: batch=5+5=10, perUnit=5, profit=(15-5)*5=50
    expect(result.find((s) => s.id === "s2")!.total_profit).toBe(50);
  });

  it("falls back to stored profit when product is missing", () => {
    const sales = [
      { id: "s1", product_id: "missing", quantity_sold: 1, selling_price: 10, total_profit: 42 },
    ];
    const result = calculateSalesWithCorrectProfit([], sales);
    expect(result[0].total_profit).toBe(42);
  });

  it("preserves sale order", () => {
    const products = [{ id: "p1", purchase_price: 10, stock_quantity: 0 }];
    const sales = [
      { id: "a", product_id: "p1", quantity_sold: 1, selling_price: 5, total_profit: 0 },
      { id: "b", product_id: "p1", quantity_sold: 1, selling_price: 5, total_profit: 0 },
      { id: "c", product_id: "p1", quantity_sold: 1, selling_price: 5, total_profit: 0 },
    ];
    const result = calculateSalesWithCorrectProfit(products, sales);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

// Simulate the edit/delete recalculation flows in Sales.tsx — these
// don't hit the database, they just verify the math the UI relies on.
describe("edit/delete recalculation behavior", () => {
  it("editing a sale's quantity recomputes ALL sale profits for that product using the original batch size", () => {
    // Initial state: product had 10 units in batch (stock=4, sold=6 across 2 sales)
    const product = { purchase_price: 100, stock_quantity: 4 };
    const allSales = [
      { id: "a", quantity_sold: 2, selling_price: 25 },
      { id: "b", quantity_sold: 4, selling_price: 25 },
    ];

    // Simulate editing sale "b" from qty 4 -> 6
    const editing = allSales[1];
    const newQty = 6;
    const others = allSales.filter((s) => s.id !== editing.id);

    // Mirror Sales.tsx: pass stock_quantity + editing.quantity_sold so the
    // batch size stays anchored to the original batch size, independent of
    // the new quantity being applied.
    const recalculated = calculateProductSaleProfits(
      { purchase_price: product.purchase_price, stock_quantity: product.stock_quantity + editing.quantity_sold },
      [...others, { id: editing.id, quantity_sold: newQty, selling_price: editing.selling_price }],
    );

    // Anchored batch size = (4 + 4) + (2 + 6) = 16? NO — let's trace properly:
    //   stock passed in = 4 + 4 = 8
    //   total sold passed in = 2 + 6 = 8
    //   batch size = 8 + 8 = 16
    //   perUnit = 100/16 = 6.25
    //   sale "a" profit = (25 - 6.25) * 2 = 37.5
    //   sale "b" profit = (25 - 6.25) * 6 = 112.5
    const a = recalculated.find((s) => s.id === "a")!;
    const b = recalculated.find((s) => s.id === "b")!;
    expect(a.total_profit).toBe(37.5);
    expect(b.total_profit).toBe(112.5);
  });

  it("deleting a sale recomputes remaining sales using the restored stock", () => {
    // Before delete: stock=2, sold across 3 sales = 8 -> batch = 10
    const product = { purchase_price: 100, stock_quantity: 2 };
    const sales = [
      { id: "a", quantity_sold: 3, selling_price: 20 },
      { id: "b", quantity_sold: 2, selling_price: 20 },
      { id: "c", quantity_sold: 3, selling_price: 20 },
    ];

    // Simulate deleting "b": stock returns +2, remaining sales sum = 6, batch stays 10
    const deleted = sales[1];
    const remaining = sales.filter((s) => s.id !== deleted.id);
    const restoredProduct = { ...product, stock_quantity: product.stock_quantity + deleted.quantity_sold };

    const recalculated = calculateProductSaleProfits(restoredProduct, remaining);
    // batch = 4 + 6 = 10, perUnit = 10, profit per remaining sale = (20-10)*qty
    expect(recalculated.find((s) => s.id === "a")!.total_profit).toBe(30);
    expect(recalculated.find((s) => s.id === "c")!.total_profit).toBe(30);
  });

  it("editing to a smaller quantity reduces only that sale's profit (others unchanged in stable batch)", () => {
    const product = { purchase_price: 60, stock_quantity: 0 };
    const sales = [
      { id: "a", quantity_sold: 3, selling_price: 20 },
      { id: "b", quantity_sold: 3, selling_price: 20 },
    ];
    // Edit b: 3 -> 1
    const editing = sales[1];
    const newQty = 1;
    const others = sales.filter((s) => s.id !== editing.id);
    const recalculated = calculateProductSaleProfits(
      { ...product, stock_quantity: product.stock_quantity + editing.quantity_sold },
      [...others, { id: editing.id, quantity_sold: newQty, selling_price: editing.selling_price }],
    );
    // stock passed = 3, sold passed = 3+1 = 4, batch = 7, perUnit = 60/7 ≈ 8.5714
    // a: (20 - 8.5714) * 3 ≈ 34.29
    // b: (20 - 8.5714) * 1 ≈ 11.43
    expect(recalculated.find((s) => s.id === "a")!.total_profit).toBeCloseTo(34.29, 2);
    expect(recalculated.find((s) => s.id === "b")!.total_profit).toBeCloseTo(11.43, 2);
  });

  it("deleting the only sale leaves no recalculated rows", () => {
    const product = { purchase_price: 100, stock_quantity: 0 };
    const sales = [{ id: "only", quantity_sold: 5, selling_price: 30 }];
    const deleted = sales[0];
    const remaining = sales.filter((s) => s.id !== deleted.id);
    const recalculated = calculateProductSaleProfits(
      { ...product, stock_quantity: product.stock_quantity + deleted.quantity_sold },
      remaining,
    );
    expect(recalculated).toEqual([]);
  });
});
