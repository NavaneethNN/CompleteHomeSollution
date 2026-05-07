import { algoliasearch } from "algoliasearch";

let _client: ReturnType<typeof algoliasearch> | null = null;

function getAlgoliaClient() {
  if (!_client) {
    _client = algoliasearch(
      process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
      process.env.ALGOLIA_ADMIN_KEY!
    );
  }
  return _client;
}

export const algoliaClient = new Proxy({} as ReturnType<typeof algoliasearch>, {
  get(_, prop) {
    return (getAlgoliaClient() as Record<string | symbol, unknown>)[prop];
  },
});

export const ALGOLIA_INDEX = "products";

export interface AlgoliaProduct {
  objectID: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  memberPrice?: number;
  stock: number;
  images: string[];
  categoryId: string;
  categoryName: string;
  material?: string;
  roomType?: string;
}

export async function indexProduct(product: AlgoliaProduct): Promise<void> {
  await algoliaClient.saveObject({
    indexName: ALGOLIA_INDEX,
    body: product,
  });
}

export async function deleteProductFromIndex(objectID: string): Promise<void> {
  await algoliaClient.deleteObject({
    indexName: ALGOLIA_INDEX,
    objectID,
  });
}

export async function configureIndex(): Promise<void> {
  await algoliaClient.setSettings({
    indexName: ALGOLIA_INDEX,
    indexSettings: {
      searchableAttributes: ["name", "description", "categoryName", "material", "roomType"],
      attributesForFaceting: ["categoryName", "material", "roomType", "price"],
      customRanking: ["desc(stock)"],
    },
  });
}
