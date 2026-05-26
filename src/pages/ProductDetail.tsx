import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, TrendingUp, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { calculateProductSaleProfits } from "@/lib/profit";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading: prodLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["product-sales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("product_id", id!)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const isLoading = prodLoading || salesLoading;

  const salesWithCorrectProfit = product && sales ? calculateProductSaleProfits(product, sales) : [];

  const totalRevenue = salesWithCorrectProfit.reduce((sum, s) => sum + s.selling_price * s.quantity_sold, 0);
  const totalProfit = salesWithCorrectProfit.reduce((sum, s) => sum + s.total_profit, 0);
  const totalUnitsSold = salesWithCorrectProfit.reduce((sum, s) => sum + s.quantity_sold, 0);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Loading...</div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Link to="/products" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Link>
        <p className="text-muted-foreground">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/products">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5 capitalize">{product.category.replace("_", " ")}</p>
          </div>
        </div>
        {salesWithCorrectProfit.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-primary"
              onClick={() => {
                const headers = ["Date", "Qty", "Price", "Revenue", "Profit"];
                 const rows = salesWithCorrectProfit.map((s) => [
                  format(new Date(s.sale_date), "yyyy-MM-dd"),
                  s.quantity_sold.toString(),
                  s.selling_price.toFixed(2),
                  (s.selling_price * s.quantity_sold).toFixed(2),
                  s.total_profit.toFixed(2),
                ]);
                exportToCSV(`${product.name}_sales`, headers, rows);
              }}
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-primary"
              onClick={() => {
                const headers = ["Date", "Qty", "Price", "Revenue", "Profit"];
                 const rows = salesWithCorrectProfit.map((s) => [
                  format(new Date(s.sale_date), "yyyy-MM-dd"),
                  s.quantity_sold.toString(),
                  `R${s.selling_price.toFixed(2)}`,
                  `R${(s.selling_price * s.quantity_sold).toFixed(2)}`,
                  `R${s.total_profit.toFixed(2)}`,
                ]);
                exportToPDF(`${product.name} - Sales Report`, `${product.name}_sales`, headers, rows, [
                  `Total Revenue: R${totalRevenue.toFixed(2)}`,
                  `Total Profit: R${totalProfit.toFixed(2)}`,
                  `Total Units Sold: ${totalUnitsSold}`,
                ]);
              }}
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={`R${totalRevenue.toFixed(2)}`} />
        <StatCard icon={TrendingUp} label="Total Profit" value={`R${totalProfit.toFixed(2)}`} valueClass={totalProfit >= 0 ? "text-green-400" : "text-destructive"} />
        <StatCard icon={Package} label="Units Sold" value={totalUnitsSold.toString()} />
        <StatCard icon={Package} label="Stock Remaining" value={product.stock_quantity.toString()} valueClass={product.stock_quantity <= 5 ? "text-destructive" : ""} />
      </div>

      {/* Product Info */}
      <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Batch Cost / Per Unit</span>
          <p className="font-medium mt-1">
            R{product.purchase_price.toFixed(2)} <span className="text-muted-foreground">/</span> R{(product.purchase_price / Math.max(1, (product as any).initial_stock)).toFixed(2)}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Selling Price (each)</span>
          <p className="font-medium mt-1 text-primary">R{product.selling_price.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Stock</span>
          <p className="font-medium mt-1">{product.stock_quantity}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Added</span>
          <p className="font-medium mt-1">{format(new Date(product.created_at), "MMM d, yyyy")}</p>
        </div>
      </div>

      {/* Sales History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-semibold">Sales History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">Qty</th>
                <th className="text-right py-3 px-4">Price</th>
                <th className="text-right py-3 px-4">Revenue</th>
                <th className="text-right py-3 px-4">Profit</th>
              </tr>
            </thead>
            <tbody>
              {!salesWithCorrectProfit.length ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No sales recorded for this product</td></tr>
              ) : (
                salesWithCorrectProfit.map((s, i) => (
                  <tr key={s.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-3 px-4 text-muted-foreground">{format(new Date(s.sale_date), "MMM d, yyyy")}</td>
                    <td className="py-3 px-4 text-right">{s.quantity_sold}</td>
                    <td className="py-3 px-4 text-right">R{s.selling_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary">R{(s.selling_price * s.quantity_sold).toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${s.total_profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                      R{s.total_profit.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {salesWithCorrectProfit.length > 0 && (
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-3 px-4">Totals</td>
                  <td className="py-3 px-4 text-right">{totalUnitsSold}</td>
                  <td className="py-3 px-4 text-right"></td>
                  <td className="py-3 px-4 text-right text-primary">R{totalRevenue.toFixed(2)}</td>
                  <td className={`py-3 px-4 text-right ${totalProfit >= 0 ? "text-green-400" : "text-destructive"}`}>
                    R{totalProfit.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, valueClass = "" }: { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
