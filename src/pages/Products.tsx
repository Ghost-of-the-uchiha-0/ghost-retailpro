import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];
type Product = Database["public"]["Tables"]["products"]["Row"];

const categories: { value: ProductCategory; label: string }[] = [
  { value: "ice_cream", label: "Ice Cream" },
  { value: "perfume", label: "Perfume / Cologne" },
  { value: "shoes", label: "Shoes" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "other");
  const [purchasePrice, setPurchasePrice] = useState(product?.purchase_price?.toString() ?? "");
  const [sellingPrice, setSellingPrice] = useState(product?.selling_price?.toString() ?? "");
  const [stock, setStock] = useState(product?.stock_quantity?.toString() ?? "0");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        category,
        purchase_price: parseFloat(purchasePrice),
        selling_price: parseFloat(sellingPrice),
        stock_quantity: parseInt(stock),
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(product ? "Product updated" : "Product added");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (parseFloat(purchasePrice) < 0 || parseFloat(sellingPrice) < 0 || parseInt(stock) < 0) {
          toast.error("Values cannot be negative");
          return;
        }
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="text-muted-foreground">Product Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="bg-surface border-border" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">Category</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
          <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Purchase Price</Label>
          <Input type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required className="bg-surface border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Selling Price</Label>
          <Input type="number" step="0.01" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required className="bg-surface border-border" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">Stock Quantity</Label>
        <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required className="bg-surface border-border" />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full gold-gradient text-primary-foreground font-semibold">
        {mutation.isPending ? "Saving..." : product ? "Update Product" : "Add Product"}
      </Button>
    </form>
  );
}

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
  });

  const filtered = products?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your inventory</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditProduct(undefined); }}>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-primary-foreground font-semibold gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <ProductForm product={editProduct} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-right py-3 px-4">Buy Price</th>
                <th className="text-right py-3 px-4">Sell Price</th>
                <th className="text-right py-3 px-4">Stock</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No products found</td></tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-muted-foreground capitalize">{p.category.replace("_", " ")}</td>
                    <td className="py-3 px-4 text-right">${p.purchase_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-primary">${p.selling_price.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right ${p.stock_quantity <= 5 ? "text-destructive font-semibold" : ""}`}>{p.stock_quantity}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setEditProduct(p); setDialogOpen(true); }}
                          className="p-1.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(p.id)}
                          className="p-1.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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
