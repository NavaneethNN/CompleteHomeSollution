# Ship123 API Integration Guide
## Create Order -> Get Order Detail -> Retrieve Shipping Label PDF

**Version:** 1.0
**Language:** English
**Audience:** Backend developers / API integration engineers
**Base URL:** `https://api.ship123.com`

---

## 1. Overview

This guide explains how to integrate Ship123 OpenAPI to create a shipping order, query the generated order details, extract the shipping label URL, and download the label PDF.

The full workflow is:

```text
1. Get your Api-Secret from Ship123.
2. Get the correct productCode for the shipping service you want to use.
3. Call the Create Order API.
4. Save data.orderNo from the create-order response.
5. Call the Get Order Detail API using orderNo.
6. Extract data.labelFile.labelUrl or packageList[].labelFile.labelUrl.
7. Download the label PDF from labelUrl.
```

---

## 2. Authentication

All requests must include the `Api-Secret` header.

```http
Api-Secret: YOUR_API_SECRET
Content-Type: application/json
```

Recommended implementation notes:

- Store `Api-Secret` in environment variables or a secure secret manager.
- Never hard-code the real secret in source code that will be committed to Git.
- Log `traceId`, `code`, and `msg` when requests fail.

---

## 3. API Endpoints

| Step | API | Method | Endpoint |
|---|---|---|---|
| 1 | Create Order | POST | `/ship-order/openApi/order/create` |
| 2 | Get Order Detail | POST | `/ship-order/openApi/order/detail` |

Production base URL:

```text
https://api.ship123.com
```

---

## 4. Create Order API

### 4.1 Endpoint

```http
POST https://api.ship123.com/ship-order/openApi/order/create
```

### 4.2 Required Top-Level Fields

| Field | Required | Description |
|---|---:|---|
| `bsFlag` | Yes | Unit system. `0` = metric, cm/kg. `1` = imperial, in/lb. |
| `productCode` | Yes | Shipping product/service code provided by Ship123. |
| `shipFrom` | Yes | Sender address object. |
| `shipTo` | Yes | Recipient address object. |
| `packageList` | Yes | Package list. |

### 4.3 Address Object

`shipFrom`, `shipTo`, and `returnTo` use similar address fields.

Required address fields:

| Field | Required | Description |
|---|---:|---|
| `contactName` | Yes | Sender/receiver contact name. |
| `addressFirst` | Yes | Address line 1. |
| `cityName` | Yes | City name. |
| `countryRegionCode` | Yes | Country/region code, such as `CA` or `US`. |
| `postalCode` | Yes | Postal/ZIP code. |

Common optional address fields:

| Field | Description |
|---|---|
| `companyName` | Company name. |
| `contactPhone` | Contact phone number. |
| `contactEmail` | Contact email. |
| `addressSecond` | Address line 2. |
| `houseNumber` | House number. |
| `stateOrProvince` | State/province code or name. |
| `taxNo` | Tax number. |
| `serviceAddressCode` | Service address code, usually used for sender-side saved addresses. |
| `residential` | Recipient address type. `0` = residential, `1` = commercial. |

Important: `returnTo` is optional. However, if you include `returnTo`, it must also include the required address fields. For example, if `returnTo.cityName` is missing, the API may return a validation error.

Example error:

```json
{
  "code": "1000003",
  "msg": "returnTo.cityName 城市名称必填",
  "success": false,
  "traceId": "4c6d2edd9d3b42a387fa57e4c616ca11"
}
```

### 4.4 Package Object

Each package in `packageList` should include:

| Field | Required | Description |
|---|---:|---|
| `quantity` | Yes | Number of packages/items for this package line. |
| `length` | Yes | Package length. Unit depends on `bsFlag`. |
| `width` | Yes | Package width. Unit depends on `bsFlag`. |
| `height` | Yes | Package height. Unit depends on `bsFlag`. |
| `weight` | Yes | Package weight. Unit depends on `bsFlag`. |
| `skuList` | Recommended | SKU/customs item list. Required for many services. |

Unit rule:

```text
bsFlag = 0 -> cm / kg
bsFlag = 1 -> inch / lb
```

### 4.5 SKU Object

Each SKU item normally includes:

| Field | Required | Description |
|---|---:|---|
| `nameEn` | Yes | English product name. |
| `quantity` | Yes | SKU quantity. |
| `declaredValue` | Yes | Declared value. |
| `productType` | Yes | Product type code. |
| `sku` | Optional | Internal SKU code. |
| `nameCn` | Optional | Chinese product name. |
| `originCountryCode` | Optional | Origin country code, such as `CN`. |
| `weight` | Optional | SKU weight. |
| `length` / `width` / `height` | Optional | SKU dimensions. |

