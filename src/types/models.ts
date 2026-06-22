export type ISODateString = string;
export type EntityId = string;

export type RestaurantCategory =
  | "火锅"
  | "川菜"
  | "串串"
  | "咖啡"
  | "甜品"
  | "面馆"
  | "烧烤"
  | "小吃"
  | "其他";

export type MealPeriod = "早餐" | "午餐" | "下午茶" | "晚餐" | "夜宵";
export type DiningPurpose = "一个人" | "朋友聚餐" | "家庭聚餐" | "约会" | "工作餐" | "随便吃点";
export type RevisitStatus = "愿意复访" | "看情况" | "不再复访";
export type QueueWorthiness = "值得排队" | "不用排队更好" | "不值得排队";
export type RecommendationStatus = "必点" | "推荐" | "一般" | "避雷";
export type WishlistPriority = "高" | "中" | "低";
export type WishlistStatus = "想吃" | "已探店" | "暂不考虑";
export type TagType = "restaurant" | "visit" | "dish" | "wishlist";
export type VisitFormMode = "create" | "edit";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type BaseEntity = {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type Restaurant = BaseEntity & {
  name: string;
  branchName?: string;
  category: RestaurantCategory;
  address?: string;
  district?: string;
  businessArea?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  source?: string;
  tags: string[];
  coverPhotoId?: EntityId;
  colorToken: "orange" | "blue" | "pink";
};

export type VisitRecord = BaseEntity & {
  restaurantId: EntityId;
  visitDate: ISODateString;
  mealPeriod?: MealPeriod;
  companions: string[];
  diningPurpose?: DiningPurpose;
  totalCost?: number;
  averageCost?: number;
  peopleCount: number;
  overallRating: number;
  tasteRating?: number;
  environmentRating?: number;
  serviceRating?: number;
  valueRating?: number;
  revisitStatus: RevisitStatus;
  queueWorthiness?: QueueWorthiness;
  recommendedFor: string[];
  tags: string[];
  summary: string;
  notes?: string;
  photoIds: EntityId[];
};

export type DishRecord = BaseEntity & {
  visitId: EntityId;
  name: string;
  category?: string;
  price?: number;
  rating?: number;
  recommendationStatus: RecommendationStatus;
  notes?: string;
  photoIds: EntityId[];
};

export type WishlistItem = BaseEntity & {
  restaurantName: string;
  branchName?: string;
  category?: RestaurantCategory;
  address?: string;
  district?: string;
  businessArea?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  priority: WishlistPriority;
  notes?: string;
  tags: string[];
  status: WishlistStatus;
  visitedAt?: ISODateString;
  linkedRestaurantId?: EntityId;
  linkedVisitId?: EntityId;
};

export type Companion = BaseEntity & {
  name: string;
};

export type Tag = BaseEntity & {
  name: string;
  color: string;
  type: TagType;
};

export type StoredPhoto = {
  id: EntityId;
  blob: Blob;
  thumbnailBlob: Blob;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  size: number;
  createdAt: ISODateString;
};

export type AppSettings = BaseEntity & {
  hasCompletedWelcome: boolean;
  mapProvider: "placeholder" | "amap";
  theme: "soft";
};

export type DishFormValues = {
  localId: EntityId;
  id?: EntityId;
  name: string;
  category: string;
  price: string;
  rating: string;
  recommendationStatus: RecommendationStatus;
  notes: string;
};

export type VisitFormValues = {
  restaurant: {
    id?: EntityId;
    name: string;
    branchName: string;
    category: RestaurantCategory | "";
    address: string;
    district: string;
    businessArea: string;
    latitude: string;
    longitude: string;
    phone: string;
    source: string;
  };
  visit: {
    id?: EntityId;
    visitDate: string;
    mealPeriod: MealPeriod | "";
    companionsText: string;
    diningPurpose: DiningPurpose | "";
    peopleCount: string;
    totalCost: string;
    averageCost: string;
    overallRating: string;
    tasteRating: string;
    environmentRating: string;
    serviceRating: string;
    valueRating: string;
    revisitStatus: RevisitStatus;
    queueWorthiness: QueueWorthiness | "";
    recommendedForText: string;
    tagsText: string;
    summary: string;
    notes: string;
    photoIds: EntityId[];
  };
  dishes: DishFormValues[];
  currentStep: number;
};

export type VisitDraft = BaseEntity & {
  mode: VisitFormMode;
  visitId?: EntityId;
  formData: VisitFormValues;
  savedAt: ISODateString;
};

export type RecentVisitItem = {
  visit: VisitRecord;
  restaurant: Restaurant;
  dishes: DishRecord[];
};

export type VisitDetailData = RecentVisitItem;

export type RestaurantDetailData = {
  restaurant: Restaurant;
  visits: RecentVisitItem[];
  averageRating?: number;
  averageCost?: number;
  recentVisitDate?: ISODateString;
  commonTags: string[];
};

export type DashboardData = {
  restaurantsCount: number;
  visitsCount: number;
  thisMonthVisitsCount: number;
  litDistrictsCount: number;
  recentVisits: RecentVisitItem[];
};

export type RestaurantListItem = {
  restaurant: Restaurant;
  visits: RecentVisitItem[];
  visitsCount: number;
  averageRating?: number;
  averageCost?: number;
  recentVisitDate?: ISODateString;
  tags: string[];
};

export type ExplorerData = {
  restaurants: RestaurantListItem[];
  visits: RecentVisitItem[];
  filters: {
    districts: string[];
    categories: RestaurantCategory[];
    tags: string[];
  };
};

export type WishlistInput = {
  id?: EntityId;
  restaurantName: string;
  branchName?: string;
  category?: RestaurantCategory | "";
  address?: string;
  district?: string;
  businessArea?: string;
  latitude?: string;
  longitude?: string;
  source?: string;
  priority: WishlistPriority;
  notes?: string;
  tagsText?: string;
  status?: WishlistStatus;
};

export type WishlistConversionInput = {
  visitDate: ISODateString;
  peopleCount: string;
  totalCost?: string;
  averageCost?: string;
  overallRating: string;
  revisitStatus: RevisitStatus;
  summary: string;
  notes?: string;
};

export type ChartDatum = {
  name: string;
  value: number;
};

export type MonthlyTrendDatum = {
  month: string;
  label: string;
  visits: number;
  averageRating?: number;
};

export type StatsData = {
  restaurantsCount: number;
  visitsCount: number;
  averageRating?: number;
  averageCost?: number;
  monthlyTrend: MonthlyTrendDatum[];
  categoryDistribution: ChartDatum[];
  districtDistribution: ChartDatum[];
  revisitDistribution: ChartDatum[];
  fewData: boolean;
};

export type ProcessedPhoto = {
  blob: Blob;
  thumbnailBlob: Blob;
  mimeType: StoredPhoto["mimeType"];
  width: number;
  height: number;
  size: number;
};

export type DataExportBundle = {
  app: "rong-food-diary";
  version: 1;
  exportedAt: ISODateString;
  data: {
    restaurants: Restaurant[];
    visitRecords: VisitRecord[];
    dishRecords: DishRecord[];
    wishlistItems: WishlistItem[];
    companions: Companion[];
    tags: Tag[];
    appSettings: AppSettings[];
    photos: Array<{
      id: EntityId;
      mimeType: StoredPhoto["mimeType"];
      width: number;
      height: number;
      size: number;
      createdAt: ISODateString;
      blobBase64: string;
      thumbnailBase64: string;
    }>;
  };
};

export type ImportMode = "merge" | "replace";

export type ImportResult = {
  imported: {
    restaurants: number;
    visitRecords: number;
    dishRecords: number;
    wishlistItems: number;
    photos: number;
  };
  skippedPhotos: string[];
  duplicates: string[];
  backup: DataExportBundle;
};
