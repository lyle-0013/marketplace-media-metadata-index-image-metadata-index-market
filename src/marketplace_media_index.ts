import { z } from "zod";
import { InfraiClient } from "./infrai_client";

export const indexRequestSchema = z.object({
  bucket: z.string().min(3).max(63),
  seller_id: z.string().min(1),
  buyer_id: z.string().min(1),
  order_id: z.string().min(1)
}).strict();

export type IndexRequest = z.infer<typeof indexRequestSchema>;

const listSchema = z.object({
  items: z.array(z.object({ key: z.string() }).passthrough())
});

const presignSchema = z.object({ url: z.string().url() }).passthrough();

const metadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1)
}).passthrough();

export type IndexedAsset = {
  key: string;
  owner: "seller" | "buyer";
  stage: "listing" | "update" | "handoff";
  width: number;
  height: number;
  format: string;
};

export type HandoffIndex = {
  order_id: string;
  assets: IndexedAsset[];
  handoff_ready: boolean;
};

export async function buildHandoffIndex(client: InfraiClient, input: IndexRequest): Promise<HandoffIndex> {
  await client.request("POST", "/v1/storage/bucket/create", { name: input.bucket });
  const listed = listSchema.parse(
    await client.request("GET", `/v1/storage/object/list/${encodeURIComponent(input.bucket)}`)
  );

  const relevant = listed.items.filter(({ key }) =>
    key.startsWith(`sellers/${input.seller_id}/`) ||
    key.startsWith(`buyers/${input.buyer_id}/updates/`) ||
    key.startsWith(`orders/${input.order_id}/handoff/`)
  );

  const assets = await Promise.all(relevant.map(async ({ key }): Promise<IndexedAsset> => {
    const signed = presignSchema.parse(await client.request(
      "POST",
      `/v1/storage/object/presign/${encodeURIComponent(input.bucket)}/${encodeURIComponent(key)}`,
      { op: "get", expires_seconds: 300, idempotency_key: `metadata-${input.order_id}-${key}` }
    ));
    const metadata = metadataSchema.parse(
      await client.request("POST", "/v1/image/metadata", { image: signed.url })
    );
    const owner = key.startsWith("sellers/") ? "seller" : "buyer";
    const stage = key.startsWith(`orders/${input.order_id}/handoff/`)
      ? "handoff"
      : key.includes("/updates/") ? "update" : "listing";
    return { key, owner, stage, width: metadata.width, height: metadata.height, format: metadata.format };
  }));

  const handoff_ready = assets.some((asset) => asset.stage === "listing") &&
    assets.some((asset) => asset.stage === "update") &&
    assets.some((asset) => asset.stage === "handoff") &&
    assets.every((asset) => asset.width >= 1200 && asset.height >= 1200);

  return { order_id: input.order_id, assets, handoff_ready };
}
