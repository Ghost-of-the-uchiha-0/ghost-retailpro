import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

export default function Sales() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, products(name)").order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedProduct = products?.find((p) => p.id === productId);

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Select a product");
      const qty = parseInt(quantity);
      if (qty <= 0) throw new Error("Quantity must be positive");
      if (qty > selectedProduct.stock_quantity) throw new Error("Insufficient stock");

      const profit = (selectedProduct.selling_price - selectedProduct.purchase_price) * qty;

      const { error: saleError } = await supabase.from("sales").insert({
        product_id: selectedProduct.id,
        quantity_sold: qty,
        selling_price: selectedProduct.selling_price,
        purchase_price: selectedProduct.purchase_price,
        total_profit: profit,
      });
      if (saleError) throw saleError;

      const { error: stockError } = await supabase
        .from("products")
        .update({ stock_quantity: selectedProduct.stock_quantity - qty })
        .eq("id", selectedProduct.id);
      if (stockError) throw stockError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale recorded!");
      setProductId("");
      setQuantity("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Sales</h1>
        <p className="text-muted-foreground text-sm mt-1">Record and view sales</p>
      </div>

      {/* Sale Form */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-heading font-semibold mb-4">Record a Sale</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saleMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-muted-foreground">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {products?.filter(p => p.stock_quantity > 0).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              min="1"
              max={selectedProduct?.stock_quantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="bg-surface border-border"
            />
          </div>
          <Button type="submit" disabled={saleMutation.isPending} className="gold-gradient text-primary-foreground font-semibold">
            {saleMutation.isPending ? "Recording..." : "Record Sale"}
          </Button>
        </form>
        {selectedProduct && quantity && parseInt(quantity) > 0 && (
          <div className="mt-3 text-sm text-muted-foreground">
            Selling at <span className="text-primary font-medium">${selectedProduct.selling_price.toFixed(2)}</span> each →
            Profit: <span className="text-primary font-medium">
              ${((selectedProduct.selling_price - selectedProduct.purchase_price) * parseInt(quantity)).toFixed(2)}
            </span>
          </div>
        )}
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
                <th className="text-left py-3 px-4">Product</th>
                <th className="text-right py-3 px-4">Qty</th>
                <th className="text-right py-3 px-4">Price</th>
                <th className="text-right py-3 px-4">Revenue</th>
                <th className="text-right py-3 px-4">Profit</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : !sales?.length ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No sales yet</td></tr>
              ) : (
                sales.map((s, i) => (
                  <tr key={s.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-3 px-4 text-muted-foreground">{format(new Date(s.sale_date), "MMM d, yyyy")}</td>
                    <td className="py-3 px-4 font-medium">{(s.products as any)?.name ?? "—"}</td>
                    <td className="py-3 px-4 text-right">{s.quantity_sold}</td>
                    <td className="py-3 px-4 text-right">${s.selling_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary">${(s.selling_price * s.quantity_sold).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary font-medium">${s.total_profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
