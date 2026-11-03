"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Package,
  Layers,
  FileText,
  ExternalLink,
} from "lucide-react";

export interface ShippingLabelViewProps {
  orderId: string;
  orderNumber: string;
  carrier: string;
  serviceName: string;
  trackingNumber: string;
  consignmentCode: string;
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
    itemNames: string[];
    specialInstructions?: string | null;
  };
  barcodeSvg: string;
  autoPrint?: boolean;
}

export function ShippingLabelView({
  orderId,
  orderNumber,
  carrier,
  serviceName,
  trackingNumber,
  consignmentCode,
  createdAt,
  sender,
  recipient,
  parcel,
  barcodeSvg,
  autoPrint = false,
}: ShippingLabelViewProps) {
  const [printFormat, setPrintFormat] = useState<"thermal" | "a4">("thermal");

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(createdAt).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-8 flex flex-col items-center">
      {/* Non-printable Control Toolbar */}
      <div className="no-print w-full max-w-[105mm] sm:max-w-xl mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link href={`/admin/orders/${orderId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <ArrowLeft className="h-4 w-4" />
              Back to Order #{orderNumber}
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPrintFormat("thermal")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                printFormat === "thermal" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              4" × 6" Thermal
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat("a4")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                printFormat === "a4" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              A4 Sheet
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="text-xs gap-1.5 h-8"
          >
            <a href={`/api/admin/orders/${orderId}/shipping-label`} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              PDF
            </a>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8 shadow-sm font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Label
          </Button>
        </div>
      </div>

      {/* Printable Courier Label Container */}
      <div
        className={`print-container ${
          printFormat === "a4" ? "p-8 bg-white border border-slate-200 shadow-sm rounded-lg" : ""
        }`}
      >
        <div
          id="courier-shipping-label"
          className="shipping-label-card bg-white text-slate-950 border-2 border-black rounded-none select-none"
          style={{
            width: "100mm",
            minHeight: "150mm",
            boxSizing: "border-box",
            fontFamily: "Arial, Helvetica, sans-serif",
            padding: "3.5mm",
          }}
        >
          {/* ── 1. Top Carrier Header ── */}
          <div className="bg-black text-white p-2.5 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none uppercase">
                {carrier || "COURIERS PLEASE"}
              </h1>
              <p className="text-[10px] font-bold tracking-widest text-slate-200 mt-1 uppercase">
                {serviceName || "ROAD EXPRESS - TRACKED"}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-white text-black text-[9px] font-black px-1.5 py-0.5 rounded-xs uppercase tracking-wider">
                PRIORITY
              </span>
              <p className="text-[10px] text-slate-300 font-mono font-medium mt-1">
                {formattedDate}
              </p>
            </div>
          </div>

          {/* ── 2. Routing Hub / Destination Postcode Box ── */}
          <div className="border-b-2 border-black py-2.5 px-2 flex items-center justify-between bg-slate-50/50">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Destination Hub</p>
              <h2 className="text-2xl font-black leading-none uppercase tracking-tight text-slate-950 mt-0.5">
                {recipient.suburb}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black leading-none tracking-tight text-slate-950">
                {recipient.state} {recipient.postcode}
              </div>
              <p className="text-[9px] font-bold font-mono text-slate-600 mt-0.5 uppercase">
                ZONE: {recipient.state}-01
              </p>
            </div>
          </div>

          {/* ── 3. DELIVER TO (Consignee) Section ── */}
          <div className="border-b-2 border-black py-2.5 px-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                DELIVER TO / SHIP TO:
              </span>
              <span className="text-[9px] font-mono font-semibold text-slate-600">
                REF #{orderNumber}
              </span>
            </div>
            <p className="text-sm font-black text-slate-950 leading-snug">
              {recipient.name || "Customer"}
            </p>
            <p className="text-xs font-semibold text-slate-900 leading-snug">
              {recipient.line1}
            </p>
            {recipient.line2 && (
              <p className="text-xs font-medium text-slate-800 leading-snug">
                {recipient.line2}
              </p>
            )}
            <p className="text-xs font-black text-slate-950 leading-snug uppercase">
              {recipient.suburb} {recipient.state} {recipient.postcode} AU
            </p>
            {recipient.phone && (
              <p className="text-[10px] font-bold text-slate-700 pt-0.5">
                TEL: <span className="font-mono">{recipient.phone}</span>
              </p>
            )}
          </div>

          {/* ── 4. SENDER (Consignor) Section ── */}
          <div className="border-b-2 border-black py-2 px-2 text-[9px] text-slate-700 leading-tight">
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
              SENDER (FROM):
            </span>
            <p className="font-bold text-slate-900">
              {sender.name}
            </p>
            <p>
              {sender.line1}, {sender.suburb} {sender.state} {sender.postcode} AU
            </p>
            <p className="font-mono text-slate-600">
              TEL: {sender.phone}
            </p>
          </div>

          {/* ── 5. Parcel Handling & Preset Specs ── */}
          <div className="border-b-2 border-black py-2 px-2 text-[9px] text-slate-800 space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[8px] font-bold uppercase text-slate-500 block">Package Box:</span>
                <span className="font-bold text-slate-950">{parcel.packageName}</span>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold uppercase text-slate-500 block">Dimensions:</span>
                <span className="font-mono font-bold text-slate-950">
                  {parcel.length}×{parcel.width}×{parcel.height} cm
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200 font-mono text-[9px]">
              <div>
                <span className="text-slate-500 block text-[7.5px] uppercase">Dead Wt:</span>
                <span className="font-bold text-slate-950">{parcel.weight.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[7.5px] uppercase">Cubic Wt:</span>
                <span className="font-bold text-slate-950">{parcel.cubicWeight.toFixed(2)} kg</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[7.5px] uppercase">Pieces:</span>
                <span className="font-bold text-slate-950">1 of 1</span>
              </div>
            </div>
          </div>

          {/* ── 6. Authority to Leave & Special Instructions ── */}
          <div className="border-b-2 border-black py-2 px-2 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-black uppercase text-slate-950">
                AUTHORITY TO LEAVE (ATL): YES
              </span>
              <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded-xs uppercase">
                SAFE DROP
              </span>
            </div>
            <p className="text-[9.5px] font-semibold text-slate-900 mt-0.5">
              Note: {parcel.specialInstructions || "Safe drop in protected location at front door."}
            </p>
          </div>

          {/* ── 7. Scannable Code 128 Barcode ── */}
          <div className="pt-3 pb-1 px-1 flex flex-col items-center justify-center">
            <div
              className="barcode-svg-wrapper w-full flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />
            <p className="text-[10px] font-mono font-black text-slate-950 tracking-wider text-center mt-1">
              CONSIGNMENT: {consignmentCode || trackingNumber}
            </p>
          </div>

          {/* ── 8. Bottom Verification Footer ── */}
          <div className="pt-1.5 border-t border-slate-300 flex items-center justify-between text-[7.5px] font-mono text-slate-500">
            <span>COMPLETE HOME SOLLUTION DISPATCH</span>
            <span>STANDARD 4x6" CARRIER TRANSPORT LABEL</span>
          </div>
        </div>
      </div>

      {/* Global CSS for Print Optimization */}
      <style jsx global>{`
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
          }
          .shipping-label-card {
            border: 2px solid black !important;
            box-shadow: none !important;
            width: 100mm !important;
            min-height: 150mm !important;
            max-width: 100mm !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            margin: 0 !important;
          }
          @page {
            size: 100mm 150mm;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}

