const SHIPPIT_API_URL = process.env.SHIPPIT_API_URL ?? "https://app.shippit.com/api/3";

interface ShippingRateRequest {
  dropoff_postcode: string;
  dropoff_state: string;
  dropoff_suburb: string;
  parcel_attributes: {
    qty: number;
    weight: number;
  }[];
}

export interface ShippingRate {
  service_level: "standard" | "express" | "priority";
  carrier: string;
  price: number;
  estimated_transit_time: string;
}

export async function getShippingRates(
  params: ShippingRateRequest
): Promise<ShippingRate[]> {
  const response = await fetch(`${SHIPPIT_API_URL}/orders/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHIPPIT_API_KEY}`,
    },
    body: JSON.stringify({ order: params }),
  });

  if (!response.ok) {
    throw new Error(`Shippit API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response ?? [];
}

export async function createShipment(params: {
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliverySuburb: string;
  deliveryState: string;
  deliveryPostcode: string;
  serviceLevel: string;
  parcels: { qty: number; weight: number }[];
}): Promise<{ trackingNumber: string; carrier: string }> {
  const response = await fetch(`${SHIPPIT_API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHIPPIT_API_KEY}`,
    },
    body: JSON.stringify({
      order: {
        retailer_invoice: params.orderId,
        delivery_address: params.deliveryAddress,
        delivery_suburb: params.deliverySuburb,
        delivery_state: params.deliveryState,
        delivery_postcode: params.deliveryPostcode,
        recipient_name: params.recipientName,
        recipient_email: params.recipientEmail,
        recipient_phone: params.recipientPhone,
        courier_type: params.serviceLevel,
        parcel_attributes: params.parcels,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Shippit create shipment error: ${response.status}`);
  }

  const data = await response.json();
  return {
    trackingNumber: data.response.tracking_number,
    carrier: data.response.courier_name,
  };
}
