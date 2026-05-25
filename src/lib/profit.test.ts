import { describe, expect, it } from "vitest";
import {
  calculateProductSaleProfits,
  calculateProductTotalProfit,
  calculateSaleProfit,
  calculateSalesWithCorrectProfit,
} from "./profit";

describe("calculateSaleProfit", () => {
  it("returns (selling - purchase) * quantity", () => {
    expect(calculateSaleProfit({ purchasePrice: 5, sellingPrice: 10, quantity: 3 })).toBe(15);
  });

  it("handles negative margins", () => {
    expect(calculateSaleProfit({ purchasePrice: 12, sellingPrice: 10, quantity: 2 })).toBe(-4);
  });

  it("rounds to 2 decimals", () => {
    expect(calculateSaleProfit({ purchasePrice: 1.333, sellingPrice: 2, quantity: 3 })).toBe(2);
  });

  it("zero quantity yields zero", () => {
    expect(calculateSaleProfit({ purchasePrice: 5, sellingPrice: 10, quantity: 0 })).toBe(0);
  });
});

describe("calculateProductSaleProfits", () => {
  it("computes per-sale profit using product purchase price", () => {
    const product = { purchase_price: 4 };
    const sales = [
      { id: "s1", quantity_sold: 2, selling_price: 10 },
      { id: "s2", quantity_sold: 5, selling_price: 10 },
    ];
    const result = calculateProductSaleProfits(product, sales);
    expect(result[0].total_profit).toBe(12);
    expect(result[1].total_profit).toBe(30);
  });

  it("preserves other fields", () => {
    const product = { purchase_price: 4 };
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
    expect(calculateProductSaleProfits({ purchase_price: 4 }, [])).toEqual([]);
  });
});

describe("calculateProductTotalProfit", () => {
  it("sums all sale profits", () => {
    const product = { purchase_price: 3 };
    const sales = [
      { quantity_sold: 2, selling_price: 5 },
      { quantity_sold: 4, selling_price: 5 },
    ];
    expect(calculateProductTotalProfit(product, sales)).toBe(12);
  });

  it("returns 0 with no sales", () => {
    expect(calculateProductTotalProfit({ purchase_price: 3 }, [])).toBe(0);
  });
});

describe("calculateSalesWithCorrectProfit", () => {
  it("recomputes per product using current product purchase price", () => {
    const products = [
      { id: "p1", purchase_price: 4 },
      { id: "p2", purchase_price: 7 },
    ];
    const sales = [
      { id: "s1", product_id: "p1", quantity_sold: 2, selling_price: 10, purchase_price: 4, total_profit: 0 },
      { id: "s2", product_id: "p2", quantity_sold: 3, selling_price: 10, purchase_price: 7, total_profit: 0 },
    ];
    const result = calculateSalesWithCorrectProfit(products, sales);
    expect(result.find((s) => s.id === "s1")!.total_profit).toBe(12);
    expect(result.find((s) => s.id === "s2")!.total_profit).toBe(9);
  });

  it("falls back to stored sale purchase_price when product is missing", () => {
    const sales = [
      { id: "s1", product_id: "missing", quantity_sold: 2, selling_price: 10, purchase_price: 4, total_profit: 0 },
    ];
    expect(calculateSalesWithCorrectProfit([], sales)[0].total_profit).toBe(12);
  });

  it("preserves sale order", () => {
    const products = [{ id: "p1", purchase_price: 1 }];
    const sales = [
      { id: "a", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
      { id: "b", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
      { id: "c", product_id: "p1", quantity_sold: 1, selling_price: 2, purchase_price: 1, total_profit: 0 },
    ];
    expect(calculateSalesWithCorrectProfit(products, sales).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
