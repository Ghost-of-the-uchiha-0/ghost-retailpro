import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Expenses() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (amt < 0) throw new Error("Amount cannot be negative");
      const { error } = await supabase.from("expenses").insert({ name: name.trim(), amount: amt });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense added");
      setName("");
      setAmount("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Expenses</h1>
        <p className="text-muted-foreground text-sm mt-1">Track business expenses</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-heading font-semibold mb-4">Add Expense</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        >
          <div className="space-y-2">
            <Label className="text-muted-foreground">Expense Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="bg-surface border-border" placeholder="e.g. Rent, Utilities" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Amount</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="bg-surface border-border" />
          </div>
          <Button type="submit" disabled={mutation.isPending} className="gold-gradient text-primary-foreground font-semibold">
            {mutation.isPending ? "Adding..." : "Add Expense"}
          </Button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold">Expense History</h2>
          <span className="text-primary font-heading font-bold">Total: ${total.toFixed(2)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-right py-3 px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : !expenses?.length ? (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No expenses yet</td></tr>
              ) : (
                expenses.map((e, i) => (
                  <tr key={e.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-surface" : ""}`}>
                    <td className="py-3 px-4 text-muted-foreground">{format(new Date(e.expense_date), "MMM d, yyyy")}</td>
                    <td className="py-3 px-4 font-medium">{e.name}</td>
                    <td className="py-3 px-4 text-right text-destructive font-medium">${e.amount.toFixed(2)}</td>
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