Common `productType` values:

| Value | Meaning |
|---:|---|
| `1` | General goods |
| `2` | Built-in battery |
| `3` | Battery packed with equipment |
| `4` | Battery only |
| `5` | Liquid |
| `6` | Paste |
| `7` | Powder |
| `8` | Magnetic item |

### 4.6 Create Order Request Example

```json
{
  "bsFlag": 0,
  "customerOrderNo": "TEST-ORDER-10001",
  "productCode": "YOUR_PRODUCT_CODE",
  "declaredCurrency": "USD",
  "shipDate": "2026-05-06",
  "shipFrom": {
    "contactName": "Sender Name",
    "companyName": "Sender Company",
    "contactPhone": "1234567890",
    "contactEmail": "sender@example.com",
    "addressFirst": "123 Sender Street",
    "cityName": "Toronto",
    "stateOrProvince": "ON",
    "postalCode": "M5V 2T6",
    "countryRegionCode": "CA"
  },
  "shipTo": {
    "contactName": "Receiver Name",
    "companyName": "Receiver Company",
    "contactPhone": "1234567890",
    "contactEmail": "receiver@example.com",
    "addressFirst": "456 Receiver Avenue",
    "cityName": "Vancouver",
    "stateOrProvince": "BC",
    "postalCode": "V6B 1A1",
    "countryRegionCode": "CA",
    "residential": 0
  },
  "returnTo": {
    "contactName": "Return Contact",
    "companyName": "Return Company",
    "contactPhone": "1234567890",
    "contactEmail": "return@example.com",
    "addressFirst": "123 Return Street",
    "cityName": "Toronto",
    "stateOrProvince": "ON",
    "postalCode": "M5V 2T6",
    "countryRegionCode": "CA"
  },
  "packageList": [
    {
      "quantity": 1,
      "length": 20,
      "width": 15,
      "height": 10,
      "weight": 1.2,
      "skuList": [
        {
          "sku": "SKU-001",
          "nameEn": "Clothing",
          "nameCn": "衣服",
          "quantity": 1,
          "declaredValue": 10,
          "productType": 1,
          "originCountryCode": "CN",
          "weight": 1.2,
          "length": 20,
          "width": 15,
          "height": 10
        }
      ]
    }
  ],
  "remark": "API test order"
}
```

### 4.7 Create Order Success Response

The most important field is `data.orderNo`.

```json
{
  "code": "SUCCESS_CODE",
  "msg": "success",
  "success": true,
  "traceId": "TRACE_ID",
  "data": {
    "orderNo": "SHIP123_ORDER_NO"
  }
}
```

Always save `data.orderNo` in your system. You need it to query the order detail and retrieve the label.

---

## 5. Get Order Detail API

### 5.1 Endpoint

```http
POST https://api.ship123.com/ship-order/openApi/order/detail
```

### 5.2 Request Body

```json
{
  "orderNo": "SHIP123_ORDER_NO"
}
```

### 5.3 Important Response Fields

| Field | Description |
|---|---|
| `data.orderNo` | Ship123 order number. |
| `data.customerOrderNo` | Your customer/internal order number. |
| `data.orderStatus` | Order status. |
| `data.productCode` | Shipping product code. |
| `data.productName` | Shipping product name. |
| `data.trackNo` | Main tracking number. |
| `data.waybillNo` | Main waybill number. |
| `data.labelFile.fileName` | Label file name. |
| `data.labelFile.labelUrl` | Label PDF URL. |
| `data.packageList` | Package-level details. |
| `data.feeInfo` | Fee details. |

### 5.4 Order Status Values

| Value | Meaning | Recommended Action |
|---:|---|---|
| `0` | Draft | Check whether the order was fully submitted. |
| `1` | Processing / ordering | Poll order detail again later. |
| `2` | Generated | Label should normally be available. |
| `3` | Cancelled | Stop and check order history. |
| `4` | Exception | Stop and debug using `msg` and `traceId`. |
| `5` | Refunded | Stop. |

### 5.5 Label URL Location

Primary location:

```text
data.labelFile.labelUrl
```

Fallback for multi-package orders:

```text
data.packageList[0].labelFile.labelUrl
```

Recommended extraction priority:

```text
1. Try data.labelFile.labelUrl
2. If empty, try each package in data.packageList[].labelFile.labelUrl
3. If still empty and orderStatus is 1, poll the detail API again
4. If orderStatus is 3, 4, or 5, stop and debug
```

---

## 6. Complete Python Integration Example

