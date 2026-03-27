import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Package, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function StatCard({ title, value, icon: Icon, accent = false }: { title: string; value: string; icon: React.ElementType; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 card-hover animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground text-sm">{title}</span>
        <Icon className={`w-5 h-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-heading font-bold ${accent ? "gold-text-gradient" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, products(name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = sales?.reduce((sum, s) => sum + s.selling_price * s.quantity_sold, 0) ?? 0;
  const totalProfit = sales?.reduce((sum, s) => sum + s.total_profit, 0) ?? 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const netProfit = totalProfit - totalExpenses;
  const totalStock = products?.reduce((sum, p) => sum + p.stock_quantity, 0) ?? 0;

  // Chart data: sales by product
  const salesByProduct = products?.map((p) => {
    const productSales = sales?.filter((s) => s.product_id === p.id) ?? [];
    const unitsSold = productSales.reduce((sum, s) => sum + s.quantity_sold, 0);
    return { name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name, sold: unitsSold, revenue: productSales.reduce((sum, s) => sum + s.selling_price * s.quantity_sold, 0) };
  }).filter(d => d.sold > 0) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Business overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} accent />
        <StatCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon={TrendingUp} accent />
        <StatCard title="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} icon={TrendingDown} />
        <StatCard title="Stock Units" value={totalStock.toString()} icon={Package} />
      </div>

      {/* Products Stock Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-heading font-semibold mb-4">Stock Overview</h2>
        {products && products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-3">Product</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-right py-2 px-3">Stock</th>
                  <th className="text-right py-2 px-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground capitalize">{p.category.replace("_", " ")}</td>
                    <td className={`py-2.5 px-3 text-right ${p.stock_quantity <= 5 ? "text-destructive font-semibold" : ""}`}>
                      {p.stock_quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right text-primary">${p.selling_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No products yet. Add some in the Products page.</p>
        )}
      </div>

      {/* Sales Chart */}
      {salesByProduct.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-heading font-semibold mb-4">Sales by Product</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} axisLine={{ stroke: "hsl(0 0% 15%)" }} />
                <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} axisLine={{ stroke: "hsl(0 0% 15%)" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 15%)", borderRadius: "8px", color: "white" }}
                />
                <Bar dataKey="sold" fill="hsl(51 100% 50%)" radius={[4, 4, 0, 0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
