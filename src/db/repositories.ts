import { isSameMonth, parseISO } from "date-fns";

import { db } from "./database";
import {
  sampleCompanions,
  sampleDishRecords,
  sampleRestaurants,
  sampleTags,
  sampleVisitRecords,
  sampleWishlistItems,
} from "./seed";
import type {
  AppSettings,
  DashboardData,
  DataExportBundle,
  DishRecord,
  ExplorerData,
  ImportMode,
  ImportResult,
  MonthlyTrendDatum,
  ProcessedPhoto,
  RecentVisitItem,
  Restaurant,
  RestaurantCategory,
  RestaurantDetailData,
  RestaurantListItem,
  RevisitStatus,
  StatsData,
  StoredPhoto,
  VisitDetailData,
  VisitDraft,
  VisitFormMode,
  VisitFormValues,
  VisitRecord,
  WishlistConversionInput,
  WishlistInput,
  WishlistItem,
} from "../types/models";
import {
  base64ToBlob,
  blobToBase64,
  isImportableImageMime,
} from "../utils/imageProcessing";

const settingsId = "default";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitText(value: string) {
  return value
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryColorToken(category: RestaurantCategory): Restaurant["colorToken"] {
  if (category === "咖啡" || category === "川菜") {
    return "blue";
  }
  if (category === "甜品" || category === "小吃") {
    return "pink";
  }
  return "orange";
}

function normalizeComparable(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function sameRestaurantIdentity(candidate: Restaurant, values: VisitFormValues) {
  return (
    normalizeComparable(candidate.name) === normalizeComparable(values.restaurant.name) &&
    normalizeComparable(candidate.branchName) === normalizeComparable(values.restaurant.branchName) &&
    normalizeComparable(candidate.address) === normalizeComparable(values.restaurant.address)
  );
}

function mapVisitFormToRestaurant(
  values: VisitFormValues,
  existing: Restaurant | undefined,
  timestamp: string,
): Restaurant {
  const category = values.restaurant.category || "其他";
  return {
    id: existing?.id ?? values.restaurant.id ?? createId("restaurant-user"),
    name: values.restaurant.name.trim(),
    branchName: optionalText(values.restaurant.branchName),
    category,
    address: optionalText(values.restaurant.address),
    district: optionalText(values.restaurant.district),
    businessArea: optionalText(values.restaurant.businessArea),
    latitude: parseOptionalNumber(values.restaurant.latitude),
    longitude: parseOptionalNumber(values.restaurant.longitude),
    phone: optionalText(values.restaurant.phone),
    source: optionalText(values.restaurant.source),
    tags: splitText(values.visit.tagsText),
    coverPhotoId: existing?.coverPhotoId,
    colorToken: existing?.colorToken ?? categoryColorToken(category),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function mapVisitFormToVisit(
  values: VisitFormValues,
  restaurantId: string,
  existing: VisitRecord | undefined,
  timestamp: string,
): VisitRecord {
  const peopleCount = Math.max(1, Math.round(parseOptionalNumber(values.visit.peopleCount) ?? 1));
  const totalCost = parseOptionalNumber(values.visit.totalCost);
  const typedAverageCost = parseOptionalNumber(values.visit.averageCost);
  const averageCost =
    typedAverageCost ?? (totalCost !== undefined && peopleCount > 0 ? Math.round(totalCost / peopleCount) : undefined);

  return {
    id: existing?.id ?? values.visit.id ?? createId("visit"),
    restaurantId,
    visitDate: values.visit.visitDate,
    mealPeriod: values.visit.mealPeriod || undefined,
    companions: splitText(values.visit.companionsText),
    diningPurpose: values.visit.diningPurpose || undefined,
    totalCost,
    averageCost,
    peopleCount,
    overallRating: parseOptionalNumber(values.visit.overallRating) ?? 0,
    tasteRating: parseOptionalNumber(values.visit.tasteRating),
    environmentRating: parseOptionalNumber(values.visit.environmentRating),
    serviceRating: parseOptionalNumber(values.visit.serviceRating),
    valueRating: parseOptionalNumber(values.visit.valueRating),
    revisitStatus: values.visit.revisitStatus,
    queueWorthiness: values.visit.queueWorthiness || undefined,
    recommendedFor: splitText(values.visit.recommendedForText),
    tags: splitText(values.visit.tagsText),
    summary: values.visit.summary.trim(),
    notes: optionalText(values.visit.notes),
    photoIds: values.visit.photoIds,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function mapVisitFormToDishes(
  values: VisitFormValues,
  visitId: string,
  timestamp: string,
): DishRecord[] {
  return values.dishes
    .filter((dish) => dish.name.trim().length > 0)
    .map((dish) => ({
      id: dish.id ?? createId("dish"),
      visitId,
      name: dish.name.trim(),
      category: optionalText(dish.category),
      price: parseOptionalNumber(dish.price),
      rating: parseOptionalNumber(dish.rating),
      recommendationStatus: dish.recommendationStatus,
      notes: optionalText(dish.notes),
      photoIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
}

async function findRestaurantForForm(values: VisitFormValues) {
  if (values.restaurant.id) {
    return db.restaurants.get(values.restaurant.id);
  }

  const candidates = await db.restaurants
    .where("name")
    .equals(values.restaurant.name.trim())
    .toArray();
  return candidates.find((candidate) => sameRestaurantIdentity(candidate, values));
}

export async function getOrCreateSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get(settingsId);
  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const settings: AppSettings = {
    id: settingsId,
    hasCompletedWelcome: false,
    mapProvider: "placeholder",
    theme: "soft",
    createdAt,
    updatedAt: createdAt,
  };
  await db.appSettings.put(settings);
  return settings;
}

export async function completeWelcome(): Promise<void> {
  const settings = await getOrCreateSettings();
  await db.appSettings.put({
    ...settings,
    hasCompletedWelcome: true,
    updatedAt: nowIso(),
  });
}

export async function ensureSeedData(): Promise<void> {
  const restaurantsCount = await db.restaurants.count();
  if (restaurantsCount > 0) {
    return;
  }

  await db.transaction(
    "rw",
    [
      db.restaurants,
      db.visitRecords,
      db.dishRecords,
      db.wishlistItems,
      db.companions,
      db.tags,
    ],
    async () => {
      await db.restaurants.bulkPut(sampleRestaurants);
      await db.visitRecords.bulkPut(sampleVisitRecords);
      await db.dishRecords.bulkPut(sampleDishRecords);
      await db.wishlistItems.bulkPut(sampleWishlistItems);
      await db.companions.bulkPut(sampleCompanions);
      await db.tags.bulkPut(sampleTags);
    },
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const [restaurants, visits, dishes] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
    db.dishRecords.toArray(),
  ]);

  visits.sort(
    (left, right) =>
      right.visitDate.localeCompare(left.visitDate) || right.createdAt.localeCompare(left.createdAt),
  );

  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const dishesByVisitId = new Map<string, typeof dishes>();

  dishes.forEach((dish) => {
    const existing = dishesByVisitId.get(dish.visitId) ?? [];
    existing.push(dish);
    dishesByVisitId.set(dish.visitId, existing);
  });

  const recentVisits: RecentVisitItem[] = visits
    .map((visit) => {
      const restaurant = restaurantById.get(visit.restaurantId);
      if (!restaurant) {
        return null;
      }
      return {
        visit,
        restaurant,
        dishes: dishesByVisitId.get(visit.id) ?? [],
      };
    })
    .filter((item): item is RecentVisitItem => item !== null)
    .slice(0, 4);

  const currentMonth = new Date();
  const thisMonthVisitsCount = visits.filter((visit) =>
    isSameMonth(parseISO(visit.visitDate), currentMonth),
  ).length;
  const litDistrictsCount = new Set(
    restaurants
      .map((restaurant) => restaurant.district)
      .filter((district): district is string => Boolean(district)),
  ).size;

  return {
    restaurantsCount: restaurants.length,
    visitsCount: visits.length,
    thisMonthVisitsCount,
    litDistrictsCount,
    recentVisits,
  };
}

export function getVisitDraftId(mode: VisitFormMode, visitId?: string) {
  return mode === "create" ? "visit-draft-create" : `visit-draft-edit-${visitId ?? "unknown"}`;
}

export async function getVisitDraft(id: string): Promise<VisitDraft | undefined> {
  return db.visitDrafts.get(id);
}

export async function saveVisitDraft(
  id: string,
  mode: VisitFormMode,
  formData: VisitFormValues,
  visitId?: string,
): Promise<void> {
  const existing = await db.visitDrafts.get(id);
  const timestamp = nowIso();
  await db.visitDrafts.put({
    id,
    mode,
    visitId,
    formData,
    savedAt: timestamp,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
}

export async function clearVisitDraft(id: string): Promise<void> {
  await db.visitDrafts.delete(id);
}

export async function getVisitDetail(visitId: string): Promise<VisitDetailData | undefined> {
  const visit = await db.visitRecords.get(visitId);
  if (!visit) {
    return undefined;
  }

  const [restaurant, dishes] = await Promise.all([
    db.restaurants.get(visit.restaurantId),
    db.dishRecords.where("visitId").equals(visit.id).toArray(),
  ]);

  if (!restaurant) {
    return undefined;
  }

  return {
    visit,
    restaurant,
    dishes,
  };
}

export async function getRestaurantDetail(
  restaurantId: string,
): Promise<RestaurantDetailData | undefined> {
  const restaurant = await db.restaurants.get(restaurantId);
  if (!restaurant) {
    return undefined;
  }

  const visits = await db.visitRecords.where("restaurantId").equals(restaurantId).toArray();
  visits.sort(
    (left, right) =>
      right.visitDate.localeCompare(left.visitDate) || right.createdAt.localeCompare(left.createdAt),
  );

  const visitIds = new Set(visits.map((visit) => visit.id));
  const allDishes = await db.dishRecords.toArray();
  const dishesByVisitId = new Map<string, DishRecord[]>();

  allDishes
    .filter((dish) => visitIds.has(dish.visitId))
    .forEach((dish) => {
      const existing = dishesByVisitId.get(dish.visitId) ?? [];
      existing.push(dish);
      dishesByVisitId.set(dish.visitId, existing);
    });

  const detailVisits = visits.map((visit) => ({
    visit,
    restaurant,
    dishes: dishesByVisitId.get(visit.id) ?? [],
  }));

  const ratings = visits.map((visit) => visit.overallRating).filter((rating) => rating > 0);
  const costs = visits
    .map((visit) => visit.averageCost)
    .filter((cost): cost is number => cost !== undefined && cost > 0);
  const tagCounts = new Map<string, number>();
  visits.flatMap((visit) => visit.tags).forEach((tag) => {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  });

  return {
    restaurant,
    visits: detailVisits,
    averageRating:
      ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : undefined,
    averageCost: costs.length > 0 ? Math.round(costs.reduce((sum, cost) => sum + cost, 0) / costs.length) : undefined,
    recentVisitDate: visits[0]?.visitDate,
    commonTags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([tag]) => tag)
      .slice(0, 6),
  };
}

export async function createVisitFromForm(values: VisitFormValues): Promise<VisitDetailData> {
  const timestamp = nowIso();
  const existingRestaurant = await findRestaurantForForm(values);
  const restaurant = mapVisitFormToRestaurant(values, existingRestaurant, timestamp);
  const visit = mapVisitFormToVisit(values, restaurant.id, undefined, timestamp);
  const dishes = mapVisitFormToDishes(values, visit.id, timestamp);

  await db.transaction("rw", [db.restaurants, db.visitRecords, db.dishRecords], async () => {
    await db.restaurants.put(restaurant);
    await db.visitRecords.put(visit);
    if (dishes.length > 0) {
      await db.dishRecords.bulkPut(dishes);
    }
  });

  return { restaurant, visit, dishes };
}

export async function updateVisitFromForm(
  visitId: string,
  values: VisitFormValues,
): Promise<VisitDetailData> {
  const current = await getVisitDetail(visitId);
  if (!current) {
    throw new Error("没有找到要编辑的探店记录");
  }

  const timestamp = nowIso();
  const restaurant = mapVisitFormToRestaurant(values, current.restaurant, timestamp);
  const visit = mapVisitFormToVisit(values, restaurant.id, current.visit, timestamp);
  const dishes = mapVisitFormToDishes(values, visit.id, timestamp);
  const oldDishes = await db.dishRecords.where("visitId").equals(visit.id).toArray();
  const removedPhotoIds = current.visit.photoIds.filter((photoId) => !visit.photoIds.includes(photoId));

  await db.transaction("rw", [db.restaurants, db.visitRecords, db.dishRecords], async () => {
    await db.restaurants.put(restaurant);
    await db.visitRecords.put(visit);
    if (oldDishes.length > 0) {
      await db.dishRecords.bulkDelete(oldDishes.map((dish) => dish.id));
    }
    if (dishes.length > 0) {
      await db.dishRecords.bulkPut(dishes);
    }
  });

  if (removedPhotoIds.length > 0) {
    await deletePhotosIfUnused(removedPhotoIds);
  }

  return { restaurant, visit, dishes };
}

export async function deleteVisit(visitId: string): Promise<void> {
  const detail = await getVisitDetail(visitId);
  if (!detail) {
    return;
  }

  const oldDishes = await db.dishRecords.where("visitId").equals(visitId).toArray();
  const photoIdsToCheck = [
    ...detail.visit.photoIds,
    ...oldDishes.flatMap((dish) => dish.photoIds),
  ];

  await db.transaction("rw", [db.visitRecords, db.dishRecords, db.restaurants], async () => {
    if (oldDishes.length > 0) {
      await db.dishRecords.bulkDelete(oldDishes.map((dish) => dish.id));
    }
    await db.visitRecords.delete(visitId);

    // 用户新建餐厅如果没有任何探店记录了，就顺手清理，避免首页统计残留。
    if (detail.restaurant.id.startsWith("restaurant-user-")) {
      const remainingVisits = await db.visitRecords
        .where("restaurantId")
        .equals(detail.restaurant.id)
        .count();
      if (remainingVisits === 0) {
        await db.restaurants.delete(detail.restaurant.id);
      }
    }
  });

  if (photoIdsToCheck.length > 0) {
    await deletePhotosIfUnused(photoIdsToCheck);
  }
}

function numberAverage(values: number[]) {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedAverage(values: number[]) {
  const average = numberAverage(values);
  return average === undefined ? undefined : Math.round(average);
}

function uniqueSorted<T extends string>(values: Array<T | string | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function buildDishesByVisitId(dishes: DishRecord[]) {
  const dishesByVisitId = new Map<string, DishRecord[]>();
  dishes.forEach((dish) => {
    const existing = dishesByVisitId.get(dish.visitId) ?? [];
    existing.push(dish);
    dishesByVisitId.set(dish.visitId, existing);
  });
  return dishesByVisitId;
}

function mapVisitItems(
  visits: VisitRecord[],
  restaurants: Restaurant[],
  dishes: DishRecord[],
): RecentVisitItem[] {
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const dishesByVisitId = buildDishesByVisitId(dishes);

  return visits
    .map((visit) => {
      const restaurant = restaurantById.get(visit.restaurantId);
      if (!restaurant) {
        return null;
      }
      return {
        visit,
        restaurant,
        dishes: dishesByVisitId.get(visit.id) ?? [],
      };
    })
    .filter((item): item is RecentVisitItem => item !== null)
    .sort(
      (left, right) =>
        right.visit.visitDate.localeCompare(left.visit.visitDate) ||
        right.visit.createdAt.localeCompare(left.visit.createdAt),
    );
}

export async function getExplorerData(): Promise<ExplorerData> {
  const [restaurants, visits, dishes] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
    db.dishRecords.toArray(),
  ]);

  const visitItems = mapVisitItems(visits, restaurants, dishes);
  const visitsByRestaurantId = new Map<string, RecentVisitItem[]>();
  visitItems.forEach((item) => {
    const existing = visitsByRestaurantId.get(item.restaurant.id) ?? [];
    existing.push(item);
    visitsByRestaurantId.set(item.restaurant.id, existing);
  });

  const restaurantItems: RestaurantListItem[] = restaurants
    .map((restaurant) => {
      const restaurantVisits = visitsByRestaurantId.get(restaurant.id) ?? [];
      const ratings = restaurantVisits
        .map((item) => item.visit.overallRating)
        .filter((rating) => rating > 0);
      const costs = restaurantVisits
        .map((item) => item.visit.averageCost)
        .filter((cost): cost is number => cost !== undefined && cost > 0);
      const tags = uniqueSorted([
        ...restaurant.tags,
        ...restaurantVisits.flatMap((item) => item.visit.tags),
      ]);

      return {
        restaurant,
        visits: restaurantVisits,
        visitsCount: restaurantVisits.length,
        averageRating: numberAverage(ratings),
        averageCost: roundedAverage(costs),
        recentVisitDate: restaurantVisits[0]?.visit.visitDate,
        tags,
      };
    })
    .sort((left, right) => {
      const leftDate = left.recentVisitDate ?? "";
      const rightDate = right.recentVisitDate ?? "";
      return rightDate.localeCompare(leftDate) || left.restaurant.name.localeCompare(right.restaurant.name, "zh-Hans-CN");
    });

  return {
    restaurants: restaurantItems,
    visits: visitItems,
    filters: {
      districts: uniqueSorted(restaurants.map((restaurant) => restaurant.district)),
      categories: uniqueSorted(restaurants.map((restaurant) => restaurant.category)),
      tags: uniqueSorted([
        ...restaurants.flatMap((restaurant) => restaurant.tags),
        ...visits.flatMap((visit) => visit.tags),
      ]),
    },
  };
}

function parseMaybeNumberText(value: string | undefined) {
  return parseOptionalNumber(value ?? "");
}

function wishlistInputToItem(
  input: WishlistInput,
  existing: WishlistItem | undefined,
  timestamp: string,
): WishlistItem {
  return {
    id: existing?.id ?? input.id ?? createId("wishlist"),
    restaurantName: input.restaurantName.trim(),
    branchName: optionalText(input.branchName ?? ""),
    category: input.category || undefined,
    address: optionalText(input.address ?? ""),
    district: optionalText(input.district ?? ""),
    businessArea: optionalText(input.businessArea ?? ""),
    latitude: parseMaybeNumberText(input.latitude),
    longitude: parseMaybeNumberText(input.longitude),
    source: optionalText(input.source ?? ""),
    priority: input.priority,
    notes: optionalText(input.notes ?? ""),
    tags: splitText(input.tagsText ?? ""),
    status: input.status ?? existing?.status ?? "想吃",
    visitedAt: existing?.visitedAt,
    linkedRestaurantId: existing?.linkedRestaurantId,
    linkedVisitId: existing?.linkedVisitId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export async function getWishlistItems(): Promise<WishlistItem[]> {
  const items = await db.wishlistItems.toArray();
  return items.sort((left, right) => {
    const statusWeight = { "想吃": 0, "已探店": 1, "暂不考虑": 2 };
    const priorityWeight = { "高": 0, "中": 1, "低": 2 };
    return (
      statusWeight[left.status] - statusWeight[right.status] ||
      priorityWeight[left.priority] - priorityWeight[right.priority] ||
      right.createdAt.localeCompare(left.createdAt)
    );
  });
}

export async function upsertWishlistItem(input: WishlistInput): Promise<WishlistItem> {
  const timestamp = nowIso();
  const existing = input.id ? await db.wishlistItems.get(input.id) : undefined;
  const item = wishlistInputToItem(input, existing, timestamp);
  await db.wishlistItems.put(item);
  return item;
}

export async function deleteWishlistItem(itemId: string): Promise<void> {
  await db.wishlistItems.delete(itemId);
}

async function findRestaurantForWishlist(item: WishlistItem) {
  const candidates = await db.restaurants.where("name").equals(item.restaurantName.trim()).toArray();
  return candidates.find((candidate) => (
    normalizeComparable(candidate.branchName) === normalizeComparable(item.branchName) &&
    normalizeComparable(candidate.address) === normalizeComparable(item.address)
  ));
}

export async function convertWishlistItemToVisit(
  itemId: string,
  input: WishlistConversionInput,
): Promise<VisitDetailData> {
  const item = await db.wishlistItems.get(itemId);
  if (!item) {
    throw new Error("没有找到这条想吃清单");
  }

  const timestamp = nowIso();
  const existingRestaurant = await findRestaurantForWishlist(item);
  const category = item.category ?? "其他";
  const restaurant: Restaurant = {
    id: existingRestaurant?.id ?? createId("restaurant-wishlist"),
    name: item.restaurantName.trim(),
    branchName: item.branchName,
    category,
    address: item.address,
    district: item.district,
    businessArea: item.businessArea,
    latitude: item.latitude,
    longitude: item.longitude,
    source: item.source,
    tags: item.tags,
    colorToken: existingRestaurant?.colorToken ?? categoryColorToken(category),
    coverPhotoId: existingRestaurant?.coverPhotoId,
    createdAt: existingRestaurant?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const peopleCount = Math.max(1, Math.round(parseOptionalNumber(input.peopleCount) ?? 1));
  const totalCost = parseOptionalNumber(input.totalCost ?? "");
  const typedAverageCost = parseOptionalNumber(input.averageCost ?? "");
  const averageCost =
    typedAverageCost ?? (totalCost !== undefined && peopleCount > 0 ? Math.round(totalCost / peopleCount) : undefined);
  const overallRating = parseOptionalNumber(input.overallRating) ?? 0;
  const revisitStatus: RevisitStatus = input.revisitStatus;
  const visit: VisitRecord = {
    id: createId("visit"),
    restaurantId: restaurant.id,
    visitDate: input.visitDate,
    companions: [],
    totalCost,
    averageCost,
    peopleCount,
    overallRating,
    revisitStatus,
    recommendedFor: [],
    tags: item.tags,
    summary: input.summary.trim() || `${item.restaurantName} 已从想吃清单转为探店记录。`,
    notes: optionalText(input.notes ?? item.notes ?? ""),
    photoIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const updatedWishlist: WishlistItem = {
    ...item,
    status: "已探店",
    visitedAt: input.visitDate,
    linkedRestaurantId: restaurant.id,
    linkedVisitId: visit.id,
    updatedAt: timestamp,
  };

  await db.transaction("rw", [db.restaurants, db.visitRecords, db.wishlistItems], async () => {
    await db.restaurants.put(restaurant);
    await db.visitRecords.put(visit);
    await db.wishlistItems.put(updatedWishlist);
  });

  return { restaurant, visit, dishes: [] };
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [, month] = key.split("-");
  return `${Number(month)}月`;
}

function countByName(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "zh-Hans-CN"));
}

export async function getStatsData(): Promise<StatsData> {
  const [restaurants, visits] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
  ]);
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const visitItems = visits
    .map((visit) => {
      const restaurant = restaurantById.get(visit.restaurantId);
      return restaurant ? { visit, restaurant } : null;
    })
    .filter((item): item is { visit: VisitRecord; restaurant: Restaurant } => item !== null);

  const ratings = visits.map((visit) => visit.overallRating).filter((rating) => rating > 0);
  const costs = visits
    .map((visit) => visit.averageCost)
    .filter((cost): cost is number => cost !== undefined && cost > 0);
  const monthCounts = new Map<string, VisitRecord[]>();
  visits.forEach((visit) => {
    const key = monthKey(visit.visitDate);
    const existing = monthCounts.get(key) ?? [];
    existing.push(visit);
    monthCounts.set(key, existing);
  });

  const monthlyTrend: MonthlyTrendDatum[] = [...monthCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, monthVisits]) => ({
      month,
      label: monthLabel(month),
      visits: monthVisits.length,
      averageRating: numberAverage(monthVisits.map((visit) => visit.overallRating).filter((rating) => rating > 0)),
    }));

  return {
    restaurantsCount: restaurants.length,
    visitsCount: visits.length,
    averageRating: numberAverage(ratings),
    averageCost: roundedAverage(costs),
    monthlyTrend,
    categoryDistribution: countByName(visitItems.map((item) => item.restaurant.category)),
    districtDistribution: countByName(visitItems.map((item) => item.restaurant.district ?? "未填写区域")),
    revisitDistribution: countByName(visits.map((visit) => visit.revisitStatus)),
    fewData: visits.length > 0 && visits.length < 3,
  };
}

export async function saveProcessedPhoto(photo: ProcessedPhoto): Promise<StoredPhoto> {
  const timestamp = nowIso();
  const storedPhoto: StoredPhoto = {
    id: createId("photo"),
    blob: photo.blob,
    thumbnailBlob: photo.thumbnailBlob,
    mimeType: photo.mimeType,
    width: photo.width,
    height: photo.height,
    size: photo.size,
    createdAt: timestamp,
  };
  await db.photos.put(storedPhoto);
  return storedPhoto;
}

export async function getPhoto(photoId: string): Promise<StoredPhoto | undefined> {
  return db.photos.get(photoId);
}

export async function getPhotosByIds(photoIds: string[]): Promise<StoredPhoto[]> {
  if (photoIds.length === 0) {
    return [];
  }
  const photos = await db.photos.bulkGet(photoIds);
  return photos.filter((photo): photo is StoredPhoto => Boolean(photo));
}

async function referencedPhotoIds(): Promise<Set<string>> {
  const [restaurants, visits, dishes] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
    db.dishRecords.toArray(),
  ]);
  return new Set([
    ...restaurants.map((restaurant) => restaurant.coverPhotoId).filter((id): id is string => Boolean(id)),
    ...visits.flatMap((visit) => visit.photoIds),
    ...dishes.flatMap((dish) => dish.photoIds),
  ]);
}

export async function deletePhotosIfUnused(photoIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(photoIds)];
  if (uniqueIds.length === 0) {
    return;
  }
  const referenced = await referencedPhotoIds();
  const unused = uniqueIds.filter((photoId) => !referenced.has(photoId));
  if (unused.length > 0) {
    await db.photos.bulkDelete(unused);
  }
}

async function encodedPhotos() {
  const photos = await db.photos.toArray();
  const encoded = await Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      mimeType: photo.mimeType,
      width: photo.width,
      height: photo.height,
      size: photo.size,
      createdAt: photo.createdAt,
      blobBase64: await blobToBase64(photo.blob),
      thumbnailBase64: await blobToBase64(photo.thumbnailBlob),
    })),
  );
  return encoded;
}

