import type {
  DishFormValues,
  RestaurantCategory,
  VisitDetailData,
  VisitFormValues,
} from "../types/models";

export const restaurantCategories: RestaurantCategory[] = [
  "火锅",
  "川菜",
  "串串",
  "咖啡",
  "甜品",
  "面馆",
  "烧烤",
  "小吃",
  "其他",
];

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function createLocalId(prefix = "local") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyDish(): DishFormValues {
  return {
    localId: createLocalId("dish-local"),
    name: "",
    category: "",
    price: "",
    rating: "",
    recommendationStatus: "推荐",
    notes: "",
  };
}

export function createEmptyVisitFormValues(): VisitFormValues {
  return {
    restaurant: {
      name: "",
      branchName: "",
      category: "",
      address: "",
      district: "",
      businessArea: "",
      latitude: "",
      longitude: "",
      phone: "",
      source: "",
    },
    visit: {
      visitDate: todayInputValue(),
      mealPeriod: "",
      companionsText: "",
      diningPurpose: "",
      peopleCount: "1",
      totalCost: "",
      averageCost: "",
      overallRating: "",
      tasteRating: "",
      environmentRating: "",
      serviceRating: "",
      valueRating: "",
      revisitStatus: "愿意复访",
      queueWorthiness: "",
      recommendedForText: "",
      tagsText: "",
      summary: "",
      notes: "",
      photoIds: [],
    },
    dishes: [],
    currentStep: 1,
  };
}

function textList(values: string[]) {
  return values.join("、");
}

function numberText(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

export function formValuesFromVisitDetail(detail: VisitDetailData): VisitFormValues {
  return {
    restaurant: {
      id: detail.restaurant.id,
      name: detail.restaurant.name,
      branchName: detail.restaurant.branchName ?? "",
      category: detail.restaurant.category,
      address: detail.restaurant.address ?? "",
      district: detail.restaurant.district ?? "",
      businessArea: detail.restaurant.businessArea ?? "",
      latitude: numberText(detail.restaurant.latitude),
      longitude: numberText(detail.restaurant.longitude),
      phone: detail.restaurant.phone ?? "",
      source: detail.restaurant.source ?? "",
    },
    visit: {
      id: detail.visit.id,
      visitDate: detail.visit.visitDate,
      mealPeriod: detail.visit.mealPeriod ?? "",
      companionsText: textList(detail.visit.companions),
      diningPurpose: detail.visit.diningPurpose ?? "",
      peopleCount: String(detail.visit.peopleCount),
      totalCost: numberText(detail.visit.totalCost),
      averageCost: numberText(detail.visit.averageCost),
      overallRating: String(detail.visit.overallRating),
      tasteRating: numberText(detail.visit.tasteRating),
      environmentRating: numberText(detail.visit.environmentRating),
      serviceRating: numberText(detail.visit.serviceRating),
      valueRating: numberText(detail.visit.valueRating),
      revisitStatus: detail.visit.revisitStatus,
      queueWorthiness: detail.visit.queueWorthiness ?? "",
      recommendedForText: textList(detail.visit.recommendedFor),
      tagsText: textList(detail.visit.tags),
      summary: detail.visit.summary,
      notes: detail.visit.notes ?? "",
      photoIds: detail.visit.photoIds,
    },
    dishes: detail.dishes.map((dish) => ({
      localId: createLocalId("dish-local"),
      id: dish.id,
      name: dish.name,
      category: dish.category ?? "",
      price: numberText(dish.price),
      rating: numberText(dish.rating),
      recommendationStatus: dish.recommendationStatus,
      notes: dish.notes ?? "",
    })),
    currentStep: 1,
  };
}
