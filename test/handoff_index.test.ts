import assert from "node:assert/strict";
import test from "node:test";
import { InfraiClient } from "../src/infrai_client";
import { buildHandoffIndex } from "../src/marketplace_media_index";

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

test("handoff stays blocked when a buyer update is below the marketplace minimum", async () => {
  const keys = [
    "sellers/seller-42/listing/front.jpg",
    "buyers/buyer-7/updates/crop.jpg",
    "orders/order-1042/handoff/final.png",
    "sellers/other/listing/ignored.jpg"
  ];
  const fetchImpl: typeof fetch = async (request, init) => {
    const url = String(request);
    if (url.endsWith("/v1/storage/bucket/create")) return envelope({ name: "marketplace-media" });
    if (url.includes("/v1/storage/object/list/")) return envelope({ items: keys.map((key) => ({ key })) });
    if (url.includes("/v1/storage/object/presign/")) return envelope({ url: `https://media.example/${encodeURIComponent(url)}` });
    if (url.endsWith("/v1/image/metadata")) {
      const image = String(JSON.parse(String(init?.body)).image);
      return envelope(image.includes("crop.jpg")
        ? { width: 900, height: 1200, format: "jpeg" }
        : { width: 1600, height: 1600, format: "png" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await buildHandoffIndex(new InfraiClient({ apiKey: "test-key", fetchImpl }), {
    bucket: "marketplace-media",
    seller_id: "seller-42",
    buyer_id: "buyer-7",
    order_id: "order-1042"
  });

  assert.equal(result.assets.length, 3);
  assert.equal(result.assets.find((asset) => asset.stage === "update")?.width, 900);
  assert.equal(result.handoff_ready, false);
});