export async function createDataExportBundle(): Promise<DataExportBundle> {
  const [
    restaurants,
    visitRecords,
    dishRecords,
    wishlistItems,
    companions,
    tags,
    appSettings,
    photos,
  ] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
    db.dishRecords.toArray(),
    db.wishlistItems.toArray(),
    db.companions.toArray(),
    db.tags.toArray(),
    db.appSettings.toArray(),
    encodedPhotos(),
  ]);

  return {
    app: "rong-food-diary",
    version: 1,
    exportedAt: nowIso(),
    data: {
      restaurants,
      visitRecords,
      dishRecords,
      wishlistItems,
      companions,
      tags,
      appSettings,
      photos,
    },
  };
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必须是数组`);
  }
}

function validateEntityArray<T extends { id: string }>(value: unknown, label: string): T[] {
  assertArray(value, label);
  const ids = new Set<string>();
  value.forEach((item, index) => {
    assertObject(item, `${label}[${index}]`);
    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new Error(`${label}[${index}].id 必须是非空字符串`);
    }
    if (ids.has(item.id)) {
      throw new Error(`${label} 中存在重复 id：${item.id}`);
    }
    ids.add(item.id);
  });
  return value as T[];
}

function validateImportBundle(raw: unknown): DataExportBundle {
  assertObject(raw, "导入文件");
  if (raw.app !== "rong-food-diary") {
    throw new Error("导入文件不是 Rong Food Diary 数据");
  }
  if (raw.version !== 1) {
    throw new Error(`不支持的数据版本：${String(raw.version)}`);
  }
  if (typeof raw.exportedAt !== "string") {
    throw new Error("导入文件缺少 exportedAt 导出日期");
  }
  assertObject(raw.data, "data");
  const data = raw.data;

  return {
    app: "rong-food-diary",
    version: 1,
    exportedAt: raw.exportedAt,
    data: {
      restaurants: validateEntityArray<Restaurant>(data.restaurants, "data.restaurants"),
      visitRecords: validateEntityArray<VisitRecord>(data.visitRecords, "data.visitRecords"),
      dishRecords: validateEntityArray<DishRecord>(data.dishRecords, "data.dishRecords"),
      wishlistItems: validateEntityArray<WishlistItem>(data.wishlistItems, "data.wishlistItems"),
      companions: validateEntityArray(data.companions, "data.companions"),
      tags: validateEntityArray(data.tags, "data.tags"),
      appSettings: validateEntityArray(data.appSettings, "data.appSettings"),
      photos: validateEntityArray(data.photos, "data.photos"),
    },
  };
}

async function clearUserData() {
  await db.transaction(
    "rw",
    [
      db.restaurants,
      db.visitRecords,
      db.dishRecords,
      db.wishlistItems,
      db.companions,
      db.tags,
      db.photos,
      db.appSettings,
      db.visitDrafts,
    ],
    async () => {
      await Promise.all([
        db.restaurants.clear(),
        db.visitRecords.clear(),
        db.dishRecords.clear(),
        db.wishlistItems.clear(),
        db.companions.clear(),
        db.tags.clear(),
        db.photos.clear(),
        db.appSettings.clear(),
        db.visitDrafts.clear(),
      ]);
    },
  );
}

async function existingIdsByTable() {
  const [
    restaurants,
    visitRecords,
    dishRecords,
    wishlistItems,
    companions,
    tags,
    appSettings,
    photos,
  ] = await Promise.all([
    db.restaurants.toArray(),
    db.visitRecords.toArray(),
    db.dishRecords.toArray(),
    db.wishlistItems.toArray(),
    db.companions.toArray(),
    db.tags.toArray(),
    db.appSettings.toArray(),
    db.photos.toArray(),
  ]);

  return {
    restaurants: new Set(restaurants.map((item) => item.id)),
    visitRecords: new Set(visitRecords.map((item) => item.id)),
    dishRecords: new Set(dishRecords.map((item) => item.id)),
    wishlistItems: new Set(wishlistItems.map((item) => item.id)),
    companions: new Set(companions.map((item) => item.id)),
    tags: new Set(tags.map((item) => item.id)),
    appSettings: new Set(appSettings.map((item) => item.id)),
    photos: new Set(photos.map((item) => item.id)),
  };
}

function splitNewEntities<T extends { id: string }>(
  items: T[],
  existingIds: Set<string>,
  tableName: string,
  duplicates: string[],
) {
  return items.filter((item) => {
    if (existingIds.has(item.id)) {
      duplicates.push(`${tableName}:${item.id}`);
      return false;
    }
    return true;
  });
}

async function decodeImportPhotos(
  photos: DataExportBundle["data"]["photos"],
  existingPhotoIds: Set<string>,
  duplicates: string[],
  skippedPhotos: string[],
) {
  const decoded: StoredPhoto[] = [];

  photos.forEach((photo) => {
    if (existingPhotoIds.has(photo.id)) {
      duplicates.push(`photos:${photo.id}`);
      return;
    }
    try {
      if (!isImportableImageMime(photo.mimeType)) {
        throw new Error("图片类型不受支持");
      }
      if (typeof photo.blobBase64 !== "string" || typeof photo.thumbnailBase64 !== "string") {
        throw new Error("图片 Base64 字段缺失");
      }
      decoded.push({
        id: photo.id,
        blob: base64ToBlob(photo.blobBase64, photo.mimeType),
        thumbnailBlob: base64ToBlob(photo.thumbnailBase64, "image/webp"),
        mimeType: photo.mimeType,
        width: Number(photo.width) || 0,
        height: Number(photo.height) || 0,
        size: Number(photo.size) || 0,
        createdAt: typeof photo.createdAt === "string" ? photo.createdAt : nowIso(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知图片错误";
      skippedPhotos.push(`${photo.id}: ${message}`);
    }
  });

  return decoded;
}

export async function importDataBundle(raw: unknown, mode: ImportMode): Promise<ImportResult> {
  const bundle = validateImportBundle(raw);
  const backup = await createDataExportBundle();
  const duplicates: string[] = [];
  const skippedPhotos: string[] = [];
  const existingIds = mode === "merge"
    ? await existingIdsByTable()
    : {
        restaurants: new Set<string>(),
        visitRecords: new Set<string>(),
        dishRecords: new Set<string>(),
        wishlistItems: new Set<string>(),
        companions: new Set<string>(),
        tags: new Set<string>(),
        appSettings: new Set<string>(),
        photos: new Set<string>(),
      };

  const restaurants = splitNewEntities(bundle.data.restaurants, existingIds.restaurants, "restaurants", duplicates);
  const visitRecords = splitNewEntities(bundle.data.visitRecords, existingIds.visitRecords, "visitRecords", duplicates);
  const dishRecords = splitNewEntities(bundle.data.dishRecords, existingIds.dishRecords, "dishRecords", duplicates);
  const wishlistItems = splitNewEntities(bundle.data.wishlistItems, existingIds.wishlistItems, "wishlistItems", duplicates);
  const companions = splitNewEntities(bundle.data.companions, existingIds.companions, "companions", duplicates);
  const tags = splitNewEntities(bundle.data.tags, existingIds.tags, "tags", duplicates);
  const appSettings = splitNewEntities(bundle.data.appSettings, existingIds.appSettings, "appSettings", duplicates);
  const photos = await decodeImportPhotos(bundle.data.photos, existingIds.photos, duplicates, skippedPhotos);

  if (mode === "replace") {
    await clearUserData();
  }

  await db.transaction(
    "rw",
    [
      db.restaurants,
      db.visitRecords,
      db.dishRecords,
      db.wishlistItems,
      db.companions,
      db.tags,
      db.photos,
      db.appSettings,
    ],
    async () => {
      if (restaurants.length) await db.restaurants.bulkPut(restaurants);
      if (visitRecords.length) await db.visitRecords.bulkPut(visitRecords);
      if (dishRecords.length) await db.dishRecords.bulkPut(dishRecords);
      if (wishlistItems.length) await db.wishlistItems.bulkPut(wishlistItems);
      if (companions.length) await db.companions.bulkPut(companions);
      if (tags.length) await db.tags.bulkPut(tags);
      if (photos.length) await db.photos.bulkPut(photos);
      if (appSettings.length) await db.appSettings.bulkPut(appSettings);
    },
  );

  return {
    backup,
    skippedPhotos,
    duplicates,
    imported: {
      restaurants: restaurants.length,
      visitRecords: visitRecords.length,
      dishRecords: dishRecords.length,
      wishlistItems: wishlistItems.length,
      photos: photos.length,
    },
  };
}

export async function clearAllData(): Promise<void> {
  await clearUserData();
}

export async function restoreSampleData(): Promise<void> {
  await clearUserData();
  await db.transaction(
    "rw",
    [
      db.restaurants,
      db.visitRecords,
      db.dishRecords,
      db.wishlistItems,
      db.companions,
      db.tags,
    ],
    async () => {
      await db.restaurants.bulkPut(sampleRestaurants);
      await db.visitRecords.bulkPut(sampleVisitRecords);
      await db.dishRecords.bulkPut(sampleDishRecords);
      await db.wishlistItems.bulkPut(sampleWishlistItems);
      await db.companions.bulkPut(sampleCompanions);
      await db.tags.bulkPut(sampleTags);
    },
  );
}
