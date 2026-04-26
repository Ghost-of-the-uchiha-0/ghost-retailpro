
CREATE POLICY "Authenticated users can update sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.products
  SET stock_quantity = GREATEST(0, stock_quantity + p_delta)
  WHERE id = p_product_id;
END;
$$;