```python
import os
import time
from pathlib import Path

import requests

BASE_URL = "https://api.ship123.com"
API_SECRET = os.getenv("SHIP123_API_SECRET", "YOUR_API_SECRET")

HEADERS = {
    "Api-Secret": API_SECRET,
    "Content-Type": "application/json",
}


def create_order() -> str:
    url = f"{BASE_URL}/ship-order/openApi/order/create"

    payload = {
        "bsFlag": 0,
        "customerOrderNo": "TEST-ORDER-10001",
        "productCode": "YOUR_PRODUCT_CODE",
        "declaredCurrency": "USD",
        "shipDate": "2026-05-06",
        "shipFrom": {
            "contactName": "Sender Name",
            "companyName": "Sender Company",
            "contactPhone": "1234567890",
            "contactEmail": "sender@example.com",
            "addressFirst": "123 Sender Street",
            "cityName": "Toronto",
            "stateOrProvince": "ON",
            "postalCode": "M5V 2T6",
            "countryRegionCode": "CA",
        },
        "shipTo": {
            "contactName": "Receiver Name",
            "companyName": "Receiver Company",
            "contactPhone": "1234567890",
            "contactEmail": "receiver@example.com",
            "addressFirst": "456 Receiver Avenue",
            "cityName": "Vancouver",
            "stateOrProvince": "BC",
            "postalCode": "V6B 1A1",
            "countryRegionCode": "CA",
            "residential": 0,
        },
        "returnTo": {
            "contactName": "Return Contact",
            "companyName": "Return Company",
            "contactPhone": "1234567890",
            "contactEmail": "return@example.com",
            "addressFirst": "123 Return Street",
            "cityName": "Toronto",
            "stateOrProvince": "ON",
            "postalCode": "M5V 2T6",
            "countryRegionCode": "CA",
        },
        "packageList": [
            {
                "quantity": 1,
                "length": 20,
                "width": 15,
                "height": 10,
                "weight": 1.2,
                "skuList": [
                    {
                        "sku": "SKU-001",
                        "nameEn": "Clothing",
                        "nameCn": "Clothes",
                        "quantity": 1,
                        "declaredValue": 10,
                        "productType": 1,
                        "originCountryCode": "CN",
                        "weight": 1.2,
                    }
                ],
            }
        ],
        "remark": "API test order",
    }

    response = requests.post(url, headers=HEADERS, json=payload, timeout=30)
    result = response.json()

    print("Create Order Response:")
    print(result)

    if not result.get("success"):
        raise RuntimeError(
            f"Create order failed. "
            f"code={result.get('code')}, "
            f"msg={result.get('msg')}, "
            f"traceId={result.get('traceId')}"
        )

    order_no = result.get("data", {}).get("orderNo")
    if not order_no:
        raise RuntimeError("Order was created, but orderNo was not found in response.")

    return order_no


def get_order_detail(order_no: str) -> dict:
    url = f"{BASE_URL}/ship-order/openApi/order/detail"
    payload = {"orderNo": order_no}

    response = requests.post(url, headers=HEADERS, json=payload, timeout=30)
    result = response.json()

    print("Get Order Detail Response:")
    print(result)

    if not result.get("success"):
        raise RuntimeError(
            f"Get order detail failed. "
            f"code={result.get('code')}, "
            f"msg={result.get('msg')}, "
            f"traceId={result.get('traceId')}"
        )

    return result.get("data", {})


def extract_label_url(order_detail: dict) -> tuple[str | None, str | None]:
    # 1. Try order-level label file first.
    label_file = order_detail.get("labelFile") or {}
    label_url = label_file.get("labelUrl")
    file_name = label_file.get("fileName") or "shipping-label.pdf"

    if label_url:
        return label_url, file_name

    # 2. Try package-level label files.
    for package in order_detail.get("packageList") or []:
        package_label_file = package.get("labelFile") or {}
        label_url = package_label_file.get("labelUrl")
        file_name = package_label_file.get("fileName") or "shipping-label.pdf"

        if label_url:
            return label_url, file_name

    return None, None


def download_label(label_url: str, file_name: str) -> Path:
    output_path = Path(file_name)

    response = requests.get(label_url, timeout=60)
    response.raise_for_status()

    output_path.write_bytes(response.content)
    print(f"Label downloaded: {output_path.resolve()}")

    return output_path


def main() -> None:
    order_no = create_order()
    print(f"Created orderNo: {order_no}")

    # Some services may need processing time before labelUrl is available.
    for attempt in range(1, 11):
        print(f"Checking order detail, attempt {attempt}...")

        order_detail = get_order_detail(order_no)
        order_status = order_detail.get("orderStatus")
        label_url, file_name = extract_label_url(order_detail)

        print(f"orderStatus={order_status}, labelUrl={label_url}")

        if label_url:
            download_label(label_url, file_name or "shipping-label.pdf")
            return

        if order_status in [3, 4, 5]:
            raise RuntimeError(
                f"Order cannot generate label. "
                f"orderStatus={order_status}, orderNo={order_no}"
            )

        time.sleep(5)

    raise TimeoutError(f"Label URL was not available after polling. orderNo={order_no}")


if __name__ == "__main__":
    main()
```

