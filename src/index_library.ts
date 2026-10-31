import { InfraiClient } from "./infrai_client";
import { buildHandoffIndex, indexRequestSchema } from "./marketplace_media_index";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the indexer");

const input = indexRequestSchema.parse({
  bucket: process.env.MEDIA_BUCKET ?? "marketplace-media",
  seller_id: process.env.SELLER_ID ?? "seller-42",
  buyer_id: process.env.BUYER_ID ?? "buyer-7",
  order_id: process.env.ORDER_ID ?? "order-1042"
});

const result = await buildHandoffIndex(new InfraiClient({ apiKey }), input);
console.log(JSON.stringify(result, null, 2));
