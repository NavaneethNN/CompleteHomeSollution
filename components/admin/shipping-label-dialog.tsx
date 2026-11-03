"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  ExternalLink,
  Package,
  Truck,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { generateCode128Svg } from "@/lib/barcode";

interface LabelDataResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  fulfillmentType: string | null;
  carrier: string;
  serviceName: string;
  consignmentCode: string;
  trackingNumber: string;
  isCouriersPlease?: boolean;
  hasCouriersPleaseBooking?: boolean;
  couriersPleaseLabelUrl?: string;
  createdAt: string;
  sender: {
    name: string;
    line1: string;
    suburb: string;
    state: string;
    postcode: string;
    phone: string;
    email: string;
  };
  recipient: {
    name: string;
    line1: string;
    line2?: string | null;
    suburb: string;
    state: string;
    postcode: string;
    phone?: string | null;
    email?: string | null;
  };
  parcel: {
    packageName: string;
    length: number;
    width: number;
    height: number;
    weight: number;
    cubicWeight: number;
    itemCount: number;
    items: Array<{ name: string; quantity: number; sku?: string }>;
    specialInstructions: string;
  };
  packagingPresets: Array<{
    id: string;
    name: string;
    length: number;
    width: number;
    height: number;
    maxWeight: number;
  }>;
}