---

## 7. Minimal API Flow

```python
import requests

headers = {
    "Api-Secret": "YOUR_API_SECRET",
    "Content-Type": "application/json",
}

# Step 1: Create order
create_response = requests.post(
    "https://api.ship123.com/ship-order/openApi/order/create",
    headers=headers,
    json=create_payload,
    timeout=30,
).json()

if not create_response.get("success"):
    raise RuntimeError(create_response)

order_no = create_response["data"]["orderNo"]

# Step 2: Get order detail
detail_response = requests.post(
    "https://api.ship123.com/ship-order/openApi/order/detail",
    headers=headers,
    json={"orderNo": order_no},
    timeout=30,
).json()

if not detail_response.get("success"):
    raise RuntimeError(detail_response)

# Step 3: Get label URL
label_url = detail_response["data"]["labelFile"]["labelUrl"]
```

---

## 8. Error Handling Guide

### 8.1 Always Check `success`

Do not assume that HTTP 200 means the order was created successfully. Always check the JSON field `success`.

```python
if not result.get("success"):
    code = result.get("code")
    msg = result.get("msg")
    trace_id = result.get("traceId")
    raise RuntimeError(f"Ship123 API error: code={code}, msg={msg}, traceId={trace_id}")
```

### 8.2 Do Not Read `orderNo` Before Checking Success

Incorrect:

```python
order_no = result["data"]["orderNo"]
```

Correct:

```python
if not result.get("success"):
    raise RuntimeError(result.get("msg"))

order_no = result.get("data", {}).get("orderNo")
if not order_no:
    raise RuntimeError("orderNo not found in response")
```

### 8.3 Common Issues

| Issue | Likely Cause | Solution |
|---|---|---|
| `returnTo.cityName` is required | `returnTo` object is included but incomplete. | Add `returnTo.cityName` or remove `returnTo`. |
| Missing recipient city/postal code | `shipTo` address is incomplete. | Complete all required address fields. |
| Missing sender city/postal code | `shipFrom` address is incomplete. | Complete all required address fields. |
| Missing package dimensions | Package lacks length, width, height, weight, or quantity. | Complete package data. |
| Invalid `productCode` | Wrong or unavailable shipping product. | Use the product code provided by Ship123. |
| Empty `labelUrl` | Order is still processing. | Poll the detail API again after a short delay. |
| `orderStatus = 4` | Order exception. | Check `msg`, `traceId`, address, product code, and account configuration. |

---

## 9. Production Checklist

Before going live, confirm:

```text
[ ] Api-Secret is configured securely.
[ ] productCode is correct for the shipping service.
[ ] bsFlag matches the real units used by your system.
[ ] shipFrom contains all required address fields.
[ ] shipTo contains all required address fields.
[ ] returnTo is either removed or fully completed.
[ ] packageList contains quantity, length, width, height, and weight.
[ ] skuList contains required customs/product fields if required by the service.
[ ] customerOrderNo is unique in your own system.
[ ] Create Order response success=true is checked.
[ ] data.orderNo is saved.
[ ] Get Order Detail response success=true is checked.
[ ] labelFile.labelUrl is extracted.
[ ] Package-level labelUrl fallback is supported.
[ ] Label PDF is downloaded and stored.
[ ] code, msg, and traceId are logged for failed requests.
```

---

## 10. Recommended System Design

```text
Your Order System
    |
    | 1. Create shipping order
    v
Ship123 Create Order API
    |
    | returns orderNo
    v
Your System saves orderNo
    |
    | 2. Query detail by orderNo
    v
Ship123 Get Order Detail API
    |
    | returns trackNo / waybillNo / labelUrl
    v
Your System downloads label PDF
    |
    v
User prints label and ships parcel
```

---

## 11. Notes for Developers

- Use retry/polling only for the detail API, not unlimited retries for create order.
- If create order fails, fix the request payload instead of retrying blindly.
- Save `customerOrderNo`, `orderNo`, `trackNo`, `waybillNo`, and `labelUrl` in your database.
- Keep raw API responses for debugging during the first integration stage.
- For multi-package orders, do not rely only on order-level labelFile. Also check package-level labelFile.
- Use idempotency logic on your side: do not repeatedly create new Ship123 orders for the same customer order unless intended.

---

## 12. Official Reference URLs

- Create Order: `https://ship123-api.readme.io/reference/createorderusingpost-1.md`
- Get Order Detail: `https://ship123-api.readme.io/reference/getorderdetailusingpost-1.md`
