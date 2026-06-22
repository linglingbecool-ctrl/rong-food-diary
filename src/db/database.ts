import Dexie, { type Table } from "dexie";

import type {
  AppSettings,
  Companion,
  DishRecord,
  Restaurant,
  StoredPhoto,
  Tag,
  VisitRecord,
  VisitDraft,
  WishlistItem,
} from "../types/models";

export class RongFoodDatabase extends Dexie {
  restaurants!: Table<Restaurant, string>;
  visitRecords!: Table<VisitRecord, string>;
  dishRecords!: Table<DishRecord, string>;
  wishlistItems!: Table<WishlistItem, string>;
  companions!: Table<Companion, string>;
  tags!: Table<Tag, string>;
  photos!: Table<StoredPhoto, string>;
  appSettings!: Table<AppSettings, string>;
  visitDrafts!: Table<VisitDraft, string>;

  constructor() {
    super("rong-food-diary");

    // 第一版数据库结构。后续字段变化时通过 version(2) 继续迁移。
    this.version(1).stores({
      restaurants:
        "id, name, category, district, businessArea, createdAt, updatedAt",
      visitRecords:
        "id, restaurantId, visitDate, overallRating, averageCost, revisitStatus, createdAt",
      dishRecords: "id, visitId, name, category, recommendationStatus, createdAt",
      wishlistItems:
        "id, restaurantName, category, district, priority, status, createdAt",
      companions: "id, name, createdAt",
      tags: "id, name, type, createdAt",
      photos: "id, createdAt",
      appSettings: "id",
    });

    this.version(2).stores({
      restaurants:
        "id, name, category, district, businessArea, createdAt, updatedAt",
      visitRecords:
        "id, restaurantId, visitDate, overallRating, averageCost, revisitStatus, createdAt",
      dishRecords: "id, visitId, name, category, recommendationStatus, createdAt",
      wishlistItems:
        "id, restaurantName, category, district, priority, status, createdAt",
      companions: "id, name, createdAt",
      tags: "id, name, type, createdAt",
      photos: "id, createdAt",
      appSettings: "id",
      visitDrafts: "id, mode, visitId, savedAt, updatedAt",
    });
  }
}

export const db = new RongFoodDatabase();
