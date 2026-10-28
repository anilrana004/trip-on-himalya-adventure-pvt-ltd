import type { components } from "@/openapi/generated";

export type Lead = components["schemas"]["LeadResponse"];
export type LeadCreatePayload = components["schemas"]["LeadCreateRequest"];
export type LeadUpdatePayload = components["schemas"]["LeadUpdateRequest"];
export type LeadStatusPayload = components["schemas"]["LeadStatusRequest"];
export type LeadActivity = components["schemas"]["LeadActivityResponse"];
export type TripCopy = {
  coverImageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  contentBrief?: string | null;
};

export type Trip = components["schemas"]["TripResponse"] & TripCopy;
export type TripDetail = components["schemas"]["TripDetailResponse"] & TripCopy;

export type TrekReview = {
  id: string;
  tripId: string;
  tripName?: string | null;
  bookingId?: string | null;
  guestName: string;
  rating: number;
  body?: string | null;
  status: "PENDING" | "PUBLISHED" | "HIDDEN";
  createdAt?: string;
};

export type TrekFaq = {
  id: string;
  tripId: string;
  tripName?: string | null;
  question: string;
  answer: string;
  published: boolean;
  createdAt?: string;
};

export type TrekHighlight = {
  id: string;
  tripId: string;
  tripName?: string | null;
  label: string;
  kind: "SUMMARY" | "CHIP";
  sortOrder: number;
  onCard: boolean;
  published: boolean;
  createdAt?: string;
};

export type TrekTag = {
  id: string;
  tripId: string;
  tripName?: string | null;
  label: string;
  kind: "TERRAIN" | "SEASON";
  onCard: boolean;
  createdAt?: string;
};

export type TrekWaypoint = {
  id: string;
  tripId: string;
  tripName?: string | null;
  name: string;
  kind: "START" | "CAMP" | "SUMMIT" | "PASS" | "END";
  latitude: number;
  longitude: number;
  altitudeM?: number | null;
  dayNumber?: number | null;
  sortOrder: number;
  createdAt?: string;
};
export type TripCreatePayload = components["schemas"]["TripCreateRequest"];
export type TripUpdatePayload = components["schemas"]["TripUpdateRequest"];
export type Batch = components["schemas"]["BatchResponse"];
export type BatchCreatePayload = components["schemas"]["BatchCreateRequest"];
export type BatchUpdatePayload = components["schemas"]["BatchUpdateRequest"];

/** Calendar / dashboard departure row (from GET /api/batches/upcoming). */
export type UpcomingBatch = {
  id: string;
  tripId: string;
  tripName: string;
  tripCategory?: string;
  departureDate: string;
  maxCapacity: number;
  seatsBooked: number;
  available: number;
  fillPercent: number;
  capacityColor?: string;
  guideName?: string | null;
  status: string;
};
/**
 * Guides are the `category = GUIDE` slice of the vendor catalogue. The
 * standalone `/api/guides` endpoints were retired when vendors landed
 * (Module 2), but the trips page still called them, so the guides panel and
 * the batch guide-assignment dropdown were 404ing at runtime. These aliases
 * point the client at the real vendor routes.
 */
export type Guide = components["schemas"]["VendorResponse"];
export type GuideCreatePayload = components["schemas"]["VendorCreateRequest"];
export type GuideUpdatePayload = components["schemas"]["VendorUpdateRequest"];
export type Booking = components["schemas"]["BookingResponse"];
export type BookingCreatePayload = components["schemas"]["BookingCreateRequest"];
export type BookingStatusPayload = components["schemas"]["BookingStatusRequest"];
export type Payment = components["schemas"]["PaymentResponse"];
export type PaymentCreatePayload = components["schemas"]["PaymentCreateRequest"];
export type PaymentStatusPayload = components["schemas"]["PaymentStatusRequest"];
export type PaymentSummary = components["schemas"]["PaymentSummaryResponse"];
export type OpsHandoff = components["schemas"]["OperationsHandoffResponse"];

export type TravellerDocument = {
  id: string;
  travellerId?: string;
  bookingId?: string;
  docType: "ID_PROOF" | "MEDICAL_CERT" | "TRIP_PHOTO" | "CONSENT_FORM";
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | null;
};

export type FieldIncident = {
  id: string;
  bookingId: string;
  bookingRef?: string | null;
  customerName?: string | null;
  tripId?: string | null;
  tripName?: string | null;
  batchId?: string | null;
  departureDate?: string | null;
  kind: "MEDICAL" | "WEATHER" | "ALTITUDE" | "OTHER";
  summary: string;
  occurredOn: string;
  status: "OPEN" | "RESOLVED";
  resolution?: string | null;
  reportedByName?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
};
export type OpsArrangementsPayload = components["schemas"]["OpsArrangementsRequest"];
export type OpsNotePayload = components["schemas"]["OpsNoteRequest"];
export type LoginResponse = components["schemas"]["AuthResponse"];
export type Task = components["schemas"]["TaskResponse"];
export type NotificationItem = components["schemas"]["NotificationResponse"];
export type CustomerListItem = components["schemas"]["CustomerListResponse"];
export type CustomerDetail = components["schemas"]["CustomerDetailResponse"];
export type CustomerTripRow = components["schemas"]["TripRow"];
export type CustomerUpdatePayload = components["schemas"]["CustomerUpdateRequest"];
export type DashboardSummary = components["schemas"]["DashboardSummaryResponse"];
export type DashboardPerformance = components["schemas"]["PerformanceResponse"];
export type TargetRow = components["schemas"]["TargetDto"];
export type TargetsList = components["schemas"]["TargetListResponse"];
export type TargetsProgress = components["schemas"]["TargetProgressResponse"];
export type TargetUpsertPayload = Omit<
  components["schemas"]["TargetUpsertRequest"],
  "userId"
> & { userId?: string | null };
export type SalesUser = { id: string; fullName: string; email: string };

export type PipelineStage = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  probabilityWeight: number;
  entryCondition?: string | null;
  active: boolean;
};

