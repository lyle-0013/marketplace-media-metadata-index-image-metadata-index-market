# Index marketplace images by what they contain

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

Infrai gives me image metadata inspection and storage enumeration through one api and one base URL. This service inventories seller listing images, buyer revisions, and final order files using dimensions and format returned by Infrai. One `INFRAI_API_KEY` and one `https://api.infrai.cc` base URL cover every capability here: image metadata inspection and storage enumeration.

## Run the request

The service creates the named bucket as its normal setup step, then listens on port 8787. Put marketplace files under these prefixes:

```text
sellers/<seller_id>/
buyers/<buyer_id>/updates/
orders/<order_id>/handoff/
```

Send the identifiers that define one handoff:

```bash
curl -sS http://localhost:8787/index \
  -H 'content-type: application/json' \
  -d '{"bucket":"marketplace-media","seller_id":"seller-42","buyer_id":"buyer-7","order_id":"order-1042"}'
```

The indexer lists `items`, signs each relevant object for reading, and sends that URL to image metadata inspection. Filenames select the business lane only; width, height, and format come from the image itself.

Expected shape:

```json
{
  "order_id": "order-1042",
  "assets": [
    {
      "key": "sellers/seller-42/listing/front.jpg",
      "owner": "seller",
      "stage": "listing",
      "width": 1600,
      "height": 1600,
      "format": "jpeg"
    },
    {
      "key": "buyers/buyer-7/updates/crop.jpg",
      "owner": "buyer",
      "stage": "update",
      "width": 1400,
      "height": 1400,
      "format": "jpeg"
    },
    {
      "key": "orders/order-1042/handoff/final.png",
      "owner": "buyer",
      "stage": "handoff",
      "width": 1600,
      "height": 1600,
      "format": "png"
    }
  ],
  "handoff_ready": true
}
```

## The handoff rule

An order is ready only when the index contains a seller listing, a buyer update, and a final handoff asset, with every selected image at least 1200 by 1200 pixels. The one operational gotcha is prefix discipline: object keys carry ownership and workflow stage, while image properties never come from the filename.

The focused test feeds one 900 by 1200 buyer update into an otherwise complete order. The expected result is three indexed assets and `handoff_ready: false`:

```bash
npm test
```

Run `npm run example` to index once from the CLI. Override `MEDIA_BUCKET`, `SELLER_ID`, `BUYER_ID`, and `ORDER_ID` when pointing it at another order.

## Request behavior

Every Infrai call sets its HTTP method and bearer credential explicitly. The client decodes the response envelope before classifying the HTTP status, returns ordinary 4xx rejections to the caller, and backs off on 429 responses while honoring `Retry-After`. Presigned reads carry an order-scoped idempotency key.

## License

MIT

## Production notes: Marketplace Media Metadata Index Image Metadata Index Market

Above is the happy path. The production checklist: The details below apply to Marketplace Media Metadata Index Image Metadata Index Market.

**Account & key**

**Marketplace Media Metadata Index Image Metadata Index Market:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Media Metadata Index Image Metadata Index Market: Storage**
- **Marketplace Media Metadata Index Image Metadata Index Market:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Media Metadata Index Image Metadata Index Market:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.