interface ShippingLabelDialogProps {
  orderId: string;
  orderNumber?: string;
  fulfillmentType?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShippingLabelDialog({
  orderId,
  orderNumber: initialOrderNumber,
  fulfillmentType: initialFulfillmentType,
  open,
  onOpenChange,
}: ShippingLabelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LabelDataResponse | null>(null);

  // Editable form state for live updates
  const [carrier, setCarrier] = useState("Couriers Please");
  const [serviceName, setServiceName] = useState("ROAD EXPRESS - TRACKED");
  const [consignmentCode, setConsignmentCode] = useState("");
  const [length, setLength] = useState(30);
  const [width, setWidth] = useState(25);
  const [height, setHeight] = useState(20);
  const [weight, setWeight] = useState(1.0);
  const [packageName, setPackageName] = useState("Standard Package");
  const [instructions, setInstructions] = useState("Safe drop permitted");
  const [printFormat, setPrintFormat] = useState<"thermal" | "a4">("thermal");
  const [isPrinting, setIsPrinting] = useState(false);
  const [bookingCouriersPlease, setBookingCouriersPlease] = useState(false);

  // Fetch full order label data when modal opens
  const fetchLabelData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/label-data`);
      if (!res.ok) throw new Error("Failed to load order label data");
      const json: LabelDataResponse = await res.json();
      setData(json);
      setCarrier(json.carrier);
      setServiceName(json.serviceName);
      setConsignmentCode(json.consignmentCode);
      setLength(json.parcel.length);
      setWidth(json.parcel.width);
      setHeight(json.parcel.height);
      setWeight(json.parcel.weight);
      setPackageName(json.parcel.packageName);
      setInstructions(json.parcel.specialInstructions || "Safe drop permitted");
    } catch (err: any) {
      setError(err?.message || "Failed to load label data");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const handleBookCouriersPlease = async () => {
    setBookingCouriersPlease(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packedLength: length,
          packedWidth: width,
          packedHeight: height,
          packedWeight: weight,
          specialInstructions: instructions.slice(0, 15),
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Couriers Please booking failed");
      }
      await fetchLabelData();
    } catch (err: any) {
      alert(err.message || "Failed to create consignment with Couriers Please");
    } finally {
      setBookingCouriersPlease(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLabelData();
    }
  }, [open, fetchLabelData]);

  // Cubic weight calculation
  const cubicWeight = useMemo(() => {
    return Math.round(((length * width * height) / 4000) * 100) / 100;
  }, [length, width, height]);

  // Code 128 barcode SVG generated in real time
  const barcodeSvg = useMemo(() => {
    const code = consignmentCode.trim() || initialOrderNumber || "CHS99999999";
    return generateCode128Svg(code, {
      height: 48,
      moduleWidth: 1.8,
      showText: false,
    });
  }, [consignmentCode, initialOrderNumber]);

  // Format date
  const formattedDate = useMemo(() => {
    if (!data?.createdAt) return new Date().toLocaleDateString("en-AU");
    return new Date(data.createdAt).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [data?.createdAt]);

  // Handle Preset change
  const handlePresetSelect = (presetId: string) => {
    if (!data?.packagingPresets) return;
    const preset = data.packagingPresets.find((p) => p.id === presetId);
    if (preset) {
      setPackageName(preset.name);
      setLength(preset.length);
      setWidth(preset.width);
      setHeight(preset.height);
    }
  };

  // Hidden iframe printing ensures 0 page-bleed or UI artifacts
  const handlePrint = () => {
    if (carrier.includes("Couriers Please") && data?.hasCouriersPleaseBooking) {
      setIsPrinting(true);
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.src = `/api/admin/orders/${orderId}/couriersplease/label`;
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          window.open(`/api/admin/orders/${orderId}/couriersplease/label`, "_blank");
        }
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
          setIsPrinting(false);
        }, 1500);
      };
      return;
    }

    setIsPrinting(true);
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const labelHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Label #${data?.orderNumber || "ORDER"}</title>
          <style>
            @page {
              size: 100mm 150mm;
              margin: 0mm;
            }
            * { box-sizing: border-box; }
            html, body {
              width: 100mm;
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label-card {
              width: 100mm;
              min-height: 150mm;
              border: 2px solid #000;
              padding: 3.5mm;
              display: flex;
              flex-direction: column;
            }
            .header-bar {
              background: #000;
              color: #fff;
              padding: 8px 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .header-title {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: -0.5px;
              text-transform: uppercase;
              line-height: 1;
              margin: 0;
            }
            .header-sub {
              font-size: 8px;
              font-weight: 700;
              letter-spacing: 1px;
              color: #ccc;
              margin-top: 3px;
              text-transform: uppercase;
            }
            .badge-prio {
              background: #fff;
              color: #000;
              font-size: 8px;
              font-weight: 900;
              padding: 2px 5px;
              text-transform: uppercase;
            }
            .hub-box {
              border-bottom: 2px solid #000;
              padding: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f8f8f8;
            }
            .hub-suburb {
              font-size: 18px;
              font-weight: 900;
              text-transform: uppercase;
              margin: 0;
              line-height: 1.1;
            }
            .hub-postcode {
              font-size: 18px;
              font-weight: 900;
              text-align: right;
              line-height: 1.1;
            }
            .consignee-box {
              border-bottom: 2px solid #000;
              padding: 8px;
              font-size: 10px;
            }
            .consignee-name {
              font-size: 12px;
              font-weight: 900;
              margin-top: 2px;
            }
            .sender-box {
              border-bottom: 2px solid #000;
              padding: 6px 8px;
              font-size: 8px;
              color: #333;
            }
            .specs-box {
              border-bottom: 2px solid #000;
              padding: 6px 8px;
              font-size: 8px;
            }
            .specs-grid {
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #ddd;
              margin-top: 4px;
              padding-top: 4px;
              font-family: monospace;
            }
            .inst-box {
              border-bottom: 2px solid #000;
              padding: 6px 8px;
              background: #fafafa;
              font-size: 8.5px;
            }
            .barcode-section {
              padding: 10px 4px 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .barcode-code {
              font-family: monospace;
              font-size: 9px;
              font-weight: 900;
              margin-top: 4px;
              letter-spacing: 1px;
            }
            .footer-line {
              margin-top: auto;
              padding-top: 4px;
              border-top: 1px solid #ccc;
              display: flex;
              justify-content: space-between;
              font-size: 7px;
              font-family: monospace;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="header-bar">
              <div>
                <h1 class="header-title">${carrier.toUpperCase()}</h1>
                <div class="header-sub">${serviceName.toUpperCase()}</div>
              </div>
              <div style="text-align: right;">
                <span class="badge-prio">STANDARD</span>
                <div style="font-size: 8px; color: #ccc; margin-top: 2px; font-family: monospace;">${formattedDate}</div>
              </div>
            </div>

            <div class="hub-box">
              <div>
                <div style="font-size: 7px; font-weight: bold; color: #666; text-transform: uppercase;">DESTINATION HUB</div>
                <h2 class="hub-suburb">${(data?.recipient.suburb || "LOCAL").toUpperCase()}</h2>
              </div>
              <div>
                <div class="hub-postcode">${(data?.recipient.state || "").toUpperCase()} ${data?.recipient.postcode || ""}</div>
                <div style="font-size: 7.5px; font-weight: bold; font-family: monospace; color: #666; text-align: right;">ZONE: ${(data?.recipient.state || "AU").toUpperCase()}-01</div>
              </div>
            </div>

            <div class="consignee-box">
              <div style="display: flex; justify-content: space-between; font-size: 7px; font-weight: bold; color: #666;">
                <span>DELIVER TO / CONSIGNEE:</span>
                <span>REF #${data?.orderNumber || "ORDER"}</span>
              </div>
              <div class="consignee-name">${data?.recipient.name || "Customer"}</div>
              <div style="font-weight: 600;">${data?.recipient.line1 || ""}</div>
              ${data?.recipient.line2 ? `<div>${data.recipient.line2}</div>` : ""}
              <div style="font-weight: bold; text-transform: uppercase;">${data?.recipient.suburb || ""} ${data?.recipient.state || ""} ${data?.recipient.postcode || ""} AU</div>
              ${data?.recipient.phone ? `<div style="margin-top: 2px; font-family: monospace; font-size: 8.5px;">TEL: ${data.recipient.phone}</div>` : ""}
            </div>

            <div class="sender-box">
              <div style="font-size: 7px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 2px;">FROM (SENDER):</div>
              <div style="font-weight: bold; color: #000;">${data?.sender.name || "Complete Home Solution"}</div>
              <div>${data?.sender.line1 || "18 Edison Drive"}, ${data?.sender.suburb || "Golden Grove"} ${data?.sender.state || "SA"} ${data?.sender.postcode || "5125"} AU</div>
              <div style="font-family: monospace;">TEL: ${data?.sender.phone || "0401 682 910"}</div>
            </div>

            <div class="specs-box">
              <div style="display: flex; justify-content: space-between;">
                <div><strong>Box:</strong> ${packageName}</div>
                <div><strong>Size:</strong> ${length}×${width}×${height} cm</div>
              </div>
              <div class="specs-grid">
                <div>Weight: <strong>${weight.toFixed(2)} kg</strong></div>
                <div>Cubic: <strong>${cubicWeight.toFixed(2)} kg</strong></div>
                <div>Items: <strong>${data?.parcel.itemCount || 1}</strong></div>
              </div>
            </div>

            <div class="inst-box">
              <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 8px;">
                <span>AUTHORITY TO LEAVE: YES</span>
                <span>SAFE DROP</span>
              </div>
              <div style="margin-top: 2px; color: #222;">${instructions}</div>
            </div>

            <div class="barcode-section">
              <div style="width: 100%; display: flex; justify-content: center;">${barcodeSvg}</div>
              <div class="barcode-code">CONSIGNMENT: ${consignmentCode}</div>
            </div>

            <div class="footer-line">
              <span>COMPLETE HOME SOLLUTION DISPATCH</span>
              <span>STANDARD 4x6" CARRIER LABEL</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(labelHtml);
      frameDoc.close();
      printFrame.contentWindow?.focus();
      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
          setIsPrinting(false);
        }, 1000);
      }, 350);
    } else {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-50 border-slate-200">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Shipping &amp; Courier Label Generator
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  Order #{data?.orderNumber || initialOrderNumber || "ORDER"}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate, customize, and print 100×150mm (4"×6") thermal or A4 carrier labels with scannable barcode.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Preparing shipping label specifications…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchLabelData}>
              Try Again
            </Button>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
            {/* Left: Customization Controls */}
            <div className="md:col-span-5 p-5 bg-white border-r border-slate-200 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Carrier / Service
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCarrier("Couriers Please");
                      setServiceName("ROAD EXPRESS - TRACKED");
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      carrier.includes("Couriers Please")
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    Couriers Please
                    <span className="block text-[10px] text-slate-500 font-normal">Tracked Road</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCarrier("Australia Post");
                      setServiceName("PARCEL POST - SIGNATURE");
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      carrier.includes("Australia Post")
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    Australia Post
                    <span className="block text-[10px] text-slate-500 font-normal">eParcel Standard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCarrier("CHS Local Delivery");
                      setServiceName("DIRECT DISPATCH - BULKY");
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      carrier.includes("CHS Local Delivery")
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    CHS Local Van
                    <span className="block text-[10px] text-slate-500 font-normal">Store Driver</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCarrier("CHS Store Pickup");
                      setServiceName("WAREHOUSE PICKUP DOCKET");
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      carrier.includes("CHS Store Pickup")
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    Store Pickup
                    <span className="block text-[10px] text-slate-500 font-normal">Warehouse Docket</span>
                  </button>
                </div>
              </div>

              {/* Package Presets & Dimensions */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Packaging Box &amp; Dimensions
                  </Label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Cubic: {cubicWeight} kg
                  </span>
                </div>

                {data.packagingPresets && data.packagingPresets.length > 0 && (
                  <select
                    className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-800"
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Standard Box Preset…</option>
                    {data.packagingPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.length}×{p.width}×{p.height} cm)
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block">L (cm)</span>
                    <Input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W (cm)</span>
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">H (cm)</span>
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Wt (kg)</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Instructions */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Delivery Notes / ATL
                </Label>
                <Input
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Safe drop permitted on porch"
                  className="h-8 text-xs"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setInstructions("Safe drop permitted in protected area.")}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Safe Drop
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructions("Signature required. Do not safe drop.")}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Signature Required
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructions("Fragile goods. Handle with extreme care.")}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Fragile
                  </button>
                </div>
              </div>

              {/* Tracking / Consignment Code */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Consignment / Barcode Code
                </Label>
                <Input
                  value={consignmentCode}
                  onChange={(e) => setConsignmentCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Order Manifest Summary */}
              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Manifest Items ({data.parcel.items.length})
                </Label>
                <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  {data.parcel.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate pr-2">{it.quantity}× {it.name}</span>
                      <span className="font-mono text-slate-400 shrink-0">{it.sku || "PROD"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Live Interactive Label Preview */}
            <div className="md:col-span-7 p-6 flex flex-col items-center justify-center bg-slate-100/70 overflow-y-auto max-h-[75vh]">
              {carrier.includes("Couriers Please") && data.hasCouriersPleaseBooking ? (
                <div className="w-full flex flex-col items-center">
                  <div className="flex items-center justify-between w-full mb-3 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-950">Official Carrier Label generated directly by Couriers Please API</span>
                    </div>
                    <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-mono text-[11px]">
                      {data.consignmentCode}
                    </Badge>
                  </div>

                  <div className="w-full h-[530px] rounded-lg border-2 border-slate-300 overflow-hidden shadow-md bg-white">
                    <iframe
                      src={`/api/admin/orders/${orderId}/couriersplease/label`}
                      className="w-full h-full border-0"
                      title="Official Couriers Please Carrier Label"
                    />
                  </div>
                </div>
              ) : carrier.includes("Couriers Please") && !data.hasCouriersPleaseBooking ? (
                <div className="w-full max-w-md p-8 text-center bg-white border border-blue-200 rounded-xl shadow-xs space-y-4">
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-slate-900 text-base">Generate Official Couriers Please Label</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This order will be registered directly with the <strong>Couriers Please Carrier API</strong> with confirmed dimensions ({length}×{width}×{height} cm, {weight} kg).
                      Couriers Please will generate its authentic carrier routing label with live tracking barcode.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleBookCouriersPlease}
                    disabled={bookingCouriersPlease}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 gap-2 shadow-sm"
                  >
                    {bookingCouriersPlease ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {bookingCouriersPlease ? "Contacting Couriers Please…" : "Generate Official Label with Couriers Please"}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Preview Format Switcher */}
                  <div className="flex items-center gap-2 mb-4 bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPrintFormat("thermal")}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        printFormat === "thermal" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      4" × 6" Thermal Sticker
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintFormat("a4")}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        printFormat === "a4" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      A4 Paper Document
                    </button>
                  </div>

                  {/* Realistic Thermal Label Card */}
                  <div
                    className={`transition-all ${
                      printFormat === "a4"
                        ? "p-6 bg-white border border-slate-300 shadow-md rounded-md"
                        : "shadow-lg"
                    }`}
                  >
                    <div
                      className="bg-white text-slate-950 border-2 border-black select-none"
                      style={{
                        width: "360px",
                        minHeight: "520px",
                        padding: "12px",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      {/* Carrier Header */}
                      <div className="bg-black text-white p-2.5 flex items-center justify-between">
                        <div>
                          <h1 className="text-base font-black tracking-tight leading-none uppercase">
                            {carrier}
                          </h1>
                          <p className="text-[9px] font-bold tracking-wider text-slate-200 mt-1 uppercase">
                            {serviceName}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block bg-white text-black text-[8px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                            PRIORITY
                          </span>
                          <p className="text-[8px] text-slate-300 font-mono mt-1">
                            {formattedDate}
                          </p>
                        </div>
                      </div>

                      {/* Destination Hub */}
                      <div className="border-b-2 border-black py-2 px-1 flex items-center justify-between bg-slate-50/60">
                        <div>
                          <p className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500">Destination Hub</p>
                          <h2 className="text-lg font-black leading-tight uppercase tracking-tight text-slate-950">
                            {data.recipient.suburb}
                          </h2>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black leading-tight tracking-tight text-slate-950">
                            {data.recipient.state} {data.recipient.postcode}
                          </div>
                          <p className="text-[8px] font-bold font-mono text-slate-600 uppercase">
                            ZONE: {data.recipient.state}-01
                          </p>
                        </div>
                      </div>

                      {/* Consignee */}
                      <div className="border-b-2 border-black py-2 px-1 space-y-0.5 text-xs">
                        <div className="flex items-center justify-between text-[7.5px] font-black text-slate-500">
                          <span>DELIVER TO:</span>
                          <span>REF #{data.orderNumber}</span>
                        </div>
                        <p className="text-xs font-black text-slate-950">{data.recipient.name}</p>
                        <p className="text-[11px] font-semibold text-slate-900">{data.recipient.line1}</p>
                        {data.recipient.line2 && <p className="text-[10px] text-slate-700">{data.recipient.line2}</p>}
                        <p className="text-[11px] font-black text-slate-950 uppercase">
                          {data.recipient.suburb} {data.recipient.state} {data.recipient.postcode} AU
                        </p>
                        {data.recipient.phone && (
                          <p className="text-[9px] font-mono font-bold text-slate-700 pt-0.5">
                            TEL: {data.recipient.phone}
                          </p>
                        )}
                      </div>

                      {/* Sender */}
                      <div className="border-b-2 border-black py-1.5 px-1 text-[8.5px] text-slate-700 leading-tight">
                        <span className="text-[7px] font-black uppercase text-slate-500 block mb-0.5">SENDER (FROM):</span>
                        <p className="font-bold text-slate-900">{data.sender.name}</p>
                        <p>{data.sender.line1}, {data.sender.suburb} {data.sender.state} {data.sender.postcode}</p>
                      </div>

                      {/* Parcel Specs */}
                      <div className="border-b-2 border-black py-1.5 px-1 text-[8.5px]">
                        <div className="flex justify-between font-medium">
                          <span>Box: <strong>{packageName}</strong></span>
                          <span className="font-mono">{length}×{width}×{height} cm</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-1 mt-1 border-t border-slate-200 font-mono text-[8px]">
                          <div>Dead: <strong>{weight.toFixed(2)} kg</strong></div>
                          <div>Cubic: <strong>{cubicWeight.toFixed(2)} kg</strong></div>
                          <div className="text-right">Items: <strong>{data.parcel.itemCount}</strong></div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="border-b-2 border-black py-1.5 px-1 bg-slate-50/80 text-[8.5px]">
                        <div className="flex justify-between font-black text-[7.5px]">
                          <span>AUTHORITY TO LEAVE: YES</span>
                          <span className="text-emerald-700">SAFE DROP</span>
                        </div>
                        <p className="text-[9px] text-slate-800 mt-0.5 font-medium">{instructions}</p>
                      </div>

                      {/* Barcode Section */}
                      <div className="pt-2.5 pb-1 flex flex-col items-center justify-center">
                        <div
                          className="w-full flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                        />
                        <p className="text-[9px] font-mono font-black text-slate-950 tracking-wider text-center mt-1">
                          CONSIGNMENT: {consignmentCode}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="pt-1 border-t border-slate-300 flex justify-between text-[7px] font-mono text-slate-500">
                        <span>COMPLETE HOME SOLLUTION DISPATCH</span>
                        <span>100x150MM VECTOR CODE 128</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Modal Action Footer */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>
              {carrier.includes("Couriers Please")
                ? "Couriers Please official domestic carrier network."
                : "Barcode & dimensions synchronized with dispatch rules."}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>

            <a
              href={
                carrier.includes("Couriers Please")
                  ? `/api/admin/orders/${orderId}/couriersplease/label`
                  : `/api/admin/orders/${orderId}/shipping-label`
              }
              target="_blank"
              rel="noopener noreferrer"
              download={`label-${data?.orderNumber || "ORDER"}.pdf`}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                Download PDF
              </Button>
            </a>

            <Link
              href={
                carrier.includes("Couriers Please") && data?.hasCouriersPleaseBooking
                  ? `/api/admin/orders/${orderId}/couriersplease/label`
                  : `/admin/orders/${orderId}/label`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Full Page
              </Button>
            </Link>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-semibold shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              {isPrinting ? "Printing…" : "Print Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