export type Opportunity = {
  id: string;
  leadId: string;
  accountId?: string | null;
  stageKey: string;
  stageLabel: string;
  probabilityWeight: number;
  ownerId: string;
  expectedValue: number;
  expectedDate: string;
  status: "OPEN" | "WON" | "LOST";
  stageMovedAt?: string;
  closedAt?: string | null;
  closingNote?: string | null;
  closedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OpportunityListParams = {
  leadId?: string;
  ownerId?: string;
  stage?: string;
  status?: "OPEN" | "WON" | "LOST";
  from?: string;
  to?: string;
};

export type OpportunityCreatePayload = {
  leadId: string;
  stageKey?: string;
  expectedValue: number;
  expectedDate: string;
};

export type RevenueForecast = {
  from: string;
  to: string;
  expected: number;
  best: number;
  won: number;
  openCount: number;
  byStage: {
    stageKey: string;
    stageLabel: string;
    probabilityWeight: number;
    count: number;
    expected: number;
    best: number;
  }[];
  byMonth: { month: string; expected: number; best: number; won: number }[];
};

export type ForecastReport = {
  scope: string;
  from: string;
  to: string;
  months: {
    month: string;
    openCount: number;
    expected: number;
    best: number;
    wonCount: number;
    won: number;
  }[];
  owners: {
    ownerId: string;
    fullName: string;
    openCount: number;
    openValue: number;
    expected: number;
    wonCount: number;
    won: number;
    expectedSharePct: number;
  }[];
  stageMix: {
    stageKey: string;
    label: string;
    probabilityWeight: number;
    openCount: number;
    openValue: number;
    expected: number;
    expectedSharePct: number;
  }[];
  totals: {
    openInWindow: number;
    openOutsideWindow: number;
    openValue: number;
    expected: number;
    best: number;
    wonCount: number;
    won: number;
    pipelineCoveragePct: number;
  };
};

export type PipelineReport = {
  staleAfterDays?: number | null;
  stages: {
    stageKey: string;
    label: string;
    openCount: number;
    avgDaysInStage?: number | null;
    staleOpenDeals: number;
    winRatePct: number;
  }[];
  totals: {
    openCount: number;
    weightedValue: number;
    wonValue: number;
    lostCount: number;
    staleOpenDeals: number;
    winRatePct: number;
    openOutsideWindow: number;
  };
};

export type TeamUser = {
  id: string;
  email: string;
  fullName: string;
  role: "SALES" | "OPS" | "MANAGER" | "ADMIN" | "CEO" | "FINANCE" | "TRANSPORT" | "VENDOR";
  phone?: string | null;
  active: boolean;
  createdAt?: string;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorCategory?: string | null;
};

export type FinanceOverview = {
  collectedRevenue: number;
  outstandingReceivables: number;
  overdueAmount: number;
  refundedAmount: number;
  bookingPipeline: number;
  totalExpenses: number;
  netPosition: number;
  collectionRatePct: number;
  completedPaymentCount: number;
  overduePaymentCount: number;
  confirmedBookingCount: number;
  monthlySeries: { month: string; collected: number; expenses: number; outstanding: number }[];
  revenueByTrip: { name: string; amount: number; count: number }[];
  expensesByCategory: { name: string; amount: number; count: number }[];
  paymentsByStatus: { status: string; amount: number; count: number }[];
};

export type FinancePnL = {
  from: string;
  to: string;
  revenue: number;
  expenses: number;
  grossProfit: number;
  marginPct: number;
  expenseLines: { name: string; amount: number; count: number }[];
  revenueByTrip: { name: string; amount: number; count: number }[];
};

export type FinanceExpense = {
  id: string;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  tripId?: string | null;
  tripName?: string | null;
  vendorName?: string | null;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt?: string;
};

export type FinanceExpenseCreatePayload = {
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  tripId?: string;
  vendorName?: string;
  paymentMethod?: string;
  status?: string;
  notes?: string;
};

export type FinanceAging = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  totalOutstanding: number;
  lines: {
    bookingRef: string;
    amountType: string;
    amount: number;
    dueDate?: string | null;
    daysPastDue: number;
    bucket: string;
    status: string;
  }[];
};

export type FinanceCashflow = {
  from: string;
  to: string;
  totalInflow: number;
  totalOutflow: number;
  netCash: number;
  daily: { date: string; inflow: number; outflow: number; net: number }[];
};

export type FinanceTax = {
  from: string;
  to: string;
  taxableRevenue: number;
  outputGst: number;
  estimatedInputCredit: number;
  netGstPayable: number;
  gstRatePct: number;
  taxableByTrip: { name: string; amount: number; count: number }[];
};

export type FinanceTripPnL = {
  trips: {
    tripId: string;
    tripName: string;
    bookingCount: number;
    revenue: number;
    expenses: number;
    payouts: number;
    profit: number;
    marginPct: number;
  }[];
};

export type FinanceInvoiceLine = {
  id?: string;
  lineNo?: number;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableAmount?: number;
  gstRate: number;
};

export type FinanceInvoice = {
  id: string;
  invoiceNo: string;
  bookingId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerWhatsapp?: string | null;
  customerPhone?: string | null;
  customerGstin?: string | null;
  customerAddress?: string | null;
  customerState?: string | null;
  customerStateCode?: string | null;
  placeOfSupply?: string | null;
  placeOfSupplyCode?: string | null;
  sellerLegalName?: string | null;
  sellerTradeName?: string | null;
  sellerGstin?: string | null;
  sellerAddress?: string | null;
  sellerState?: string | null;
  sellerStateCode?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  sellerBankName?: string | null;
  sellerBankAccount?: string | null;
  sellerBankIfsc?: string | null;
  issueDate: string;
  dueDate: string;
  invoiceType?: string;
  supplyType?: string;
  reverseCharge?: boolean;
  sacCode?: string;
  subtotal: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxAmount: number;
  totalAmount: number;
  amountInWords?: string | null;
  currency: string;
  status: string;
  notes?: string | null;
  declaration?: string | null;
  whatsappDeliveryStatus?: string;
  whatsappQueuedAt?: string | null;
  whatsappSentAt?: string | null;
  whatsappLastError?: string | null;
  lines?: FinanceInvoiceLine[];
  createdAt?: string;
};

