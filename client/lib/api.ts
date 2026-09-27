import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth-storage";

const DEFAULT_API_URL = "http://127.0.0.1:8000";

/** API base URL for server and browser. Prefer NEXT_PUBLIC_ for client bundles. */
export function getApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    DEFAULT_API_URL
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
  /** Skip 401 → refresh → retry (used by refresh itself). */
  skipRefresh?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return null;
    }

    try {
      const tokens = await apiRequest<TokenResponse>("/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
        skipRefresh: true,
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    auth = false,
    skipRefresh = false,
  } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const bearer = token ?? (auth ? getAccessToken() : null);
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const usedAuth = Boolean(bearer) || auth;
  if (res.status === 401 && usedAuth && !skipRefresh && typeof window !== "undefined") {
    const nextAccess = await refreshAccessToken();
    if (nextAccess) {
      return apiRequest<T>(path, {
        ...options,
        token: nextAccess,
        skipRefresh: true,
      });
    }
  }

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = undefined;
    }
    const detail =
      typeof errorBody === "object" &&
      errorBody &&
      "detail" in errorBody &&
      typeof (errorBody as { detail: unknown }).detail === "string"
        ? (errorBody as { detail: string }).detail
        : `API request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(detail, res.status, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string, auth = false): Promise<T> {
  return apiRequest<T>(path, { auth });
}

export function apiPost<T>(path: string, body: unknown, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body, auth });
}

export function apiPatch<T>(path: string, body: unknown, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body, auth });
}

export function apiPut<T>(path: string, body: unknown, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: "PUT", body, auth });
}

export function apiDelete(path: string, auth = false): Promise<void> {
  return apiRequest<void>(path, { method: "DELETE", auth });
}

export type Paginated<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};



export type HealthResponse = {
  status: string;
  database?: string;
  app?: string;
  version?: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserRole = "admin" | "staff";

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

export type Therapist = {
  id: number;
  full_name: string;
  specialty: string;
  working_days: number[];
  default_start_time: string;
  default_end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  weekly_hours: string | number;
  patients_seen_today: number;
};

export type TherapistPayload = {
  full_name: string;
  specialty: string;
  working_days: number[];
  default_start_time: string;
  default_end_time: string;
  slot_duration_minutes: number;
  is_active?: boolean;
};

export type DayOverride = {
  id: number;
  therapist_id: number;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type DayOverridePayload = {
  override_date: string;
  is_day_off: boolean;
  start_time?: string | null;
  end_time?: string | null;
};

export type Package = {
  id: number;
  name: string;
  session_count: number;
  price: string | number;
  description: string | null;
  is_active: boolean;
};

export type PatientGender = "male" | "female" | "other" | "unspecified";
export type PatientStatus = "active" | "completed" | "on_hold";

export type Patient = {
  id: number;
  full_name: string;
  phone: string;
  age: number;
  gender: PatientGender;
  address: string;
  condition: string;
  therapist_id: number;
  therapist_name: string;
  package_id: number;
  package_name: string;
  status: PatientStatus;
};

export type PatientPayload = {
  full_name: string;
  phone: string;
  age: number;
  gender: PatientGender;
  address: string;
  condition: string;
  therapist_id: number;
  package_id: number;
  status: PatientStatus;
};

export type PatientSession = {
  id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  therapist_id: number;
  therapist_name: string;
  status: string;
  payment_method: string;
  notes: string | null;
};

export type PatientInvoice = {
  id: number;
  invoice_number: string;
  issued_on: string;
  package_name: string;
  amount: string;
  discount: string;
  net_amount: string;
  status: string;
  payment_method: string;
};

export type PatientDetail = Patient & {
  sessions: PatientSession[];
  invoices: PatientInvoice[];
};

export type PaymentMethod = "cash" | "card" | "insurance" | "other";
export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no_show";
export type InvoiceStatus = "paid" | "due";

export type Invoice = {
  id: number;
  invoice_number: string;
  patient_id: number;
  patient_name: string;
  package_id: number;
  package_name: string;
  appointment_id: number | null;
  created_by_user_id: number;
  amount: string | number;
  discount: string | number;
  net_amount: string | number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  issued_on: string;
  paid_at: string | null;
  notes: string | null;
};

export type InvoicePayload = {
  patient_id: number;
  package_id: number;
  appointment_id?: number | null;
  amount?: number | null;
  discount?: number;
  status?: InvoiceStatus;
  payment_method?: PaymentMethod;
  issued_on?: string | null;
  notes?: string | null;
};

export type InvoiceUpdatePayload = {
  package_id?: number;
  appointment_id?: number | null;
  amount?: number;
  discount?: number;
  status?: InvoiceStatus;
  payment_method?: PaymentMethod;
  issued_on?: string;
  notes?: string | null;
};

export type Appointment = {
  id: number;
  patient_id: number;
  patient_name: string;
  therapist_id: number;
  therapist_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  payment_method: PaymentMethod;
  notes: string | null;
};

export type ScheduleSlot = {
  start_time: string;
  end_time: string;
  state: "open" | "booked" | "off";
  appointment: Appointment | null;
};

export type ScheduleTherapistColumn = {
  id: number;
  full_name: string;
  specialty: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  slot_duration_minutes: number;
  slots: ScheduleSlot[];
};

export type ScheduleDay = {
  date: string;
  time_labels: string[];
  therapists: ScheduleTherapistColumn[];
};

export type ActivityLog = {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AppointmentCreatePayload = {
  patient_id: number;
  therapist_id: number;
  appointment_date: string;
  start_time: string;
  payment_method: PaymentMethod;
  notes?: string | null;
};

export type AppointmentUpdatePayload = {
  therapist_id?: number;
  appointment_date?: string;
  start_time?: string;
  payment_method?: PaymentMethod;
  notes?: string | null;
  status?: AppointmentStatus;
};
