import { encodeCode128 } from "./barcode";

export interface CourierLabelData {
  orderId: string;
  orderNumber: string;
  carrier: string;
  serviceName: string;
  trackingNumber: string;
  consignmentCode: string;
  createdAt: Date | string;
  sender: {
    name: string;
    line1: string;
    suburb: string;
    state: string;
    postcode: string;
    phone: string;
  };
  recipient: {
    name: string;
    line1: string;
    line2?: string | null;
    suburb: string;
    state: string;
    postcode: string;
    phone?: string | null;
  };
  parcel: {
    packageName: string;
    length: number;
    width: number;
    height: number;
    weight: number;
    cubicWeight?: number;
    itemCount: number;
    specialInstructions?: string | null;
  };
}

/**
 * Escapes characters for PDF text operators: ( ) \
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " "); // ASCII printable only
}

/**
 * Generates an ISO-standard 100mm x 150mm (4" x 6") courier shipping label as a pure vector PDF Buffer.
 * Page size: 283.46 pt x 425.20 pt (exact 100mm x 150mm).
 */
export function generateCourierLabelPdf(data: CourierLabelData): Buffer {
  const widthPt = 283.46; // 100mm
  const heightPt = 425.20; // 150mm

  const carrierName = (data.carrier || "Couriers Please").toUpperCase();
  const serviceName = (data.serviceName || "ROAD EXPRESS - TRACKED").toUpperCase();
  const consignment = (data.consignmentCode || data.trackingNumber || `CP-${data.orderNumber}`).toUpperCase();
  const destPostcode = data.recipient.postcode || "";
  const destState = (data.recipient.state || "").toUpperCase();
  const destSuburb = (data.recipient.suburb || "").toUpperCase();

  const length = data.parcel.length || 30;
  const width = data.parcel.width || 25;
  const height = data.parcel.height || 20;
  const weight = data.parcel.weight || 1.0;
  const cubic = data.parcel.cubicWeight || Math.round(((length * width * height) / 4000) * 100) / 100;

  const dateStr = new Date(data.createdAt).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Calculate Code 128 barcode modules
  const { modules } = encodeCode128(consignment);
  const barcodeWidth = 230; // target width in pt
  const moduleWidth = barcodeWidth / modules.length;
  const barcodeX = (widthPt - barcodeWidth) / 2;
  const barcodeY = 32; // bottom margin
  const barcodeHeight = 44;

  // Build PDF stream
  const streamChunks: string[] = [];

  // 1. Draw outer label border & layout dividers
  streamChunks.push("0 0 0 RG 0 0 0 rg 1 w"); // black stroke/fill, 1pt line
  streamChunks.push(`8 8 ${widthPt - 16} ${heightPt - 16} re S`); // outer border with 8pt margin

  // Header Box (top)
  streamChunks.push(`8 ${heightPt - 48} ${widthPt - 16} 40 re f`); // solid black banner
  streamChunks.push("1 1 1 rg"); // white text
  streamChunks.push("BT /F2 16 Tf");
  streamChunks.push(`16 ${heightPt - 32} Td (${escapePdfText(carrierName)}) Tj ET`);
  streamChunks.push("BT /F1 9 Tf");
  streamChunks.push(`16 ${heightPt - 43} Td (${escapePdfText(serviceName)}) Tj ET`);
  streamChunks.push("BT /F1 8 Tf");
  streamChunks.push(`${widthPt - 80} ${heightPt - 32} Td (DISPATCH) Tj ET`);
  streamChunks.push(`BT /F2 9 Tf ${widthPt - 80} ${heightPt - 43} Td (${escapePdfText(dateStr)}) Tj ET`);

  // Routing Hub Box
  streamChunks.push("0 0 0 rg 0 0 0 RG 1 w");
  streamChunks.push(`8 ${heightPt - 100} ${widthPt - 16} 52 re S`); // divider
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 60} Td (DESTINATION ROUTING & SORT CODE) Tj ET`);
  streamChunks.push(`BT /F2 20 Tf 16 ${heightPt - 82} Td (${escapePdfText(destSuburb)}) Tj ET`);
  streamChunks.push(`BT /F2 22 Tf ${widthPt - 105} ${heightPt - 82} Td (${escapePdfText(destState)} ${escapePdfText(destPostcode)}) Tj ET`);
  streamChunks.push(`BT /F1 8 Tf ${widthPt - 105} ${heightPt - 94} Td (ZONE: ${escapePdfText(destState)}-HUB) Tj ET`);

  // DELIVER TO (Consignee) Box
  streamChunks.push(`8 ${heightPt - 188} ${widthPt - 16} 88 re S`);
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 110} Td (DELIVER TO / SHIP TO:) Tj ET`);
  streamChunks.push(`BT /F2 12 Tf 16 ${heightPt - 124} Td (${escapePdfText(data.recipient.name || "Customer")}) Tj ET`);
  streamChunks.push(`BT /F1 10 Tf 16 ${heightPt - 138} Td (${escapePdfText(data.recipient.line1)}) Tj ET`);
  if (data.recipient.line2) {
    streamChunks.push(`BT /F1 10 Tf 16 ${heightPt - 150} Td (${escapePdfText(data.recipient.line2)}) Tj ET`);
  }
  streamChunks.push(`BT /F2 11 Tf 16 ${heightPt - 164} Td (${escapePdfText(destSuburb)} ${escapePdfText(destState)} ${escapePdfText(destPostcode)} AU) Tj ET`);
  if (data.recipient.phone) {
    streamChunks.push(`BT /F1 9 Tf 16 ${heightPt - 178} Td (Phone: ${escapePdfText(data.recipient.phone)}) Tj ET`);
  }

  // FROM / SENDER Box
  streamChunks.push(`8 ${heightPt - 240} ${widthPt - 16} 52 re S`);
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 198} Td (FROM / SENDER:) Tj ET`);
  streamChunks.push(`BT /F2 9 Tf 16 ${heightPt - 210} Td (${escapePdfText(data.sender.name)}) Tj ET`);
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 221} Td (${escapePdfText(data.sender.line1)}, ${escapePdfText(data.sender.suburb)} ${escapePdfText(data.sender.state)} ${escapePdfText(data.sender.postcode)}) Tj ET`);
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 232} Td (Ph: ${escapePdfText(data.sender.phone)} | Ref: #${escapePdfText(data.orderNumber)}) Tj ET`);

  // Parcel Specs & Instructions Box
  streamChunks.push(`8 ${heightPt - 296} ${widthPt - 16} 56 re S`);
  streamChunks.push(`BT /F1 8 Tf 16 ${heightPt - 250} Td (PARCEL SPECIFICATIONS & HANDLING) Tj ET`);
  streamChunks.push(`BT /F2 9 Tf 16 ${heightPt - 263} Td (Package: ${escapePdfText(data.parcel.packageName)}) Tj ET`);
  streamChunks.push(`BT /F1 8.5 Tf 16 ${heightPt - 275} Td (Dims: ${length}x${width}x${height} cm | Dead Wt: ${weight.toFixed(2)} kg | Vol: ${cubic.toFixed(2)} kg) Tj ET`);
  const instructions = data.parcel.specialInstructions || "Safe drop permitted";
  streamChunks.push(`BT /F2 8.5 Tf 16 ${heightPt - 289} Td (Instructions: ${escapePdfText(instructions.slice(0, 45))}) Tj ET`);

  // Barcode Section Box
  streamChunks.push(`8 8 ${widthPt - 16} ${heightPt - 296 - 8} re S`);
  streamChunks.push("0 0 0 rg"); // black bars

  let inBar = false;
  let barStart = 0;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        inBar = false;
        const barW = (i - barStart) * moduleWidth;
        const x = barcodeX + barStart * moduleWidth;
        streamChunks.push(`${x.toFixed(2)} ${barcodeY.toFixed(2)} ${barW.toFixed(2)} ${barcodeHeight.toFixed(2)} re f`);
      }
    }
  }
  if (inBar) {
    const barW = (modules.length - barStart) * moduleWidth;
    const x = barcodeX + barStart * moduleWidth;
    streamChunks.push(`${x.toFixed(2)} ${barcodeY.toFixed(2)} ${barW.toFixed(2)} ${barcodeHeight.toFixed(2)} re f`);
  }

  // Human-readable barcode number
  streamChunks.push(`BT /F2 11 Tf 0 0 0 rg ${barcodeX} 18 Td (CONSIGNMENT: ${escapePdfText(consignment)}) Tj ET`);

  const streamContent = streamChunks.join("\n");

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << 
  /Type /Page 
  /Parent 2 0 R 
  /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] 
  /Resources << 
    /Font << 
      /F1 4 0 R 
      /F2 5 0 R 
    >> 
  >> 
  /Contents 6 0 R 
>> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj
6 0 obj << /Length ${Buffer.byteLength(streamContent)} >>
stream
${streamContent}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000280 00000 n 
0000000351 00000 n 
0000000427 00000 n 
trailer << /Root 1 0 R /Size 7 >>
startxref
${510 + Buffer.byteLength(streamContent)}
%%EOF`;

  return Buffer.from(pdf);
}

