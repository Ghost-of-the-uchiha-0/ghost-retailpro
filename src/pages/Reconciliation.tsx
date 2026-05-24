import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { calculateProductSaleProfits } from "@/lib/profit";
import { exportToCSV } from "@/lib/exportUtils";

const fmt = (n: number) => `R ${n.toFixed(2)}`;
const EPSILON = 0.01;

export default function Reconciliation() {
  const [tab, setTab] = useState("mismatches");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, products(name)")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    if (!products || !sales) return [];
    const byProduct = new Map<string, any[]>();
    sales.forEach((s: any) => {
      if (!byProduct.has(s.product_id)) byProduct.set(s.product_id, []);
      byProduct.get(s.product_id)!.push(s);
    });

    const out: Array<{
      id: string;
      sale_date: string;
      product_id: string;
      product_name: string;
      quantity_sold: number;
      selling_price: number;
      stored_profit: number;
      computed_profit: number;
      diff: number;
    }> = [];

    products.forEach((p: any) => {
      const ps = byProduct.get(p.id) ?? [];
      const computed = calculateProductSaleProfits(p, ps);
      computed.forEach((c: any, i: number) => {
        const orig = ps[i];
        out.push({
          id: orig.id,
          sale_date: orig.sale_date,
          product_id: p.id,
          product_name: p.name,
          quantity_sold: orig.quantity_sold,
          selling_price: Number(orig.selling_price),
          stored_profit: Number(orig.total_profit),
          computed_profit: c.total_profit,
          diff: c.total_profit - Number(orig.total_profit),
        });
      });
    });
    return out.sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date));
  }, [products, sales]);

  const mismatches = rows.filter((r) => Math.abs(r.diff) > EPSILON);

  const byDay = useMemo(() => {
    const map = new Map<string, { stored: number; computed: number }>();
    rows.forEach((r) => {
      const day = format(new Date(r.sale_date), "yyyy-MM-dd");
      const cur = map.get(day) ?? { stored: 0, computed: 0 };
      cur.stored += r.stored_profit;
      cur.computed += r.computed_profit;
      map.set(day, cur);
    });
    return Array.from(map.entries())
      .map(([day, v]) => ({ day, ...v, diff: v.computed - v.stored }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [rows]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; stored: number; computed: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.product_id) ?? { name: r.product_name, stored: 0, computed: 0 };
      cur.stored += r.stored_profit;
      cur.computed += r.computed_profit;
      map.set(r.product_id, cur);
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, diff: v.computed - v.stored }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [rows]);

  const totalStored = rows.reduce((s, r) => s + r.stored_profit, 0);
  const totalComputed = rows.reduce((s, r) => s + r.computed_profit, 0);
  const totalDiff = totalComputed - totalStored;

  const exportMismatches = () => {
    exportToCSV(
      "profit-reconciliation",
      ["Date", "Product", "Qty", "Stored Profit (R)", "Computed Profit (R)", "Difference (R)"],
      mismatches.map((r) => [
        format(new Date(r.sale_date), "yyyy-MM-dd HH:mm"),
        r.product_name,
        String(r.quantity_sold),
        r.stored_profit.toFixed(2),
        r.computed_profit.toFixed(2),
        r.diff.toFixed(2),
      ])
    );
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading reconciliation...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold gold-text-gradient">Profit Reconciliation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compares stored sale profit vs recomputed profit using current batch cost.
          </p>
        </div>
        <Button variant="outline" onClick={exportMismatches} disabled={!mismatches.length}>
          <Download className="w-4 h-4" /> Export mismatches
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stored total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{fmt(totalStored)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Computed total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{fmt(totalComputed)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Difference</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-bold flex items-center gap-2 ${Math.abs(totalDiff) > EPSILON ? "text-destructive" : "text-primary"}`}>
            {Math.abs(totalDiff) > EPSILON ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {fmt(totalDiff)}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mismatches">Mismatches ({mismatches.length})</TabsTrigger>
          <TabsTrigger value="by-day">By day</TabsTrigger>
          <TabsTrigger value="by-product">By product</TabsTrigger>
        </TabsList>

        <TabsContent value="mismatches">
          <Card>
            <CardContent className="p-0">
              {mismatches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                  All sales reconcile with computed profit.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Stored</TableHead>
                      <TableHead className="text-right">Computed</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mismatches.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.sale_date), "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell>{r.product_name}</TableCell>
                        <TableCell className="text-right">{r.quantity_sold}</TableCell>
                        <TableCell className="text-right">{fmt(r.stored_profit)}</TableCell>
                        <TableCell className="text-right">{fmt(r.computed_profit)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.diff >= 0 ? "default" : "destructive"}>
                            {r.diff >= 0 ? "+" : ""}{fmt(r.diff)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-day">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Stored</TableHead>
                    <TableHead className="text-right">Computed</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byDay.map((d) => {
                    const off = Math.abs(d.diff) > EPSILON;
                    return (
                      <TableRow key={d.day} className={off ? "bg-destructive/5" : ""}>
                        <TableCell>{d.day}</TableCell>
                        <TableCell className="text-right">{fmt(d.stored)}</TableCell>
                        <TableCell className="text-right">{fmt(d.computed)}</TableCell>
                        <TableCell className={`text-right ${off ? "text-destructive font-medium" : ""}`}>
                          {d.diff >= 0 ? "+" : ""}{fmt(d.diff)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-product">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stored</TableHead>
                    <TableHead className="text-right">Computed</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProduct.map((p) => {
                    const off = Math.abs(p.diff) > EPSILON;
                    return (
                      <TableRow key={p.name} className={off ? "bg-destructive/5" : ""}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right">{fmt(p.stored)}</TableCell>
                        <TableCell className="text-right">{fmt(p.computed)}</TableCell>
                        <TableCell className={`text-right ${off ? "text-destructive font-medium" : ""}`}>
                          {p.diff >= 0 ? "+" : ""}{fmt(p.diff)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
