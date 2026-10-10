"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Product = { code: string; name: string; carrier: string };
type ShippingOrder = {
  shippingServiceCode: string | null; ship123OrderNo: string | null;
  ship123LabelUrl: string | null; ship123CreateState: string | null;
};

export function Ship123LabelPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<ShippingOrder | null>(null);
  const [productCode, setProductCode] = useState("");
  const [knownOrderNo, setKnownOrderNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/orders/${orderId}/ship123`, { credentials: "include", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load shipping services");
        if (controller.signal.aborted) return;
        setProducts(data.products);
        setOrder(data.order);
        if (data.warning) setError(data.warning);
        setProductCode(data.order.shippingServiceCode || data.products[0]?.code || "");
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load shipping services"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orderId]);

  async function submit() {
    if (!productCode || working) return;
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/ship123`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode, ...(knownOrderNo.trim() ? { knownOrderNo: knownOrderNo.trim() } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ship123 action failed");
      setOrder(previous => previous ? {
        ...previous, ship123OrderNo: data.orderNo, ship123LabelUrl: data.labelUrl ?? previous.ship123LabelUrl,
        ship123CreateState: "CREATED", shippingServiceCode: productCode,
      } : previous);
      setKnownOrderNo("");
      toast.success(data.labelUrl ? "Shipping label ready" : "Shipping order created; label is still processing");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ship123 action failed");
    } finally { setWorking(false); }
  }

  return <Card>
    <CardHeader><CardTitle className="text-base">Ship123 shipping label</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      {loading && <p>Loading available services…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!loading && !products.length && !order?.ship123OrderNo && <p>No named shipping service is enabled in this Ship123 account. Enable one before creating a label.</p>}
      {!loading && (products.length > 0 || !!order?.ship123OrderNo) && <>
        {products.length > 0 && <div className="space-y-1">
          <Label htmlFor="ship123-service">Shipping service</Label>
          <select id="ship123-service" className="w-full rounded-md border bg-background p-2" value={productCode}
            disabled={!!order?.ship123OrderNo || !!order?.shippingServiceCode}
            onChange={event => setProductCode(event.target.value)}>
            {products.map(product => <option key={product.code} value={product.code}>{product.name} ({product.carrier})</option>)}
          </select>
        </div>}
        {(order?.ship123CreateState === "UNKNOWN" || order?.ship123CreateState === "CREATING") && !order.ship123OrderNo &&
          <div className="space-y-1">
            <Label htmlFor="ship123-known-order">Existing Ship123 order number</Label>
            <Input id="ship123-known-order" value={knownOrderNo} onChange={event => setKnownOrderNo(event.target.value)}
              placeholder="Find the customer order in Ship123 before attaching it" />
            <p className="text-xs text-muted-foreground">Creation may have succeeded. This action will verify the customer reference before attaching it.</p>
          </div>}
        {!order?.ship123OrderNo && !order?.ship123CreateState &&
          <p className="text-xs text-muted-foreground">Creating this label sends a real shipping order to Ship123, even if the customer used a test payment. Ship123 may charge your account.</p>}
        <Button type="button" onClick={submit} disabled={working || !productCode || (!!order?.ship123CreateState && !order.ship123OrderNo && !knownOrderNo.trim())}>
          {working ? "Checking Ship123…" : order?.ship123OrderNo ? "Refresh label" : knownOrderNo.trim() ? "Attach existing order" : "Create shipping label"}
        </Button>
      </>}
      {order?.ship123OrderNo && <p>Ship123 order: <span className="font-mono">{order.ship123OrderNo}</span></p>}
      {order?.ship123LabelUrl && <a className="underline" href={order.ship123LabelUrl} target="_blank" rel="noopener noreferrer">Open label PDF</a>}
    </CardContent>
  </Card>;
}