export type FinanceInvoiceCreatePayload = {
  bookingId?: string;
  customerName: string;
  customerEmail?: string;
  customerWhatsapp: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  customerState?: string;
  customerStateCode?: string;
  placeOfSupply?: string;
  placeOfSupplyCode?: string;
  issueDate: string;
  dueDate: string;
  invoiceType?: string;
  supplyType?: string;
  reverseCharge?: boolean;
  sacCode?: string;
  status?: string;
  notes?: string;
  declaration?: string;
  queueWhatsapp?: boolean;
  lines: {
    description: string;
    hsnSac?: string;
    quantity: number;
    unit?: string;
    rate: number;
    gstRate?: number;
  }[];
};

export type FinancePayout = {
  id: string;
  vendorName: string;
  category: string;
  tripId?: string | null;
  tripName?: string | null;
  amount: number;
  payoutDate: string;
  dueDate?: string | null;
  paymentMethod: string;
  status: string;
  referenceNo?: string | null;
  notes?: string | null;
  createdAt?: string;
};

export type FinancePayoutCreatePayload = {
  vendorName: string;
  category: string;
  tripId?: string;
  amount: number;
  payoutDate: string;
  dueDate?: string;
  paymentMethod?: string;
  status?: string;
  referenceNo?: string;
  notes?: string;
};

export type FinanceBudget = {
  periodMonth: string;
  lines: {
    category: string;
    budgetAmount: number;
    actualAmount: number;
    variance: number;
    usedPct: number;
  }[];
  totalBudget: number;
  totalActual: number;
  variance: number;
};

export type TeamUserCreatePayload = {
  email: string;
  fullName: string;
  role: TeamUser["role"];
  phone?: string;
  password: string;
  vendorId?: string;
};

export type TeamUserUpdatePayload = {
  fullName?: string;
  role?: TeamUser["role"];
  phone?: string | null;
  active?: boolean;
  password?: string;
  vendorId?: string | null;
};

export type InboxThread = {
  id: string;
  subjectType: "LEAD" | "CUSTOMER" | "BOOKING";
  subjectId: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS";
  customerMobile?: string | null;
  customerName?: string | null;
  status: "OPEN" | "PENDING" | "CLOSED";
  unreadCount: number;
  assignedTo?: string | null;
  lastMessageAt?: string | null;
  lastDirection?: string | null;
  lastPreview?: string | null;
  serviceWindowExpiresAt?: string | null;
  templateSendAllowed?: boolean;
};

