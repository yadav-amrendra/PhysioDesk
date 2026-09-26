# PhysioDesk — database ERD

PostgreSQL schema for clinic management: auth users, therapists (with day overrides), packages, patients, appointments, invoices, and append-only activity logs.

```mermaid
erDiagram
  users ||--o{ invoices : "created_by"
  users ||--o{ activity_logs : "performed"
  users ||--o{ refresh_tokens : "sessions"
  packages ||--o{ patients : "enrolled"
  packages ||--o{ invoices : "billed"
  therapists ||--o{ patients : "assigned"
  therapists ||--o{ appointments : "sees"
  therapists ||--o{ therapist_day_overrides : "has"
  patients ||--o{ appointments : "books"
  patients ||--o{ invoices : "owes"
  appointments ||--o| invoices : "optional"

  users {
    int id PK
    string email UK
    string full_name
    string hashed_password
    string role
    bool is_active
    timestamptz created_at
    timestamptz updated_at
  }

  refresh_tokens {
    int id PK
    int user_id FK
    string jti UK
    string token_hash
    timestamptz expires_at
    timestamptz revoked_at
    string replaced_by_jti
    timestamptz created_at
  }

  therapists {
    int id PK
    string full_name
    string specialty
    string working_days
    time default_start_time
    time default_end_time
    int slot_duration_minutes
    bool is_active
    timestamptz created_at
    timestamptz updated_at
  }

  therapist_day_overrides {
    int id PK
    int therapist_id FK
    date override_date
    bool is_day_off
    time start_time
    time end_time
  }

  packages {
    int id PK
    string name UK
    int session_count
    numeric price
    text description
    bool is_active
  }

  patients {
    int id PK
    string full_name
    string phone
    int age
    string gender
    text address
    string condition
    int therapist_id FK
    int package_id FK
    string status
    timestamptz created_at
    timestamptz updated_at
  }

  appointments {
    int id PK
    int patient_id FK
    int therapist_id FK
    date appointment_date
    time start_time
    time end_time
    string status
    string payment_method
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  invoices {
    int id PK
    string invoice_number UK
    int patient_id FK
    int package_id FK
    int appointment_id FK
    int created_by_user_id FK
    numeric amount
    numeric discount
    string status
    string payment_method
    date issued_on
    timestamptz paid_at
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  activity_logs {
    int id PK
    int actor_user_id FK
    string action
    string entity_type
    int entity_id
    string summary
    jsonb metadata
    timestamptz created_at
  }
```

## Cardinality

| From | To | Cardinality | Notes |
| --- | --- | --- | --- |
| therapists | therapist_day_overrides | 1:N | Unique `(therapist_id, override_date)` |
| therapists | patients | 1:N | Assigned therapist |
| packages | patients | 1:N | Enrolled package |
| therapists | appointments | 1:N | |
| patients | appointments | 1:N | |
| patients | invoices | 1:N | |
| packages | invoices | 1:N | |
| appointments | invoices | 0:1 | Optional link |
| users | invoices | 1:N | `created_by_user_id` |
| users | activity_logs | 1:N | `actor_user_id` |

`activity_logs.entity_id` is a polymorphic reference paired with `entity_type` (not a database foreign key).

Double-booking is blocked by a partial unique index on appointments:  
`(therapist_id, appointment_date, start_time)` where `status <> 'cancelled'`.
