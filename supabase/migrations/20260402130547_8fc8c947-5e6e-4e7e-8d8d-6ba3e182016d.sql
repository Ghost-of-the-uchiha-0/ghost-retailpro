
-- Drop and recreate overly permissive INSERT/UPDATE/DELETE policies

-- expenses: INSERT
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- products: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
CREATE POLICY "Authenticated users can delete products" ON public.products FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- sales: INSERT
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
CREATE POLICY "Authenticated users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