export type InboxPage = {
  content: InboxThread[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type InboxListParams = {
  assignedTo?: string;
  status?: string;
  channel?: string;
  unreadOnly?: boolean;
  page?: number;
  size?: number;
};

export type TimelineEntry = {
  seq?: number;
  subjectType?: string;
  subjectId?: string;
  direction?: "INBOUND" | "OUTBOUND" | "SYSTEM";
  channel?: string;
  kind?: string;
  templateCode?: string | null;
  summary?: string | null;
  body?: string | null;
  provider?: string | null;
  customerMobile?: string | null;
  createdAt?: string;
};

// ---- Module 2 reports ----------------------------------------------------
export type SeasonValue = "SPRING" | "MONSOON" | "AUTUMN" | "WINTER";

export type ReportFilterParams = {
  consultantId?: string;
  tripId?: string;
  from?: string;
  to?: string;
  season?: SeasonValue;
  source?: string;
};

export type SalesFunnelData = components["schemas"]["SalesFunnelResponse"];
export type TripPerformanceData = components["schemas"]["TripPerformanceResponse"];
export type TeamPerformanceData = components["schemas"]["TeamPerformanceResponse"];
export type OperationsReadinessData = components["schemas"]["OperationsReadinessResponse"];
export type CustomerInsightsData = components["schemas"]["CustomerInsightsResponse"];
export type AuditSearchData = components["schemas"]["AuditSearchResponse"];

export type AuditSearchParams = {
  q?: string;
  entity?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
};

export type NotificationFeed = {
  items: NotificationItem[];
  unread: number;
};

export type TaskListParams = {
  leadId?: string;
  status?: string;
};

export type LeadPage = {
  content: Lead[];
  totalElements: number;
  totalPages: number;
  number: number;
};

export type LeadListParams = {
  status?: string;
  source?: string;
  heat?: string;
  tripId?: string;
  from?: string;
  to?: string;
  travelFrom?: string;
  travelTo?: string;
  ownerId?: string;
  search?: string;
  page?: number;
  size?: number;
};

export type ApiErrorBody = {
  code?: string;
  message?: string;
  fieldErrors?: { field: string; message: string }[];
};

/** Prefer field-level Bean Validation messages over the generic "Check your input". */
export function formatApiError(err: unknown, fallback = "Request failed"): string {
  if (err instanceof ApiClientError) {
    const fields = err.body.fieldErrors?.filter((f) => f.message).map((f) => f.message);
    if (fields && fields.length) return fields.join(" · ");
    if (err.body.message) return err.body.message;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const LEGACY_TOKENS = ["st_access", "st_refresh"];

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

/** Access token lives in memory. The refresh token is an HttpOnly cookie. */
export const tokenStore = {
  getAccess: () => accessToken,
  setAccess: (token: string | null) => {
    accessToken = token;
  },
  forgetLegacy: () => {
    if (typeof window === "undefined") return;
    for (const key of LEGACY_TOKENS) localStorage.removeItem(key);
  },
  clear: () => {
    accessToken = null;
    if (typeof window === "undefined") return;
    for (const key of LEGACY_TOKENS) localStorage.removeItem(key);
  },
};

export function refreshAccess(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as LoginResponse;
        if (!data.accessToken) return null;
        tokenStore.setAccess(data.accessToken);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export class ApiClientError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `Request failed (${status})`);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const access = tokenStore.getAccess();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (access) headers.set("Authorization", `Bearer ${access}`);
  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    const renewed = await refreshAccess();
    if (renewed) return request(path, init, true);
    tokenStore.clear();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, body);
  }
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<components["schemas"]["UserInfo"]>("/api/auth/me"),

  myPresence: () =>
    request<{
      id: string;
      fullName: string | null;
      loginAt: string;
      logoutAt: string | null;
      open: boolean;
      elapsedSeconds: number;
    } | null>("/api/auth/presence"),

  getDayHours: (day?: string) =>
    request<{
      workDate: string;
      live: boolean;
      people: Array<{
        userId: string;
        fullName: string | null;
        email: string | null;
        seconds: number;
        open: boolean;
        sessions: number;
      }>;
    }>(`/api/auth/presence/hours${qs({ day })}`),

  getPresenceBoard: () =>
    request<
      Array<{
        id: string;
        userId: string;
        fullName: string | null;
        email: string | null;
        role: string | null;
        loginAt: string;
        logoutAt: string | null;
        open: boolean;
        elapsedSeconds: number;
      }>
    >("/api/auth/presence/team"),

  getLeads: (params: LeadListParams = {}) =>
    request<LeadPage>(`/api/leads${qs({ ...params, size: params.size ?? 20 })}`),

  getLeadSources: () =>
    request<{ source: string; total: number; open: number; quoted: number; booked: number; lost: number }[]>(
      "/api/leads/sources",
    ),

  getWebsiteAttempts: () =>
    request<{ id: string; status: string; errorMessage?: string | null; leadId?: string | null; createdAt: string }[]>(
      "/api/capture/website-attempts",
    ),

  getLead: (id: string) => request<Lead>(`/api/leads/${id}`),

  createLead: (payload: LeadCreatePayload) =>
    request<Lead>("/api/leads", { method: "POST", body: JSON.stringify(payload) }),

  updateLead: (id: string, payload: LeadUpdatePayload) =>
    request<Lead>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  updateLeadStatus: (id: string, payload: LeadStatusPayload) =>
    request<Lead>(`/api/leads/${id}/status`, { method: "PATCH", body: JSON.stringify(payload) }),

  getLeadActivity: (id: string) => request<LeadActivity[]>(`/api/leads/${id}/activity`),

  getTrips: (active = true) => request<Trip[]>(`/api/trips${qs({ active })}`),

  getTrip: (id: string) => request<TripDetail>(`/api/trips/${id}`),

  createTrip: (payload: TripCreatePayload) =>
    request<TripDetail>("/api/trips", { method: "POST", body: JSON.stringify(payload) }),

  cloneTrip: (id: string, name?: string) =>
    request<{ trip: TripDetail; highlights: number; faqs: number; tags: number }>(`/api/trips/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    }),

  setTripsActive: (ids: string[], active: boolean) =>
    request<{ updated: number; unchanged: number; missing: string[] }>("/api/trips/bulk-status", {
      method: "POST",
      body: JSON.stringify({ ids, active }),
    }),

  importTripDrafts: (trips: TripCreatePayload[]) =>
    request<{ created: number; names: string[] }>("/api/trips/import", {
      method: "POST",
      body: JSON.stringify({ trips }),
    }),

  updateTrip: (
    id: string,
    payload: TripUpdatePayload & {
      coverImageUrl?: string;
      metaTitle?: string;
      metaDescription?: string;
      contentBrief?: string;
    },
  ) => request<TripDetail>(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  getReviews: () => request<TrekReview[]>("/api/reviews"),

  createReview: (payload: { tripId: string; bookingId?: string; guestName: string; rating: number; body?: string }) =>
    request<TrekReview>("/api/reviews", { method: "POST", body: JSON.stringify(payload) }),

  updateReviewStatus: (id: string, status: "PENDING" | "PUBLISHED" | "HIDDEN") =>
    request<TrekReview>(`/api/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getFaqs: () => request<TrekFaq[]>("/api/faqs"),

  createFaq: (payload: { tripId: string; question: string; answer: string; published?: boolean }) =>
    request<TrekFaq>("/api/faqs", { method: "POST", body: JSON.stringify(payload) }),

  updateFaq: (id: string, payload: { tripId: string; question: string; answer: string; published?: boolean }) =>
    request<TrekFaq>(`/api/faqs/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteFaq: (id: string) => request<void>(`/api/faqs/${id}`, { method: "DELETE" }),

  copyFaqs: (fromTripId: string, toTripId: string) =>
    request<{ copied: number; skipped: number }>("/api/faqs/copy", {
      method: "POST",
      body: JSON.stringify({ fromTripId, toTripId }),
    }),

  getHighlights: () => request<TrekHighlight[]>("/api/highlights"),

  createHighlight: (payload: {
    tripId: string;
    label: string;
    kind: "SUMMARY" | "CHIP";
    onCard?: boolean;
    published?: boolean;
    sortOrder?: number;
  }) => request<TrekHighlight>("/api/highlights", { method: "POST", body: JSON.stringify(payload) }),

  updateHighlight: (
    id: string,
    payload: {
      tripId: string;
      label: string;
      kind: "SUMMARY" | "CHIP";
      onCard?: boolean;
      published?: boolean;
      sortOrder?: number;
    },
  ) => request<TrekHighlight>(`/api/highlights/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteHighlight: (id: string) => request<void>(`/api/highlights/${id}`, { method: "DELETE" }),

  copyHighlights: (fromTripId: string, toTripId: string) =>
    request<{ copied: number; skipped: number }>("/api/highlights/copy", {
      method: "POST",
      body: JSON.stringify({ fromTripId, toTripId }),
    }),

  getTags: () => request<TrekTag[]>("/api/tags"),

  createTag: (payload: { tripId: string; label: string; kind: "TERRAIN" | "SEASON"; onCard?: boolean }) =>
    request<TrekTag>("/api/tags", { method: "POST", body: JSON.stringify(payload) }),

  updateTag: (id: string, payload: { tripId: string; label: string; kind: "TERRAIN" | "SEASON"; onCard?: boolean }) =>
    request<TrekTag>(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteTag: (id: string) => request<void>(`/api/tags/${id}`, { method: "DELETE" }),

  copyTags: (fromTripId: string, toTripId: string) =>
    request<{ copied: number; skipped: number }>("/api/tags/copy", {
      method: "POST",
      body: JSON.stringify({ fromTripId, toTripId }),
    }),

  getWaypoints: () => request<TrekWaypoint[]>("/api/waypoints"),

  getBatchCompliance: (batchId: string) =>
    request<{
      batchId: string;
      tripName?: string;
      departureDate?: string;
      totalRequired: number;
      totalVerified: number;
      remainingItems: number;
      readyForDeparture: boolean;
      travellers: {
        travellerId: string;
        fullName?: string;
        age?: number | null;
        requiredCount: number;
        verifiedCount: number;
        items: {
          item: "ID_PROOF" | "MEDICAL_FITNESS" | "EMERGENCY_CONTACT" | "MINOR_CONSENT";
          required: boolean;
          status: "MISSING" | "IN_PROGRESS" | "VERIFIED";
          documentId?: string | null;
        }[];
      }[];
    }>(`/api/compliance/batches/${batchId}`),

  markTravellerChecklist: (
    travellerId: string,
    items: { item: "ID_PROOF" | "MEDICAL_FITNESS" | "EMERGENCY_CONTACT" | "MINOR_CONSENT"; status: "MISSING" | "IN_PROGRESS" | "VERIFIED" }[],
  ) =>
    request<unknown>(`/api/compliance/travellers/${travellerId}`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  getTravellerCompliance: (travellerId: string) =>
    request<{
      travellerId: string;
      fullName?: string;
      requiredCount: number;
      verifiedCount: number;
      items: {
        item: "ID_PROOF" | "MEDICAL_FITNESS" | "EMERGENCY_CONTACT" | "MINOR_CONSENT";
        required: boolean;
        status: "MISSING" | "IN_PROGRESS" | "VERIFIED";
        documentId?: string | null;
      }[];
    }>(`/api/compliance/travellers/${travellerId}`),

  getTravellerDocuments: (travellerId: string) =>
    request<TravellerDocument[]>(`/api/documents${qs({ travellerId })}`),

  requestDocumentUpload: (payload: { travellerId: string; docType: TravellerDocument["docType"] }) =>
    request<{ uploadUrl: string; storageKey: string; expiresAt?: string }>("/api/documents/upload-url", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  confirmDocumentUpload: (payload: {
    storageKey: string;
    relatedType: "TRAVELLER";
    docType: TravellerDocument["docType"];
    travellerId: string;
    mimeType?: string;
    sizeBytes?: number;
  }) =>
    request<TravellerDocument>("/api/documents/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createWaypoint: (payload: {
    tripId: string;
    name: string;
    kind: TrekWaypoint["kind"];
    latitude: number;
    longitude: number;
    altitudeM?: number | null;
    dayNumber?: number | null;
  }) => request<TrekWaypoint>("/api/waypoints", { method: "POST", body: JSON.stringify(payload) }),

  updateWaypoint: (
    id: string,
    payload: {
      tripId: string;
      name: string;
      kind: TrekWaypoint["kind"];
      latitude: number;
      longitude: number;
      altitudeM?: number | null;
      dayNumber?: number | null;
      sortOrder?: number;
    },
  ) => request<TrekWaypoint>(`/api/waypoints/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteWaypoint: (id: string) => request<void>(`/api/waypoints/${id}`, { method: "DELETE" }),

  listBatches: (tripId: string) => request<Batch[]>(`/api/trips/${tripId}/batches`),

  getUpcomingBatches: (params: { from?: string; to?: string; limit?: number; includeCancelled?: boolean } = {}) =>
    request<UpcomingBatch[]>(`/api/batches/upcoming${qs({ ...params })}`),

  generateBatches: (
    tripId: string,
    payload: {
      recurrence: {
        firstDeparture: string;
        lastDeparture: string;
        frequency: "DAILY" | "WEEKLY" | "MONTHLY";
        interval?: number;
      };
      maxCapacity: number;
      guideId?: string;
      transportPlan?: string;
    },
  ) =>
    request<{ created?: number; skipped?: number; requested?: number }>(
      `/api/trips/${tripId}/batches/generate`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  createBatch: (tripId: string, payload: BatchCreatePayload) =>
    request<Batch>(`/api/trips/${tripId}/batches`, { method: "POST", body: JSON.stringify(payload) }),

  updateBatch: (id: string, payload: BatchUpdatePayload) =>
    request<Batch>(`/api/batches/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  getGuides: (active = true) =>
    request<Guide[]>(`/api/vendors${qs({ category: "GUIDE", active })}`),

  createGuide: (payload: GuideCreatePayload) =>
    request<Guide>("/api/vendors", {
      method: "POST",
      body: JSON.stringify({ ...payload, category: "GUIDE" }),
    }),

  updateGuide: (id: string, payload: GuideUpdatePayload) =>
    request<Guide>(`/api/vendors/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  getBookings: (params: { status?: string; tripId?: string; batchId?: string; customerId?: string } = {}) =>
    request<Booking[]>(`/api/bookings${qs({ ...params })}`),

  getBooking: (id: string) => request<Booking>(`/api/bookings/${id}`),

  createBooking: (payload: BookingCreatePayload) =>
    request<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(payload) }),

  updateBookingStatus: (id: string, payload: BookingStatusPayload) =>
    request<Booking>(`/api/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify(payload) }),

  getPayments: (params: { bookingId?: string; status?: string; amountType?: string } = {}) =>
    request<Payment[]>(`/api/payments${qs({ ...params })}`),

  getPaymentSummary: (bookingId: string) =>
    request<PaymentSummary>(`/api/payments/booking/${bookingId}/summary`),

  createPayment: (payload: PaymentCreatePayload) =>
    request<Payment>("/api/payments", { method: "POST", body: JSON.stringify(payload) }),

  updatePaymentStatus: (id: string, payload: PaymentStatusPayload) =>
    request<Payment>(`/api/payments/${id}/status`, { method: "PATCH", body: JSON.stringify(payload) }),

  getTasks: (params: TaskListParams = {}) =>
    request<Task[]>(`/api/tasks${qs({ ...params })}`),

  completeTask: (id: string) =>
    request<Task>(`/api/tasks/${id}/complete`, { method: "PATCH" }),

  getIncidents: (status?: "OPEN" | "RESOLVED") =>
    request<FieldIncident[]>(`/api/incidents${qs({ status })}`),

  createIncident: (payload: { bookingId: string; kind: FieldIncident["kind"]; summary: string; occurredOn?: string }) =>
    request<FieldIncident>("/api/incidents", { method: "POST", body: JSON.stringify(payload) }),

  resolveIncident: (id: string, resolution: string) =>
    request<FieldIncident>(`/api/incidents/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),

  getOperations: (params: {
    travelDateFrom?: string;
    travelDateTo?: string;
    hotelStatus?: string;
    transportStatus?: string;
    paymentStatus?: string;
  } = {}) => request<OpsHandoff[]>(`/api/operations${qs({ ...params })}`),

  getOperation: (id: string) => request<OpsHandoff>(`/api/operations/${id}`),

  updateOperationArrangements: (id: string, payload: OpsArrangementsPayload) =>
    request<OpsHandoff>(`/api/operations/${id}/arrangements`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  addOperationNote: (id: string, payload: OpsNotePayload) =>
    request<OpsHandoff>(`/api/operations/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateTripSheet: (id: string) =>
    request<OpsHandoff>(`/api/operations/${id}/trip-sheet`, { method: "POST" }),

  getNotifications: (unreadOnly = false) =>
    request<NotificationFeed>(`/api/notifications${qs({ unreadOnly })}`),

  markNotificationRead: (id: string) =>
    request<NotificationItem>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    request<{ updated: number }>("/api/notifications/read-all", { method: "POST" }),

  getCustomers: (search?: string) =>
    request<CustomerListItem[]>(`/api/customers${qs({ search })}`),

  getCustomer: (id: string) => request<CustomerDetail>(`/api/customers/${id}`),

  updateCustomer: (id: string, payload: CustomerUpdatePayload) =>
    request<CustomerDetail>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  getDashboardSummary: (period?: "today" | "month") =>
    request<DashboardSummary>(`/api/dashboard/summary${qs({ period })}`),

  getDashboardPerformance: (month?: string) =>
    request<DashboardPerformance>(`/api/dashboard/performance${qs({ month })}`),

  getTargets: (month?: string) => request<TargetsList>(`/api/targets${qs({ month })}`),

  getTargetProgress: (month?: string) =>
    request<TargetsProgress>(`/api/targets/progress${qs({ month })}`),

  upsertTarget: (payload: TargetUpsertPayload) =>
    request<TargetRow>("/api/targets", { method: "PUT", body: JSON.stringify(payload) }),

  deleteTarget: (id: string) => request<void>(`/api/targets/${id}`, { method: "DELETE" }),

  getSalesUsers: () => request<SalesUser[]>("/api/users/sales"),

  getTeamUsers: (params: { role?: string; active?: boolean } = {}) =>
    request<TeamUser[]>(`/api/users${qs({ ...params })}`),

  createTeamUser: (payload: TeamUserCreatePayload) =>
    request<TeamUser>("/api/users", { method: "POST", body: JSON.stringify(payload) }),

  updateTeamUser: (id: string, payload: TeamUserUpdatePayload) =>
    request<TeamUser>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  getSalesFunnel: (params: ReportFilterParams = {}) =>
    request<SalesFunnelData>(`/api/analytics/funnel${qs(params)}`),

  getTripPerformance: (params: ReportFilterParams = {}) =>
    request<TripPerformanceData>(`/api/analytics/trips${qs(params)}`),

  getTeamPerformance: (params: ReportFilterParams = {}) =>
    request<TeamPerformanceData>(`/api/analytics/team${qs(params)}`),

  getOperationsReadiness: (params: ReportFilterParams = {}) =>
    request<OperationsReadinessData>(`/api/analytics/operations${qs(params)}`),

  getCustomerInsights: (params: ReportFilterParams = {}) =>
    request<CustomerInsightsData>(`/api/analytics/customers${qs(params)}`),

  getAuditLog: (params: AuditSearchParams = {}) =>
    request<AuditSearchData>(`/api/analytics/audit${qs(params)}`),

  getInboxThreads: (params: InboxListParams = {}) =>
    request<InboxPage>(`/api/v1/threads${qs({ ...params })}`),

  getInboxThread: (id: string) => request<InboxThread>(`/api/v1/threads/${id}`),

  markInboxThreadRead: (id: string) =>
    request<InboxThread>(`/api/v1/threads/${id}/read`, { method: "POST" }),

  updateInboxThread: (id: string, payload: { assignedTo?: string | null; status?: string }) =>
    request<InboxThread>(`/api/v1/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getTimeline: (subjectType: string, subjectId: string) =>
    request<TimelineEntry[]>(`/api/timeline/${subjectType}/${subjectId}`),

  getWhatsAppTemplates: () =>
    request<{ code: string; label: string; expectedParams: number; enabled: boolean }[]>("/api/whatsapp/templates"),

  sendWhatsApp: (payload: {
    subjectType: "LEAD" | "CUSTOMER" | "BOOKING";
    subjectId: string;
    templateCode: string;
    mobile: string;
    bodyValues?: string[];
  }) =>
    request<{ id: string; status: string }>("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getEmailTemplates: () =>
    request<{ code: string; label: string; subjectLine: string; expectedParams: number }[]>("/api/v1/email/templates"),

  sendEmail: (payload: {
    subjectType: "LEAD" | "CUSTOMER" | "BOOKING";
    subjectId: string;
    templateCode?: string;
    email: string;
    bodyValues?: string[];
  }) =>
    request<{ id: string; status: string }>("/api/v1/email/send", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getFinanceOverview: (params: { from?: string; to?: string } = {}) =>
    request<FinanceOverview>(`/api/finance/overview${qs(params)}`),

  getFinancePnL: (params: { from?: string; to?: string } = {}) =>
    request<FinancePnL>(`/api/finance/pnl${qs(params)}`),

  getFinanceExpenses: (params: { from?: string; to?: string } = {}) =>
    request<FinanceExpense[]>(`/api/finance/expenses${qs(params)}`),

  createFinanceExpense: (payload: FinanceExpenseCreatePayload) =>
    request<FinanceExpense>("/api/finance/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  voidFinanceExpense: (id: string) =>
    request<FinanceExpense>(`/api/finance/expenses/${id}/void`, { method: "POST" }),

  getFinanceAging: () => request<FinanceAging>("/api/finance/aging"),

  getFinanceCashflow: (params: { from?: string; to?: string } = {}) =>
    request<FinanceCashflow>(`/api/finance/cashflow${qs(params)}`),

  getFinanceTax: (params: { from?: string; to?: string } = {}) =>
    request<FinanceTax>(`/api/finance/tax${qs(params)}`),

  getFinanceTripPnL: () => request<FinanceTripPnL>("/api/finance/trip-pnl"),

  getFinanceInvoices: () => request<FinanceInvoice[]>("/api/finance/invoices"),

  getFinanceInvoice: (id: string) => request<FinanceInvoice>(`/api/finance/invoices/${id}`),

  createFinanceInvoice: (payload: FinanceInvoiceCreatePayload) =>
    request<FinanceInvoice>("/api/finance/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFinanceInvoiceStatus: (id: string, status: string) =>
    request<FinanceInvoice>(`/api/finance/invoices/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  queueFinanceInvoiceWhatsapp: (id: string) =>
    request<FinanceInvoice>(`/api/finance/invoices/${id}/queue-whatsapp`, { method: "POST" }),

  getFinancePayouts: () => request<FinancePayout[]>("/api/finance/payouts"),

  createFinancePayout: (payload: FinancePayoutCreatePayload) =>
    request<FinancePayout>("/api/finance/payouts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFinancePayoutStatus: (id: string, status: string) =>
    request<FinancePayout>(`/api/finance/payouts/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  getFinanceBudgets: (month?: string) =>
    request<FinanceBudget>(`/api/finance/budgets${qs({ month })}`),

  upsertFinanceBudget: (payload: {
    periodMonth: string;
    category: string;
    budgetAmount: number;
    notes?: string;
  }) =>
    request<FinanceBudget>("/api/finance/budgets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getVendors: (params: { category?: string; active?: boolean } = {}) =>
    request<Guide[]>(`/api/vendors${qs({ ...params, active: params.active ?? true })}`),

  createVendor: (payload: Record<string, unknown>) =>
    request<Guide>("/api/vendors", { method: "POST", body: JSON.stringify(payload) }),

  getAttendanceDays: () =>
    request<
      Array<{
        id: string;
        userId: string;
        userName: string | null;
        workDate: string;
        checkInAt: string | null;
        checkOutAt: string | null;
        status: string;
        clockSkewFlagged: boolean;
        lateFlagged: boolean;
        workedMinutes: number | null;
        overtimeMinutes: number | null;
        compOffMinutes: number | null;
        ruleVersion: number | null;
        notes: string | null;
      }>
    >("/api/attendance/days"),

  getAttendanceSettings: () =>
    request<{
      rule: {
        version: number;
        effectiveFrom: string;
        graceMinutes: number;
        halfDayMinutes: number;
        fullDayMinutes: number;
        lateMarksToHalfDay: number;
        overtimeAfterMinutes: number;
      } | null;
      shifts: Array<{ id: string; name: string; start: string; end: string }>;
      weeklyOff: number[];
      holidays: Array<{ id: string; date: string; name: string }>;
      assignments: Array<{ id: string; userId: string; shiftId: string; effectiveFrom: string; effectiveTo: string | null }>;
    }>("/api/attendance/settings"),

  saveAttendanceRule: (payload: {
    effectiveFrom: string;
    graceMinutes: number;
    halfDayMinutes: number;
    fullDayMinutes: number;
    lateMarksToHalfDay: number;
    overtimeAfterMinutes: number;
  }) =>
    request<unknown>("/api/attendance/rules", { method: "POST", body: JSON.stringify(payload) }),

  saveAttendanceShift: (payload: { name: string; start: string; end: string }) =>
    request<unknown>("/api/attendance/shifts", { method: "POST", body: JSON.stringify(payload) }),

  assignAttendanceShift: (payload: { userId: string; shiftId: string; effectiveFrom: string }) =>
    request<unknown>("/api/attendance/shift-assignments", { method: "POST", body: JSON.stringify(payload) }),

  saveHoliday: (payload: { date: string; name: string }) =>
    request<unknown>("/api/attendance/holidays", { method: "POST", body: JSON.stringify(payload) }),

  deleteHoliday: (id: string) => request<unknown>(`/api/attendance/holidays/${id}`, { method: "DELETE" }),

  saveWeeklyOff: (days: number[]) =>
    request<unknown>("/api/attendance/weekly-off", { method: "PUT", body: JSON.stringify({ days }) }),

  assignReportsToBulk: (assignments: Array<{ userId: string; reportsTo: string | null }>) =>
    request<void>("/api/attendance/team/reports-to", {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    }),

  cancelBasecampLeave: (id: string) =>
    request<Record<string, unknown>>(`/api/basecamp/leave/${id}/cancel`, { method: "POST" }),

  punchAttendance: (payload: { type: "CHECK_IN" | "CHECK_OUT"; deviceTime: string }) =>
    request<{
      id: string;
      workDate: string;
      checkInAt: string | null;
      checkOutAt: string | null;
      clockSkewFlagged: boolean;
    }>("/api/attendance/punches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBasecampAttendance: (params: { from?: string; to?: string } = {}) =>
    request<Record<string, unknown>[]>(`/api/basecamp/attendance${qs(params)}`),

  upsertBasecampAttendance: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/basecamp/attendance", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBasecampLeave: () => request<Record<string, unknown>[]>("/api/basecamp/leave"),

  createBasecampLeave: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/basecamp/leave", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  reviewBasecampLeave: (id: string, status: string, note?: string) =>
    request<Record<string, unknown>>(`/api/basecamp/leave/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, note }),
    }),

  getBasecampPayroll: (month?: string) =>
    request<Record<string, unknown>[]>(`/api/basecamp/payroll${qs({ month })}`),

  upsertBasecampPayroll: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/basecamp/payroll", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBasecampInventory: () => request<Record<string, unknown>[]>("/api/basecamp/inventory"),

  createBasecampInventory: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/basecamp/inventory", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adjustBasecampInventory: (id: string, quantity: number) =>
    request<Record<string, unknown>>(`/api/basecamp/inventory/${id}/quantity`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }),

  getBasecampVisitors: () => request<Record<string, unknown>[]>("/api/basecamp/visitors"),

  checkInBasecampVisitor: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/basecamp/visitors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  checkOutBasecampVisitor: (id: string) =>
    request<Record<string, unknown>>(`/api/basecamp/visitors/${id}/checkout`, { method: "POST" }),

  getBasecampSettings: () => request<Record<string, string>>("/api/basecamp/settings"),

  updateBasecampSetting: (key: string, value: string) =>
    request<Record<string, string>>("/api/basecamp/settings", {
      method: "POST",
      body: JSON.stringify({ key, value }),
    }),

  /** ADR 0008 — Meta Marketing (server-side Graph proxy). */
  listMetaAdAccounts: () => request<MetaAdAccount[]>("/api/marketing/meta/ad-accounts"),

  listMetaCampaigns: (accountId: string, params?: { after?: string; limit?: number }) =>
    request<MetaPage<MetaCampaign>>(
      `/api/marketing/meta/ad-accounts/${encodeURIComponent(accountId)}/campaigns${qs({
        after: params?.after,
        limit: params?.limit ?? 25,
      })}`,
    ),

  getMetaInsights: (
    accountId: string,
    params?: { datePreset?: string; since?: string; until?: string; level?: string },
  ) =>
    request<MetaInsights>(
      `/api/marketing/meta/ad-accounts/${encodeURIComponent(accountId)}/insights${qs({
        datePreset: params?.datePreset,
        since: params?.since,
        until: params?.until,
        level: params?.level ?? "campaign",
      })}`,
    ),

  getMetaUsage: (days = 15, limit = 50) =>
    request<MetaUsageSummary>(`/api/marketing/meta/usage${qs({ days, limit })}`),

  getMetaDiagnostics: () => request<MetaDiagnostics>("/api/marketing/meta/diagnostics"),

  getPipelineStages: () => request<PipelineStage[]>("/api/pipeline-stages"),

  getOpportunities: (params: OpportunityListParams = {}) =>
    request<Opportunity[]>(`/api/opportunities${qs({ ...params })}`),

  createOpportunity: (payload: OpportunityCreatePayload) =>
    request<Opportunity>("/api/opportunities", { method: "POST", body: JSON.stringify(payload) }),

  moveOpportunityStage: (id: string, stageKey: string) =>
    request<Opportunity>(`/api/opportunities/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stageKey }),
    }),

  closeOpportunity: (id: string, payload: { outcome: "WON" | "LOST"; note?: string }) =>
    request<Opportunity>(`/api/opportunities/${id}/close`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getForecast: (from: string, to: string) =>
    request<RevenueForecast>(`/api/forecast${qs({ from, to })}`),

  getForecastReport: (params: { from: string; to: string; ownerId?: string }) =>
    request<ForecastReport>(`/api/analytics/forecast${qs(params)}`),

  getPipelineReport: (params: { from?: string; to?: string; ownerId?: string; staleAfterDays?: number } = {}) =>
    request<PipelineReport>(`/api/analytics/pipeline${qs(params)}`),
};

export type MetaAdAccount = {
  id: string;
  name: string;
  currency?: string | null;
  accountStatus?: number | null;
};

export type MetaCampaign = {
  id: string;
  name: string;
  status?: string | null;
  effectiveStatus?: string | null;
  objective?: string | null;
  updatedTime?: string | null;
};

export type MetaPage<T> = {
  data: T[];
  nextCursor?: string | null;
  hasMore: boolean;
};

export type MetaInsightRow = {
  campaignId?: string | null;
  campaignName?: string | null;
  impressions?: string | null;
  clicks?: string | null;
  spend?: string | null;
  cpc?: string | null;
  cpm?: string | null;
  ctr?: string | null;
  dateStart?: string | null;
  dateStop?: string | null;
};

export type MetaInsights = {
  accountId: string;
  datePreset?: string | null;
  since?: string | null;
  until?: string | null;
  rows: MetaInsightRow[];
};

export type MetaApiCallLogRow = {
  id: string;
  correlationId: string;
  operation: string;
  accountId?: string | null;
  graphVersion: string;
  httpStatus?: number | null;
  success: boolean;
  errorCode?: string | null;
  createdAt: string;
};

export type MetaUsageSummary = {
  successCount: number;
  failureCount: number;
  window: { from: string; to: string };
  recent: MetaApiCallLogRow[];
};

export type MetaDiagnostics = {
  config: {
    accessTokenSet: boolean;
    appSecretSet: boolean;
    webhookVerifyTokenSet: boolean;
    appIdSet: boolean;
    adAccountAllowlistSet: boolean;
  };
  status:
    | "CONFIG_MISSING"
    | "AUTH_FAILURE"
    | "PERMISSION_FAILURE"
    | "ACCOUNT_INACCESSIBLE"
    | "RATE_LIMITED"
    | "UNAVAILABLE"
    | "OK";
  message: string;
  graphVersion: string;
  graphUserId?: string | null;
  visibleAdAccountCount?: number | null;
  webhookConfigReady: boolean;
  capabilities?: {
    adsEnabled: boolean;
    leadsEnabled: boolean;
    granted: string[];
    missingForAds: string[];
    missingForLeads: string[];
    missingPageAccess: string[];
  };
};