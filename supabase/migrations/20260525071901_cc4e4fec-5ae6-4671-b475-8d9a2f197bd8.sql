-- Add initial_stock to products to track original batch size for per-unit cost calculations
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS initial_stock integer NOT NULL DEFAULT 0;

-- Backfill initial_stock = current stock + total units ever sold (best estimate of original batch size)
UPDATE public.products p
SET initial_stock = GREATEST(
  1,
  p.stock_quantity + COALESCE((SELECT SUM(s.quantity_sold) FROM public.sales s WHERE s.product_id = p.id), 0)
);

-- Recompute historical sale per-unit purchase price and total_profit using new batch model
UPDATE public.sales s
SET
  purchase_price = ROUND((p.purchase_price / NULLIF(p.initial_stock, 0))::numeric, 4),
  total_profit = ROUND(((s.selling_price - (p.purchase_price / NULLIF(p.initial_stock, 0))) * s.quantity_sold)::numeric, 2)
FROM public.products p
WHERE s.product_id = p.id
  AND p.initial_stock > 0;