import { describe, expect, it } from "vitest";
import {
  calculateProductSaleProfits,
  calculateProductTotalProfit,
  calculateSaleProfit,
  calculateSalesWithCorrectProfit,
  getUnitCost,
} from "./profit";

describe("getUnitCost", () => {
  it("uses initial_stock when present", () => {
    expect(getUnitCost({ purchase_price: 142, initial_stock: 25 })).toBeCloseTo(5.68, 2);
  });

  it("falls back to stock_quantity + sold when initial_stock missing", () => {
    expect(getUnitCost({ purchase_price: 100, stock_quantity: 5 }, 5)).toBe(10);
  });
});

describe("calculateSaleProfit", () => {
  it("matches user spec: 142/25 cost, sell 10, qty 25 => 108", () => {
    const unitCost = 142 / 25;
    expect(calculateSaleProfit({ unitCost, sellingPrice: 10, quantity: 25 })).toBe(108);
  });

  it("(selling - unit) * quantity", () => {
    expect(calculateSaleProfit({ unitCost: 5, sellingPrice: 10, quantity: 3 })).toBe(15);
  });

  it("handles negative margins", () => {
    expect(calculateSaleProfit({ unitCost: 12, sellingPrice: 10, quantity: 2 })).toBe(-4);
  });

  it("zero quantity yields zero", () => {
    expect(calculateSaleProfit({ unitCost: 5, sellingPrice: 10, quantity: 0 })).toBe(0);
  });
});

describe("calculateProductSaleProfits", () => {
  it("uses initial_stock for per-unit cost", () => {
    const product = { purchase_price: 142, initial_stock: 25 };
    const sales = [
      { id: "s1", quantity_sold: 10, selling_price: 10 },
      { id: "s2", quantity_sold: 15, selling_price: 10 },
    ];
    const result = calculateProductSaleProfits(product, sales);
    expect(result[0].total_profit).toBe(43.2);
    expect(result[1].total_profit).toBe(64.8);
  });

  it("preserves other fields", () => {
    const product = { purchase_price: 100, initial_stock: 25 };
    const sales = [{ id: "s1", quantity_sold: 1, selling_price: 10, product_id: "p1" }];
    expect(calculateProductSaleProfits(product, sales)[0]).toMatchObject({
      id: "s1",
      product_id: "p1",
      quantity_sold: 1,
      selling_price: 10,
      total_profit: 6,
    });
  });

  it("handles empty sales", () => {
    expect(calculateProductSaleProfits({ purchase_price: 100, initial_stock: 25 }, [])).toEqual([]);
  });
});

describe("calculateProductTotalProfit", () => {
  it("sums all sale profits", () => {
    const product = { purchase_price: 142, initial_stock: 25 };
    const sales = [
      { quantity_sold: 10, selling_price: 10 },
      { quantity_sold: 15, selling_price: 10 },
    ];
    expect(calculateProductTotalProfit(product, sales)).toBe(108);
  });

  it("returns 0 with no sales", () => {
    expect(calculateProductTotalProfit({ purchase_price: 100, initial_stock: 25 }, [])).toBe(0);
  });
});

describe("calculateSalesWithCorrectProfit", () => {
  it("recomputes per product using initial_stock", () => {
    const products = [
      { id: "p1", purchase_price: 142, initial_stock: 25 },
      { id: "p2", purchase_price: 100, initial_stock: 10 },
    ];
    const sales = [
      { id: "s1", product_id: "p1", quantity_sold: 25, selling_price: 10, purchase_price: 5.68, total_profit: 0 },
      { id: "s2", product_id: "p2", quantity_sold: 5, selling_price: 20, purchase_price: 10, total_profit: 0 },
    ];
    const result = calculateSalesWithCorrectProfit(products, sales);
    expect(result.find((s) => s.id === "s1")!.total_profit).toBe(108);
    expect(result.find((s) => s.id === "s2")!.total_profit).toBe(50);
  });

  it("falls back to stored sale purchase_price when product missing", () => {
    const sales = [
      { id: "s1", product_id: "missing", quantity_sold: 25, selling_price: 10, purchase_price: 5.68, total_profit: 0 },
    ];
    expect(calculateSalesWithCorrectProfit([], sales)[0].total_profit).toBe(108);
  });

  it("preserves sale order", () => {
    const products = [{ id: "p1", purchase_price: 10, initial_stock: 10 }];
    const sales = [
      { id: "a", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
      { id: "b", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
      { id: "c", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
    ];
    expect(calculateSalesWithCorrectProfit(products, sales).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
