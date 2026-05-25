import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Pencil, Trash2 } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { calculateProductSaleProfits, calculateSaleProfit, calculateSalesWithCorrectProfit } from "@/lib/profit";

type SaleRow = {
  id: string;
  product_id: string;
  quantity_sold: number;
  selling_price: number;
  purchase_price: number;
  total_profit: number;
  sale_date: string;
  products: { name: string } | null;
};

export default function Sales() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [editSale, setEditSale] = useState<SaleRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [deleteSale, setDeleteSale] = useState<SaleRow | null>(null);

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
      const { data, error } = await supabase
        .from("sales")
        .select("*, products(name)")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as unknown as SaleRow[];
    },
  });

  const selectedProduct = products?.find((p) => p.id === productId);
  const salesWithCorrectProfit = sales && products ? calculateSalesWithCorrectProfit(products, sales) : [];

  const getSalesForProduct = (targetProductId: string, excludeSaleId?: string) =>
    salesWithCorrectProfit.filter((sale) => sale.product_id === targetProductId && sale.id !== excludeSaleId);

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Select a product");
      const qty = parseInt(quantity);
      if (qty <= 0) throw new Error("Quantity must be positive");
      if (qty > selectedProduct.stock_quantity) throw new Error("Insufficient stock");

      const profit = calculateSaleProfit({
        purchasePrice: selectedProduct.purchase_price,
        sellingPrice: selectedProduct.selling_price,
        quantity: qty,
      });

      const { error: saleError } = await supabase.from("sales").insert({
        product_id: selectedProduct.id,
        quantity_sold: qty,
        selling_price: selectedProduct.selling_price,
        purchase_price: selectedProduct.purchase_price,
        total_profit: profit,
      });
      if (saleError) throw saleError;

      const { error: stockError } = await (supabase.rpc as any)("decrement_stock", {
        p_product_id: selectedProduct.id,
        p_quantity: qty,
      });
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

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editSale) throw new Error("No sale selected");
      const newQty = parseInt(editQty);
      if (!newQty || newQty <= 0) throw new Error("Quantity must be positive");

      const product = products?.find((p) => p.id === editSale.product_id);
      if (!product) throw new Error("Product not found");

      const delta = newQty - editSale.quantity_sold; // positive = take more stock
      if (delta > product.stock_quantity) throw new Error("Insufficient stock for this change");

      const otherSales = getSalesForProduct(editSale.product_id, editSale.id).map((sale) => ({
        id: sale.id,
        quantity_sold: sale.quantity_sold,
        selling_price: sale.selling_price,
      }));
      const recalculatedSales = calculateProductSaleProfits(
        {
          purchase_price: product.purchase_price,
          stock_quantity: product.stock_quantity + editSale.quantity_sold,
        },
        [
          ...otherSales,
          {
            id: editSale.id,
            quantity_sold: newQty,
            selling_price: editSale.selling_price,
          },
        ],
      );
      const updatedSale = recalculatedSales.find((sale) => sale.id === editSale.id);
      if (!updatedSale) throw new Error("Could not recalculate sale profit");

      const { error: updErr } = await supabase
        .from("sales")
        .update({ quantity_sold: newQty, total_profit: updatedSale.total_profit })
        .eq("id", editSale.id);
      if (updErr) throw updErr;

      if (delta !== 0) {
        const { error: stockErr } = await (supabase.rpc as any)("adjust_stock", {
          p_product_id: editSale.product_id,
          p_delta: -delta,
        });
        if (stockErr) throw stockErr;
      }

      const remainingSales = recalculatedSales.filter((sale) => sale.id !== editSale.id);
      await Promise.all(
        remainingSales.map((sale) =>
          supabase.from("sales").update({ total_profit: sale.total_profit }).eq("id", sale.id),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale updated");
      setEditSale(null);
      setEditQty("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteSale) throw new Error("No sale selected");
      const { error: delErr } = await supabase.from("sales").delete().eq("id", deleteSale.id);
      if (delErr) throw delErr;
      const { error: stockErr } = await (supabase.rpc as any)("adjust_stock", {
        p_product_id: deleteSale.product_id,
        p_delta: deleteSale.quantity_sold,
      });
      if (stockErr) throw stockErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale deleted");
      setDeleteSale(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">Record and view sales</p>
        </div>
        {salesWithCorrectProfit.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-primary"
              onClick={() => {
                const headers = ["Date", "Product", "Qty", "Price", "Revenue", "Profit"];
                const rows = salesWithCorrectProfit.map((s) => [
                  format(new Date(s.sale_date), "yyyy-MM-dd"),
                  s.products?.name ?? "—",
                  s.quantity_sold.toString(),
                  s.selling_price.toFixed(2),
                  (s.selling_price * s.quantity_sold).toFixed(2),
                  s.total_profit.toFixed(2),
                ]);
                exportToCSV("sales_report", headers, rows);
              }}
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-primary"
              onClick={() => {
                const totalRev = salesWithCorrectProfit.reduce((s, r) => s + r.selling_price * r.quantity_sold, 0);
                const totalProf = salesWithCorrectProfit.reduce((s, r) => s + r.total_profit, 0);
                const headers = ["Date", "Product", "Qty", "Price", "Revenue", "Profit"];
                const rows = salesWithCorrectProfit.map((s) => [
                  format(new Date(s.sale_date), "yyyy-MM-dd"),
                  s.products?.name ?? "—",
                  s.quantity_sold.toString(),
                  `R${s.selling_price.toFixed(2)}`,
                  `R${(s.selling_price * s.quantity_sold).toFixed(2)}`,
                  `R${s.total_profit.toFixed(2)}`,
                ]);
                exportToPDF("Sales Report", "sales_report", headers, rows, [
                  `Total Revenue: R${totalRev.toFixed(2)}`,
                  `Total Profit: R${totalProf.toFixed(2)}`,
                ]);
              }}
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        )}
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
            Selling at <span className="text-primary font-medium">R{selectedProduct.selling_price.toFixed(2)}</span> each
            (batch cost: R{selectedProduct.purchase_price.toFixed(2)} for entire stock)
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
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : !salesWithCorrectProfit.length ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No sales yet</td></tr>
              ) : (
                salesWithCorrectProfit.map((s, i) => (
                  <tr key={s.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-3 px-4 text-muted-foreground">{format(new Date(s.sale_date), "MMM d, yyyy")}</td>
                    <td className="py-3 px-4 font-medium">{s.products?.name ?? "—"}</td>
                    <td className="py-3 px-4 text-right">{s.quantity_sold}</td>
                    <td className="py-3 px-4 text-right">R{s.selling_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary">R{(s.selling_price * s.quantity_sold).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary font-medium">R{s.total_profit.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditSale(s);
                            setEditQty(s.quantity_sold.toString());
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteSale(s)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editSale} onOpenChange={(o) => !o && setEditSale(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {editSale && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editSale.products?.name} — original qty: {editSale.quantity_sold}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Quantity Sold</Label>
                <Input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="bg-surface border-border"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSale(null)}>Cancel</Button>
            <Button
              className="gold-gradient text-primary-foreground font-semibold"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteSale} onOpenChange={(o) => !o && setDeleteSale(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the sale and return {deleteSale?.quantity_sold} unit(s) back to stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
