import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Pencil, Package, Shield, Settings2,
  Download, AlertCircle, Loader2, Check, X, Users, Briefcase, RefreshCw
} from "lucide-react";
import type {
  AdminProduct, AdminEntitlement, AdminProductOverride
} from "@shared/schema";

type ProductWithEntitlements = AdminProduct & { entitlementIds: number[] };
type ProductWithOverrides = ProductWithEntitlements & { overrides: AdminProductOverride[] };

function ProductsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: products, isLoading } = useQuery<ProductWithEntitlements[]>({
    queryKey: ["/api/admin/products"],
  });
  const { data: entitlements } = useQuery<AdminEntitlement[]>({
    queryKey: ["/api/admin/entitlements"],
  });

  const [form, setForm] = useState({
    name: "",
    audience: "Job Seeker",
    kind: "base_plan",
    billingType: "subscription",
    planType: "Subscription",
    priceMonthly: "",
    priceYearly: "",
    priceOneTime: "",
    logicKey: "",
    trialDays: "0",
    status: "Active",
    entitlementIds: [] as number[],
    grantEntitlementKey: "",
    grantAmount: "",
    creditExpiryMonths: "12",
  });

  const resetForm = () => {
    setForm({
      name: "", audience: "Job Seeker", kind: "base_plan",
      billingType: "subscription", planType: "Subscription",
      priceMonthly: "", priceYearly: "", priceOneTime: "",
      logicKey: "", trialDays: "0", status: "Active", entitlementIds: [],
      grantEntitlementKey: "", grantAmount: "", creditExpiryMonths: "12",
    });
    setEditId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        audience: form.audience,
        kind: form.kind,
        billingType: form.billingType,
        planType: form.planType,
        priceMonthly: form.priceMonthly ? parseFloat(form.priceMonthly) : null,
        priceYearly: form.priceYearly ? parseFloat(form.priceYearly) : null,
        priceOneTime: form.priceOneTime ? parseFloat(form.priceOneTime) : null,
        logicKey: form.logicKey || null,
        trialDays: parseInt(form.trialDays) || 0,
        status: form.status,
        entitlementIds: form.entitlementIds,
        grantEntitlementKey: form.grantEntitlementKey || null,
        grantAmount: form.grantAmount ? parseInt(form.grantAmount) : null,
        creditExpiryMonths: form.creditExpiryMonths ? parseInt(form.creditExpiryMonths) : null,
      };
      if (editId) {
        return apiRequest("PATCH", `/api/admin/products/${editId}`, body);
      }
      return apiRequest("POST", "/api/admin/products", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: editId ? "Product updated" : "Product created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: number; newStatus: string }) => {
      return apiRequest("PATCH", `/api/admin/products/${id}`, { status: newStatus });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: `Product ${variables.newStatus === "Active" ? "activated" : "deactivated"}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Product permanently deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (p: ProductWithEntitlements) => {
    setForm({
      name: p.name,
      audience: p.audience,
      kind: p.kind,
      billingType: p.billingType,
      planType: p.planType,
      priceMonthly: p.priceMonthly?.toString() || "",
      priceYearly: p.priceYearly?.toString() || "",
      priceOneTime: p.priceOneTime?.toString() || "",
      logicKey: p.logicKey || "",
      trialDays: p.trialDays.toString(),
      status: p.status,
      entitlementIds: p.entitlementIds || [],
      grantEntitlementKey: p.grantEntitlementKey || "",
      grantAmount: p.grantAmount?.toString() || "",
      creditExpiryMonths: p.creditExpiryMonths?.toString() || "12",
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const toggleEntitlement = (eid: number) => {
    setForm((prev) => ({
      ...prev,
      entitlementIds: prev.entitlementIds.includes(eid)
        ? prev.entitlementIds.filter((id) => id !== eid)
        : [...prev.entitlementIds, eid],
    }));
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" data-testid="text-products-heading">Products</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-product">
          <Plus size={16} className="mr-1" /> Add Product
        </Button>
      </div>

      {(() => {
        const isJobSeeker = (aud: string) => aud === "job_seeker" || aud.toLowerCase().includes("job") || aud.toLowerCase().includes("seeker");
        const isEmployer = (aud: string) => aud === "employer" || aud.toLowerCase().includes("employer");
        const jobSeekerProducts = products?.filter((p) => isJobSeeker(p.audience) && p.planType !== "Top-up") || [];
        const employerProducts = products?.filter((p) => isEmployer(p.audience) && !isJobSeeker(p.audience) && p.planType !== "Top-up") || [];
        const addOnProducts = products?.filter((p) => p.planType === "Top-up") || [];

        const renderProductCard = (p: ProductWithEntitlements) => (
          <div key={p.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900 flex items-center justify-between" data-testid={`card-product-${p.id}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant={p.status === "Active" ? "default" : "secondary"}>{p.status}</Badge>
                <Badge variant="outline">{p.planType}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {p.billingType === "subscription" && (
                  <>
                    {p.priceMonthly != null && p.priceMonthly > 0 && <span>${p.priceMonthly}/mo </span>}
                    {p.priceYearly != null && p.priceYearly > 0 && <span>${p.priceYearly}/yr </span>}
                    {!p.priceMonthly && !p.priceYearly && <span>Free </span>}
                  </>
                )}
                {p.billingType === "one_time" && p.priceOneTime != null && <span>${p.priceOneTime} one-time </span>}
                {p.logicKey && <span className="text-xs text-gray-400">· {p.logicKey}</span>}
                {p.stripeProductId && <span className="text-xs text-green-600 ml-2">· Stripe ✓</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={p.status === "Active"}
                disabled={toggleStatusMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleStatusMutation.mutate({ id: p.id, newStatus: checked ? "Active" : "Inactive" })
                }
                data-testid={`switch-product-status-${p.id}`}
              />
              <Button variant="ghost" size="sm" onClick={() => startEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm(`Permanently delete "${p.name}"? This cannot be undone. (Stripe products are not affected.)`)) {
                  deleteMutation.mutate(p.id);
                }
              }} data-testid={`button-delete-product-${p.id}`}>
                <Trash2 size={14} className="text-red-500" />
              </Button>
            </div>
          </div>
        );

        if (!products?.length) {
          return (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products">
              No products yet. Seed from snapshot or create manually.
            </div>
          );
        }

        return (
          <div className="space-y-8">
            {jobSeekerProducts.length > 0 && (
              <div data-testid="section-job-seeker-products">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users size={18} /> Job Seeker Products
                  <Badge variant="outline" className="ml-1">{jobSeekerProducts.length}</Badge>
                </h3>
                <div className="space-y-3">{jobSeekerProducts.map(renderProductCard)}</div>
              </div>
            )}
            {employerProducts.length > 0 && (
              <div data-testid="section-employer-products">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Briefcase size={18} /> Employer Products
                  <Badge variant="outline" className="ml-1">{employerProducts.length}</Badge>
                </h3>
                <div className="space-y-3">{employerProducts.map(renderProductCard)}</div>
              </div>
            )}
            {addOnProducts.length > 0 && (
              <div data-testid="section-addon-products">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package size={18} /> Add-On Products
                  <Badge variant="outline" className="ml-1">{addOnProducts.length}</Badge>
                </h3>
                <div className="space-y-3">{addOnProducts.map(renderProductCard)}</div>
              </div>
            )}
          </div>
        );
      })()}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-product-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Audience</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                  <SelectTrigger data-testid="select-audience"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Job Seeker">Job Seeker</SelectItem>
                    <SelectItem value="Employer">Employer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan Type</Label>
                <Select value={form.planType} onValueChange={(v) => setForm({ ...form, planType: v })}>
                  <SelectTrigger data-testid="select-plan-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Subscription">Subscription</SelectItem>
                    <SelectItem value="Top-up">Top-up</SelectItem>
                    <SelectItem value="Admin/Flag">Admin/Flag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base_plan">Base Plan</SelectItem>
                    <SelectItem value="add_on">Add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing Type</Label>
                <Select value={form.billingType} onValueChange={(v) => setForm({ ...form, billingType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.billingType === "subscription" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly Price ($)</Label>
                  <Input type="number" step="0.01" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} data-testid="input-price-monthly" />
                </div>
                <div>
                  <Label>Yearly Price ($)</Label>
                  <Input type="number" step="0.01" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} data-testid="input-price-yearly" />
                </div>
              </div>
            )}
            {form.billingType === "one_time" && (
              <div>
                <Label>One-time Price ($)</Label>
                <Input type="number" step="0.01" value={form.priceOneTime} onChange={(e) => setForm({ ...form, priceOneTime: e.target.value })} data-testid="input-price-one-time" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Logic Key</Label>
                <Input value={form.logicKey} onChange={(e) => setForm({ ...form, logicKey: e.target.value })} placeholder="e.g. js_starter" data-testid="input-logic-key" />
              </div>
              <div>
                <Label>Trial Days</Label>
                <Input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} data-testid="input-trial-days" />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.planType === "Top-up" && (
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20 space-y-3">
                <Label className="text-sm font-semibold text-orange-700 dark:text-orange-400">Credit Grant Settings (Top-Up)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Entitlement Key</Label>
                    <Input value={form.grantEntitlementKey} onChange={(e) => setForm({ ...form, grantEntitlementKey: e.target.value })} placeholder="applications_per_month" data-testid="input-grant-key" />
                  </div>
                  <div>
                    <Label className="text-xs">Credits to Grant</Label>
                    <Input type="number" value={form.grantAmount} onChange={(e) => setForm({ ...form, grantAmount: e.target.value })} placeholder="10" data-testid="input-grant-amount" />
                  </div>
                  <div>
                    <Label className="text-xs">Expiry (Months)</Label>
                    <Input type="number" value={form.creditExpiryMonths} onChange={(e) => setForm({ ...form, creditExpiryMonths: e.target.value })} placeholder="12" data-testid="input-credit-expiry" />
                  </div>
                </div>
              </div>
            )}
            {entitlements && entitlements.length > 0 && (
              <div>
                <Label>Entitlements</Label>
                <div className="border rounded p-3 space-y-2 max-h-40 overflow-y-auto mt-1">
                  {entitlements.filter(e => e.status === "Active").map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.entitlementIds.includes(e.id)}
                        onChange={() => toggleEntitlement(e.id)}
                      />
                      <span>{e.name}</span>
                      <Badge variant="outline" className="text-xs">{e.type}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name} className="w-full" data-testid="button-save-product">
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {editId ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntitlementsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: entitlements, isLoading } = useQuery<AdminEntitlement[]>({
    queryKey: ["/api/admin/entitlements"],
  });

  const [form, setForm] = useState({
    name: "", key: "", type: "Flag" as "Limit" | "Flag",
    unit: "", defaultValue: "", status: "Active",
  });

  const resetForm = () => {
    setForm({ name: "", key: "", type: "Flag", unit: "", defaultValue: "", status: "Active" });
    setEditId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        key: form.key,
        type: form.type,
        unit: form.unit || null,
        defaultValue: form.defaultValue || null,
        status: form.status,
      };
      if (editId) {
        return apiRequest("PATCH", `/api/admin/entitlements/${editId}`, body);
      }
      return apiRequest("POST", "/api/admin/entitlements", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entitlements"] });
      toast({ title: editId ? "Entitlement updated" : "Entitlement created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/entitlements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entitlements"] });
      toast({ title: "Entitlement deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (e: AdminEntitlement) => {
    setForm({
      name: e.name, key: e.key, type: e.type as "Limit" | "Flag",
      unit: e.unit || "", defaultValue: e.defaultValue || "", status: e.status,
    });
    setEditId(e.id);
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" data-testid="text-entitlements-heading">Entitlements</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-entitlement">
          <Plus size={16} className="mr-1" /> Add Entitlement
        </Button>
      </div>

      <div className="space-y-3">
        {entitlements?.map((e) => (
          <div key={e.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900 flex items-center justify-between" data-testid={`card-entitlement-${e.id}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{e.name}</span>
                <Badge variant="outline">{e.type}</Badge>
                <Badge variant={e.status === "Active" ? "default" : "secondary"}>{e.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Key: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{e.key}</code>
                {e.unit && <span> · {e.unit}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => startEdit(e)} data-testid={`button-edit-entitlement-${e.id}`}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm(`Delete "${e.name}"? This will remove all related overrides.`)) {
                  deleteMutation.mutate(e.id);
                }
              }} data-testid={`button-delete-entitlement-${e.id}`}>
                <Trash2 size={14} className="text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {entitlements?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No entitlements yet.</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Entitlement" : "Add Entitlement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-entitlement-name" />
            </div>
            <div>
              <Label>Key</Label>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. can_post_jobs" data-testid="input-entitlement-key" disabled={!!editId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "Limit" | "Flag" })}>
                  <SelectTrigger data-testid="select-entitlement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flag">Flag</SelectItem>
                    <SelectItem value="Limit">Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "Limit" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. posts" />
                </div>
                <div>
                  <Label>Default Value</Label>
                  <Input value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} placeholder="0" />
                </div>
              </div>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name || !form.key} className="w-full" data-testid="button-save-entitlement">
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {editId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverridesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: products } = useQuery<ProductWithEntitlements[]>({
    queryKey: ["/api/admin/products"],
  });
  const { data: entitlements } = useQuery<AdminEntitlement[]>({
    queryKey: ["/api/admin/entitlements"],
  });
  const { data: overrides, isLoading } = useQuery<AdminProductOverride[]>({
    queryKey: ["/api/admin/product-overrides", selectedProductId],
    queryFn: async () => {
      const url = selectedProductId && selectedProductId !== "all"
        ? `/api/admin/product-overrides?productId=${selectedProductId}`
        : "/api/admin/product-overrides";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load overrides");
      return res.json();
    },
  });

  const [form, setForm] = useState({
    productId: "", entitlementId: "",
    value: "", isUnlimited: false, enabled: false,
    status: "Active", notes: "",
  });

  const resetForm = () => {
    const validProductId = selectedProductId && selectedProductId !== "all" ? selectedProductId : "";
    setForm({
      productId: validProductId, entitlementId: "",
      value: "", isUnlimited: false, enabled: false,
      status: "Active", notes: "",
    });
    setEditId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        productId: parseInt(form.productId),
        entitlementId: parseInt(form.entitlementId),
        value: form.value ? parseFloat(form.value) : null,
        isUnlimited: form.isUnlimited,
        enabled: form.enabled,
        status: form.status,
        notes: form.notes || null,
      };
      if (editId) {
        return apiRequest("PATCH", `/api/admin/product-overrides/${editId}`, body);
      }
      return apiRequest("POST", "/api/admin/product-overrides", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-overrides"] });
      toast({ title: editId ? "Override updated" : "Override created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/product-overrides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-overrides"] });
      toast({ title: "Override deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getProductName = (id: number) => products?.find((p) => p.id === id)?.name || `#${id}`;
  const getEntitlementName = (id: number) => entitlements?.find((e) => e.id === id)?.name || `#${id}`;
  const getEntitlementType = (id: number) => entitlements?.find((e) => e.id === id)?.type || "Flag";

  const startEdit = (o: AdminProductOverride) => {
    setForm({
      productId: o.productId.toString(),
      entitlementId: o.entitlementId.toString(),
      value: o.value?.toString() || "",
      isUnlimited: o.isUnlimited,
      enabled: o.enabled,
      status: o.status,
      notes: o.notes || "",
    });
    setEditId(o.id);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" data-testid="text-overrides-heading">Product Overrides</h2>
        <div className="flex items-center gap-3">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-[200px]" data-testid="select-override-product-filter">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-override">
            <Plus size={16} className="mr-1" /> Add Override
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {overrides?.map((o) => (
            <div key={o.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900 flex items-center justify-between" data-testid={`card-override-${o.id}`}>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getProductName(o.productId)}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{getEntitlementName(o.entitlementId)}</span>
                  <Badge variant={o.status === "Active" ? "default" : "secondary"}>{o.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {getEntitlementType(o.entitlementId) === "Limit" ? (
                    o.isUnlimited ? <span className="text-green-600">Unlimited</span> : <span>Value: {o.value ?? 0}</span>
                  ) : (
                    <span>{o.enabled ? "✓ Enabled" : "✗ Disabled"}</span>
                  )}
                  {o.notes && <span className="ml-2 text-xs">· {o.notes}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => startEdit(o)} data-testid={`button-edit-override-${o.id}`}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm("Delete this override?")) deleteMutation.mutate(o.id);
                }} data-testid={`button-delete-override-${o.id}`}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          {overrides?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No overrides found.</div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Override" : "Add Override"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger data-testid="select-override-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entitlement</Label>
              <Select value={form.entitlementId} onValueChange={(v) => setForm({ ...form, entitlementId: v })}>
                <SelectTrigger data-testid="select-override-entitlement"><SelectValue placeholder="Select entitlement" /></SelectTrigger>
                <SelectContent>
                  {entitlements?.filter(e => e.status === "Active").map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.entitlementId && getEntitlementType(parseInt(form.entitlementId)) === "Limit" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label>Unlimited</Label>
                  <Switch checked={form.isUnlimited} onCheckedChange={(v) => setForm({ ...form, isUnlimited: v })} />
                </div>
                {!form.isUnlimited && (
                  <div>
                    <Label>Value</Label>
                    <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="input-override-value" />
                  </div>
                )}
              </div>
            )}
            {form.entitlementId && getEntitlementType(parseInt(form.entitlementId)) === "Flag" && (
              <div className="flex items-center gap-3">
                <Label>Enabled</Label>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.productId || !form.entitlementId}
              className="w-full"
              data-testid="button-save-override"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {editId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotionSyncSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    products?: number;
    entitlements?: number;
    overrides?: number;
    elapsed?: number;
    error?: string;
    errorCount?: number;
    usedFallback?: boolean;
    upsert?: {
      products: { created: number; updated: number };
      entitlements: { created: number; updated: number };
      overrides: { created: number; updated: number };
      archived: { products: number; entitlements: number; overrides: number };
    };
  } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/registry-sync/products"),
    onSuccess: async (res) => {
      const data = await res.json();
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/seed-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-overrides"] });
      const u = data.upsert;
      if (data.ok && !data.usedFallback) {
        const desc = u
          ? `${data.products} products synced (${u.products.created} new, ${u.products.updated} updated).`
          : `${data.products} products, ${data.entitlements} entitlements refreshed.`;
        toast({ title: "Notion sync complete", description: desc });
      } else if (u && data.usedFallback) {
        const reason = data.error === "fetch_failed"
          ? "Could not reach Notion — applied from last successful sync."
          : `${data.errorCount || 0} validation issue(s) in Notion — applied from last successful sync.`;
        toast({
          title: "Applied from cached data",
          description: `${u.products.created + u.products.updated} products applied. ${reason}`,
        });
      } else if (!u && !data.ok) {
        toast({
          title: "Notion sync failed",
          description: data.error === "validation_failed"
            ? `${data.errorCount} validation error(s) — no cached snapshots available to fall back on.`
            : data.message || data.error,
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "Notion sync failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-lg p-5 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800" data-testid="notion-sync-section">
      <div className="flex items-start gap-3">
        <RefreshCw className="text-violet-600 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-violet-800 dark:text-violet-200">Refresh from Notion</h3>
          <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
            Pull the latest products, entitlements, and overrides from the Notion registry and apply them to the admin database.
          </p>
          {lastResult && lastResult.upsert && !lastResult.usedFallback && (
            <div className="text-sm text-violet-800 dark:text-violet-200 mt-2 font-medium" data-testid="text-notion-sync-result">
              <p>Applied: {lastResult.upsert.products.created} new / {lastResult.upsert.products.updated} updated products · {lastResult.upsert.entitlements.created} new / {lastResult.upsert.entitlements.updated} updated entitlements · {lastResult.upsert.overrides.created} new / {lastResult.upsert.overrides.updated} updated overrides</p>
              {lastResult.elapsed && <p className="mt-1 text-xs">Synced in {lastResult.elapsed}ms</p>}
            </div>
          )}
          {lastResult && lastResult.upsert && lastResult.usedFallback && (
            <div className="text-sm mt-2 font-medium" data-testid="text-notion-sync-fallback">
              <p className="text-amber-700 dark:text-amber-300">
                {lastResult.error === "fetch_failed"
                  ? "Could not reach Notion — applied from last successful sync."
                  : `Applied from last successful sync — Notion data has ${lastResult.errorCount || 0} validation issue(s). Fix them to get a fresh sync.`}
              </p>
              <p className="text-amber-600 dark:text-amber-400 mt-1">Applied: {lastResult.upsert.products.created} new / {lastResult.upsert.products.updated} updated products · {lastResult.upsert.entitlements.created} new / {lastResult.upsert.entitlements.updated} updated entitlements · {lastResult.upsert.overrides.created} new / {lastResult.upsert.overrides.updated} updated overrides</p>
            </div>
          )}
          {lastResult && !lastResult.ok && !lastResult.upsert && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-2 font-medium" data-testid="text-notion-sync-error">
              Sync failed: {lastResult.error} {lastResult.errorCount ? `(${lastResult.errorCount} errors)` : ""} — No cached snapshots available. Fix Notion data issues and retry.
            </p>
          )}
          <div className="mt-4">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              variant="outline"
              className="border-violet-300 text-violet-700 hover:bg-violet-100 dark:text-violet-200 dark:hover:bg-violet-900/40"
              data-testid="button-sync-notion"
            >
              {syncMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw size={16} className="mr-2" />}
              {syncMutation.isPending ? "Syncing…" : "Refresh from Notion"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StripeSyncSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<{
    created: number; updated: number; total: number;
    discrepancies?: Array<{ productName: string; field: string; adminValue: number | null; stripeValue: number | null }>;
  } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/products/sync-from-stripe"),
    onSuccess: async (res) => {
      const data = await res.json();
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      const discMsg = data.discrepancies?.length ? ` ${data.discrepancies.length} price discrepancy(ies) detected — review and update manually.` : "";
      toast({
        title: "Stripe sync complete",
        description: `${data.created} created, ${data.updated} updated (${data.total} Stripe products found).${discMsg}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Stripe sync failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-lg p-5 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" data-testid="stripe-sync-section">
      <div className="flex items-start gap-3">
        <RefreshCw className="text-blue-600 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200">Sync from Stripe</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Import active Stripe products and prices into this dashboard. Existing products are updated with current Stripe price IDs. Price discrepancies are reported but not auto-corrected — update prices manually if needed. New Stripe products are created as Active entries.
          </p>
          {lastResult && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium" data-testid="text-stripe-sync-result">
                Last sync: {lastResult.created} created, {lastResult.updated} updated ({lastResult.total} Stripe products)
              </p>
              {lastResult.discrepancies && lastResult.discrepancies.length > 0 && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3" data-testid="stripe-discrepancy-list">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Price discrepancies detected (admin values kept — update manually if needed):</p>
                  {lastResult.discrepancies.map((d, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                      {d.productName} · {d.field}: admin had ${d.adminValue} → Stripe has ${d.stripeValue}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-4">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40"
              data-testid="button-sync-stripe"
            >
              {syncMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw size={16} className="mr-2" />}
              {syncMutation.isPending ? "Syncing…" : "Sync from Stripe"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeedSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [hidden, setHidden] = useState(false);

  const { data: seedStatus } = useQuery<{ seeded: boolean; completedAt: string | null; result: any }>({
    queryKey: ["/api/admin/products/seed-status"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/products/seed-from-snapshot"),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/seed-status"] });
      toast({
        title: "Seed complete",
        description: `${data.products} products, ${data.entitlements} entitlements, ${data.overrides} overrides imported.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/products/seed-reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/seed-status"] });
      toast({ title: "All product data cleared" });
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  if (hidden) return null;

  if (seedStatus?.seeded) {
    const result = seedStatus.result;
    const completedDate = seedStatus.completedAt ? new Date(seedStatus.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" data-testid="seed-complete-banner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="text-green-600" size={20} />
              <div>
                <span className="font-semibold text-green-800 dark:text-green-200">Snapshot seed complete</span>
                <span className="text-sm text-green-700 dark:text-green-300 ml-2">
                  {result && `${result.products} products, ${result.entitlements} entitlements, ${result.overrides} overrides`}
                  {completedDate && ` · ${completedDate}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (confirm("This will delete ALL products, entitlements, and overrides. Are you sure?")) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                data-testid="button-seed-reset"
              >
                {resetMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHidden(true)} data-testid="button-hide-seed">
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>
        <StripeSyncSection />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">Seed from Registry Snapshot</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Import products, entitlements, and overrides from the active Notion registry snapshot. This is a one-time migration.
              </p>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  variant="outline"
                  className="border-amber-300"
                  data-testid="button-seed-snapshot"
                >
                  {seedMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download size={16} className="mr-2" />}
                  Seed from Snapshot
                </Button>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setHidden(true)} className="text-amber-600" data-testid="button-hide-seed">
            <X size={14} />
          </Button>
        </div>
      </div>
      <StripeSyncSection />
    </div>
  );
}

export default function ProductManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-product-management-title">
          <Package size={24} /> Product Management
        </h1>
        <p className="text-muted-foreground mt-1">Manage products, entitlements, and overrides. Changes auto-sync with Stripe.</p>
      </div>

      <NotionSyncSection />
      <SeedSection />

      <Tabs defaultValue="products">
        <TabsList data-testid="tabs-product-management">
          <TabsTrigger value="products" data-testid="tab-products">
            <Package size={14} className="mr-1" /> Products
          </TabsTrigger>
          <TabsTrigger value="entitlements" data-testid="tab-entitlements">
            <Shield size={14} className="mr-1" /> Entitlements
          </TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">
            <Settings2 size={14} className="mr-1" /> Overrides
          </TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="entitlements"><EntitlementsTab /></TabsContent>
        <TabsContent value="overrides"><OverridesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
