# Supabase Schema Audit

Generated: 2026-05-10
Project: rt-scheduler (fjbkfgvdzidvfaxrqzjz)
Source: live remote Postgres catalog via read-only metadata queries.

## Scope

- auth: 23 relations
- cron: 2 relations
- extensions: 2 relations
- public: 32 relations
- realtime: 10 relations
- storage: 8 relations
- supabase_migrations: 1 relations
- vault: 2 relations

## Findings

- Public app tables all have primary keys.
- Public app tables all have RLS enabled.
- Nullable lifecycle/audit columns worth normalizing: public.availability_requests.created_at, public.profiles.created_at, public.profiles.role, public.schedule_cycles.created_at, public.schedule_cycles.published, public.shift_posts.created_at, public.shifts.created_at
- Nullable public foreign keys worth reviewing for intentional optional states: public.availability_email_intake_items.attachment_id -> public.availability_email_attachments.id; public.availability_email_intake_items.auto_applied_by -> public.profiles.id; public.availability_email_intake_items.matched_cycle_id -> public.schedule_cycles.id; public.availability_email_intake_items.matched_therapist_id -> public.profiles.id; public.availability_email_intake_items.reviewed_by -> public.profiles.id; public.availability_email_intakes.applied_by -> public.profiles.id; public.availability_email_intakes.matched_cycle_id -> public.schedule_cycles.id; public.availability_email_intakes.matched_therapist_id -> public.profiles.id; public.availability_requests.cycle_id -> public.schedule_cycles.id; public.availability_requests.user_id -> public.profiles.id; public.availability_reviews.reviewed_by -> public.profiles.id; public.cycle_templates.created_by -> public.profiles.id; public.employee_roster.created_by -> public.profiles.id; public.employee_roster.matched_profile_id -> public.profiles.id; public.employee_roster.updated_by -> public.profiles.id; public.lottery_decisions.superseded_by -> public.profiles.id; public.lottery_history_entries.decision_id -> public.lottery_decisions.id; public.lottery_history_entries.invalidated_by -> public.profiles.id; public.lottery_requests.restored_by -> public.profiles.id; public.lottery_requests.suppressed_by -> public.profiles.id; public.notification_outbox.user_id -> public.profiles.id; public.preliminary_requests.approved_by -> public.profiles.id; public.preliminary_shift_states.active_request_id -> public.preliminary_requests.id; public.preliminary_shift_states.reserved_by -> public.profiles.id; public.profiles.archived_by -> public.profiles.id; public.shift_operational_entry_audit.entry_id -> public.shift_operational_entries.id; public.shift_posts.claimed_by -> public.profiles.id; public.shift_posts.posted_by -> public.profiles.id; public.shift_posts.shift_id -> public.shifts.id; public.shift_posts.swap_shift_id -> public.shifts.id; public.shift_reminder_outbox.shift_id -> public.shifts.id; public.shift_reminder_outbox.user_id -> public.profiles.id; public.shifts.availability_override_by -> public.profiles.id; public.shifts.cycle_id -> public.schedule_cycles.id; public.shifts.status_updated_by -> public.profiles.id; public.shifts.user_id -> public.profiles.id
- UUID defaults are mixed: gen_random_uuid(): 25 columns; uuid_generate_v4(): 4 columns
- schedule_cycles has no catalog CHECK constraint enforcing end_date >= start_date.
- shift_posts has status/type/visibility checks plus lifecycle triggers, but the catalog has no cross-column CHECK tying direct requests to recipient_response or approved posts to claimed_by; that logic depends on trigger/RPC paths.
- Supabase advisors additionally reported public SECURITY DEFINER functions executable by anon/authenticated roles and many unindexed foreign keys; see final response summary.

## Table Inventory

### auth.audit_log_entries

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Audit trail for user actions.

| Column      | Data type                | Nullable | Default               | PK  | Comment |
| ----------- | ------------------------ | :------: | --------------------- | :-: | ------- |
| instance_id | uuid                     |   YES    | -                     |     | -       |
| id          | uuid                     |    NO    | -                     | yes | -       |
| payload     | json                     |   YES    | -                     |     | -       |
| created_at  | timestamp with time zone |   YES    | -                     |     | -       |
| ip_address  | character varying        |    NO    | ''::character varying |     | -       |

Constraints:

- audit_log_entries_pkey [p]: PRIMARY KEY (id)

Indexes:

- audit_log_entries_pkey: CREATE UNIQUE INDEX audit_log_entries_pkey ON auth.audit_log_entries USING btree (id)
- audit_logs_instance_id_idx: CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id)

### auth.custom_oauth_providers

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column                | Data type                | Nullable | Default           | PK  | Comment |
| --------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                    | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| provider_type         | text                     |    NO    | -                 |     | -       |
| identifier            | text                     |    NO    | -                 |     | -       |
| name                  | text                     |    NO    | -                 |     | -       |
| client_id             | text                     |    NO    | -                 |     | -       |
| client_secret         | text                     |    NO    | -                 |     | -       |
| acceptable_client_ids | \_text[]                 |    NO    | '{}'::text[]      |     | -       |
| scopes                | \_text[]                 |    NO    | '{}'::text[]      |     | -       |
| pkce_enabled          | boolean                  |    NO    | true              |     | -       |
| attribute_mapping     | jsonb                    |    NO    | '{}'::jsonb       |     | -       |
| authorization_params  | jsonb                    |    NO    | '{}'::jsonb       |     | -       |
| enabled               | boolean                  |    NO    | true              |     | -       |
| email_optional        | boolean                  |    NO    | false             |     | -       |
| issuer                | text                     |   YES    | -                 |     | -       |
| discovery_url         | text                     |   YES    | -                 |     | -       |
| skip_nonce_check      | boolean                  |    NO    | false             |     | -       |
| cached_discovery      | jsonb                    |   YES    | -                 |     | -       |
| discovery_cached_at   | timestamp with time zone |   YES    | -                 |     | -       |
| authorization_url     | text                     |   YES    | -                 |     | -       |
| token_url             | text                     |   YES    | -                 |     | -       |
| userinfo_url          | text                     |   YES    | -                 |     | -       |
| jwks_uri              | text                     |   YES    | -                 |     | -       |
| created_at            | timestamp with time zone |    NO    | now()             |     | -       |
| updated_at            | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- custom_oauth_providers_authorization_url_https [c]: CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text)))
- custom_oauth_providers_authorization_url_length [c]: CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048)))
- custom_oauth_providers_client_id_length [c]: CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512)))
- custom_oauth_providers_discovery_url_length [c]: CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048)))
- custom_oauth_providers_identifier_format [c]: CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text))
- custom_oauth_providers_issuer_length [c]: CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048))))
- custom_oauth_providers_jwks_uri_https [c]: CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text)))
- custom_oauth_providers_jwks_uri_length [c]: CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048)))
- custom_oauth_providers_name_length [c]: CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100)))
- custom_oauth_providers_oauth2_requires_endpoints [c]: CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL))))
- custom_oauth_providers_oidc_discovery_url_https [c]: CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text)))
- custom_oauth_providers_oidc_issuer_https [c]: CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text)))
- custom_oauth_providers_oidc_requires_issuer [c]: CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL)))
- custom_oauth_providers_provider_type_check [c]: CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text])))
- custom_oauth_providers_token_url_https [c]: CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text)))
- custom_oauth_providers_token_url_length [c]: CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048)))
- custom_oauth_providers_userinfo_url_https [c]: CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text)))
- custom_oauth_providers_userinfo_url_length [c]: CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
- custom_oauth_providers_pkey [p]: PRIMARY KEY (id)
- custom_oauth_providers_identifier_key [u]: UNIQUE (identifier)

Indexes:

- custom_oauth_providers_created_at_idx: CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at)
- custom_oauth_providers_enabled_idx: CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled)
- custom_oauth_providers_identifier_idx: CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier)
- custom_oauth_providers_identifier_key: CREATE UNIQUE INDEX custom_oauth_providers_identifier_key ON auth.custom_oauth_providers USING btree (identifier)
- custom_oauth_providers_pkey: CREATE UNIQUE INDEX custom_oauth_providers_pkey ON auth.custom_oauth_providers USING btree (id)
- custom_oauth_providers_provider_type_idx: CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type)

### auth.flow_state

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Stores metadata for all OAuth/SSO login flows

| Column                 | Data type                  | Nullable | Default | PK  | Comment |
| ---------------------- | -------------------------- | :------: | ------- | :-: | ------- |
| id                     | uuid                       |    NO    | -       | yes | -       |
| user_id                | uuid                       |   YES    | -       |     | -       |
| auth_code              | text                       |   YES    | -       |     | -       |
| code_challenge_method  | auth.code_challenge_method |   YES    | -       |     | -       |
| code_challenge         | text                       |   YES    | -       |     | -       |
| provider_type          | text                       |    NO    | -       |     | -       |
| provider_access_token  | text                       |   YES    | -       |     | -       |
| provider_refresh_token | text                       |   YES    | -       |     | -       |
| created_at             | timestamp with time zone   |   YES    | -       |     | -       |
| updated_at             | timestamp with time zone   |   YES    | -       |     | -       |
| authentication_method  | text                       |    NO    | -       |     | -       |
| auth_code_issued_at    | timestamp with time zone   |   YES    | -       |     | -       |
| invite_token           | text                       |   YES    | -       |     | -       |
| referrer               | text                       |   YES    | -       |     | -       |
| oauth_client_state_id  | uuid                       |   YES    | -       |     | -       |
| linking_target_id      | uuid                       |   YES    | -       |     | -       |
| email_optional         | boolean                    |    NO    | false   |     | -       |

Constraints:

- flow_state_pkey [p]: PRIMARY KEY (id)

Indexes:

- flow_state_created_at_idx: CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC)
- flow_state_pkey: CREATE UNIQUE INDEX flow_state_pkey ON auth.flow_state USING btree (id)
- idx_auth_code: CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code)
- idx_user_id_auth_method: CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method)

### auth.identities

Type: table; RLS: True; Approx rows: 104; Primary key: id
Comment: Auth: Stores identities associated to a user.

| Column          | Data type                | Nullable | Default           | PK  | Comment                                                                                            |
| --------------- | ------------------------ | :------: | ----------------- | :-: | -------------------------------------------------------------------------------------------------- |
| provider_id     | text                     |    NO    | -                 |     | -                                                                                                  |
| user_id         | uuid                     |    NO    | -                 |     | -                                                                                                  |
| identity_data   | jsonb                    |    NO    | -                 |     | -                                                                                                  |
| provider        | text                     |    NO    | -                 |     | -                                                                                                  |
| last_sign_in_at | timestamp with time zone |   YES    | -                 |     | -                                                                                                  |
| created_at      | timestamp with time zone |   YES    | -                 |     | -                                                                                                  |
| updated_at      | timestamp with time zone |   YES    | -                 |     | -                                                                                                  |
| email           | text                     |   YES    | -                 |     | Auth: Email is a generated column that references the optional email property in the identity_data |
| id              | uuid                     |    NO    | gen_random_uuid() | yes | -                                                                                                  |

Constraints:

- identities_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- identities_pkey [p]: PRIMARY KEY (id)
- identities_provider_id_provider_unique [u]: UNIQUE (provider_id, provider)

Indexes:

- identities_email_idx: CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops)
- identities_pkey: CREATE UNIQUE INDEX identities_pkey ON auth.identities USING btree (id)
- identities_provider_id_provider_unique: CREATE UNIQUE INDEX identities_provider_id_provider_unique ON auth.identities USING btree (provider_id, provider)
- identities_user_id_idx: CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id)

### auth.instances

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Manages users across multiple sites.

| Column          | Data type                | Nullable | Default | PK  | Comment |
| --------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id              | uuid                     |    NO    | -       | yes | -       |
| uuid            | uuid                     |   YES    | -       |     | -       |
| raw_base_config | text                     |   YES    | -       |     | -       |
| created_at      | timestamp with time zone |   YES    | -       |     | -       |
| updated_at      | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- instances_pkey [p]: PRIMARY KEY (id)

Indexes:

- instances_pkey: CREATE UNIQUE INDEX instances_pkey ON auth.instances USING btree (id)

### auth.mfa_amr_claims

Type: table; RLS: True; Approx rows: 80; Primary key: id
Comment: auth: stores authenticator method reference claims for multi factor authentication

| Column                | Data type                | Nullable | Default | PK  | Comment |
| --------------------- | ------------------------ | :------: | ------- | :-: | ------- |
| session_id            | uuid                     |    NO    | -       |     | -       |
| created_at            | timestamp with time zone |    NO    | -       |     | -       |
| updated_at            | timestamp with time zone |    NO    | -       |     | -       |
| authentication_method | text                     |    NO    | -       |     | -       |
| id                    | uuid                     |    NO    | -       | yes | -       |

Constraints:

- mfa_amr_claims_session_id_fkey [f]: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
- amr_id_pk [p]: PRIMARY KEY (id)
- mfa_amr_claims_session_id_authentication_method_pkey [u]: UNIQUE (session_id, authentication_method)

Indexes:

- amr_id_pk: CREATE UNIQUE INDEX amr_id_pk ON auth.mfa_amr_claims USING btree (id)
- mfa_amr_claims_session_id_authentication_method_pkey: CREATE UNIQUE INDEX mfa_amr_claims_session_id_authentication_method_pkey ON auth.mfa_amr_claims USING btree (session_id, authentication_method)

### auth.mfa_challenges

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: auth: stores metadata about challenge requests made

| Column                 | Data type                | Nullable | Default | PK  | Comment |
| ---------------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id                     | uuid                     |    NO    | -       | yes | -       |
| factor_id              | uuid                     |    NO    | -       |     | -       |
| created_at             | timestamp with time zone |    NO    | -       |     | -       |
| verified_at            | timestamp with time zone |   YES    | -       |     | -       |
| ip_address             | inet                     |    NO    | -       |     | -       |
| otp_code               | text                     |   YES    | -       |     | -       |
| web_authn_session_data | jsonb                    |   YES    | -       |     | -       |

Constraints:

- mfa_challenges_auth_factor_id_fkey [f]: FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE
- mfa_challenges_pkey [p]: PRIMARY KEY (id)

Indexes:

- mfa_challenge_created_at_idx: CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC)
- mfa_challenges_pkey: CREATE UNIQUE INDEX mfa_challenges_pkey ON auth.mfa_challenges USING btree (id)

### auth.mfa_factors

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: auth: stores metadata about factors

| Column                       | Data type                | Nullable | Default | PK  | Comment                                                                                             |
| ---------------------------- | ------------------------ | :------: | ------- | :-: | --------------------------------------------------------------------------------------------------- |
| id                           | uuid                     |    NO    | -       | yes | -                                                                                                   |
| user_id                      | uuid                     |    NO    | -       |     | -                                                                                                   |
| friendly_name                | text                     |   YES    | -       |     | -                                                                                                   |
| factor_type                  | auth.factor_type         |    NO    | -       |     | -                                                                                                   |
| status                       | auth.factor_status       |    NO    | -       |     | -                                                                                                   |
| created_at                   | timestamp with time zone |    NO    | -       |     | -                                                                                                   |
| updated_at                   | timestamp with time zone |    NO    | -       |     | -                                                                                                   |
| secret                       | text                     |   YES    | -       |     | -                                                                                                   |
| phone                        | text                     |   YES    | -       |     | -                                                                                                   |
| last_challenged_at           | timestamp with time zone |   YES    | -       |     | -                                                                                                   |
| web_authn_credential         | jsonb                    |   YES    | -       |     | -                                                                                                   |
| web_authn_aaguid             | uuid                     |   YES    | -       |     | -                                                                                                   |
| last_webauthn_challenge_data | jsonb                    |   YES    | -       |     | Stores the latest WebAuthn challenge data including attestation/assertion for customer verification |

Constraints:

- mfa_factors_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- mfa_factors_pkey [p]: PRIMARY KEY (id)
- mfa_factors_last_challenged_at_key [u]: UNIQUE (last_challenged_at)

Indexes:

- factor_id_created_at_idx: CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at)
- mfa_factors_last_challenged_at_key: CREATE UNIQUE INDEX mfa_factors_last_challenged_at_key ON auth.mfa_factors USING btree (last_challenged_at)
- mfa_factors_pkey: CREATE UNIQUE INDEX mfa_factors_pkey ON auth.mfa_factors USING btree (id)
- mfa_factors_user_friendly_name_unique: CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text)
- mfa_factors_user_id_idx: CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id)
- unique_phone_factor_per_user: CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone)

### auth.oauth_authorizations

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column                | Data type                       | Nullable | Default                                    | PK  | Comment |
| --------------------- | ------------------------------- | :------: | ------------------------------------------ | :-: | ------- |
| id                    | uuid                            |    NO    | -                                          | yes | -       |
| authorization_id      | text                            |    NO    | -                                          |     | -       |
| client_id             | uuid                            |    NO    | -                                          |     | -       |
| user_id               | uuid                            |   YES    | -                                          |     | -       |
| redirect_uri          | text                            |    NO    | -                                          |     | -       |
| scope                 | text                            |    NO    | -                                          |     | -       |
| state                 | text                            |   YES    | -                                          |     | -       |
| resource              | text                            |   YES    | -                                          |     | -       |
| code_challenge        | text                            |   YES    | -                                          |     | -       |
| code_challenge_method | auth.code_challenge_method      |   YES    | -                                          |     | -       |
| response_type         | auth.oauth_response_type        |    NO    | 'code'::auth.oauth_response_type           |     | -       |
| status                | auth.oauth_authorization_status |    NO    | 'pending'::auth.oauth_authorization_status |     | -       |
| authorization_code    | text                            |   YES    | -                                          |     | -       |
| created_at            | timestamp with time zone        |    NO    | now()                                      |     | -       |
| expires_at            | timestamp with time zone        |    NO    | (now() + '00:03:00'::interval)             |     | -       |
| approved_at           | timestamp with time zone        |   YES    | -                                          |     | -       |
| nonce                 | text                            |   YES    | -                                          |     | -       |

Constraints:

- oauth_authorizations_authorization_code_length [c]: CHECK ((char_length(authorization_code) <= 255))
- oauth_authorizations_code_challenge_length [c]: CHECK ((char_length(code_challenge) <= 128))
- oauth_authorizations_expires_at_future [c]: CHECK ((expires_at > created_at))
- oauth_authorizations_nonce_length [c]: CHECK ((char_length(nonce) <= 255))
- oauth_authorizations_redirect_uri_length [c]: CHECK ((char_length(redirect_uri) <= 2048))
- oauth_authorizations_resource_length [c]: CHECK ((char_length(resource) <= 2048))
- oauth_authorizations_scope_length [c]: CHECK ((char_length(scope) <= 4096))
- oauth_authorizations_state_length [c]: CHECK ((char_length(state) <= 4096))
- oauth_authorizations_client_id_fkey [f]: FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE
- oauth_authorizations_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- oauth_authorizations_pkey [p]: PRIMARY KEY (id)
- oauth_authorizations_authorization_code_key [u]: UNIQUE (authorization_code)
- oauth_authorizations_authorization_id_key [u]: UNIQUE (authorization_id)

Indexes:

- oauth_auth_pending_exp_idx: CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status)
- oauth_authorizations_authorization_code_key: CREATE UNIQUE INDEX oauth_authorizations_authorization_code_key ON auth.oauth_authorizations USING btree (authorization_code)
- oauth_authorizations_authorization_id_key: CREATE UNIQUE INDEX oauth_authorizations_authorization_id_key ON auth.oauth_authorizations USING btree (authorization_id)
- oauth_authorizations_pkey: CREATE UNIQUE INDEX oauth_authorizations_pkey ON auth.oauth_authorizations USING btree (id)

### auth.oauth_client_states

Type: table; RLS: False; Approx rows: 0; Primary key: id
Comment: Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.

| Column        | Data type                | Nullable | Default | PK  | Comment |
| ------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id            | uuid                     |    NO    | -       | yes | -       |
| provider_type | text                     |    NO    | -       |     | -       |
| code_verifier | text                     |   YES    | -       |     | -       |
| created_at    | timestamp with time zone |    NO    | -       |     | -       |

Constraints:

- oauth_client_states_pkey [p]: PRIMARY KEY (id)

Indexes:

- idx_oauth_client_states_created_at: CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at)
- oauth_client_states_pkey: CREATE UNIQUE INDEX oauth_client_states_pkey ON auth.oauth_client_states USING btree (id)

### auth.oauth_clients

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column                     | Data type                    | Nullable | Default                                | PK  | Comment |
| -------------------------- | ---------------------------- | :------: | -------------------------------------- | :-: | ------- |
| id                         | uuid                         |    NO    | -                                      | yes | -       |
| client_secret_hash         | text                         |   YES    | -                                      |     | -       |
| registration_type          | auth.oauth_registration_type |    NO    | -                                      |     | -       |
| redirect_uris              | text                         |    NO    | -                                      |     | -       |
| grant_types                | text                         |    NO    | -                                      |     | -       |
| client_name                | text                         |   YES    | -                                      |     | -       |
| client_uri                 | text                         |   YES    | -                                      |     | -       |
| logo_uri                   | text                         |   YES    | -                                      |     | -       |
| created_at                 | timestamp with time zone     |    NO    | now()                                  |     | -       |
| updated_at                 | timestamp with time zone     |    NO    | now()                                  |     | -       |
| deleted_at                 | timestamp with time zone     |   YES    | -                                      |     | -       |
| client_type                | auth.oauth_client_type       |    NO    | 'confidential'::auth.oauth_client_type |     | -       |
| token_endpoint_auth_method | text                         |    NO    | -                                      |     | -       |

Constraints:

- oauth_clients_client_name_length [c]: CHECK ((char_length(client_name) <= 1024))
- oauth_clients_client_uri_length [c]: CHECK ((char_length(client_uri) <= 2048))
- oauth_clients_logo_uri_length [c]: CHECK ((char_length(logo_uri) <= 2048))
- oauth_clients_token_endpoint_auth_method_check [c]: CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
- oauth_clients_pkey [p]: PRIMARY KEY (id)

Indexes:

- oauth_clients_deleted_at_idx: CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at)
- oauth_clients_pkey: CREATE UNIQUE INDEX oauth_clients_pkey ON auth.oauth_clients USING btree (id)

### auth.oauth_consents

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column     | Data type                | Nullable | Default | PK  | Comment |
| ---------- | ------------------------ | :------: | ------- | :-: | ------- |
| id         | uuid                     |    NO    | -       | yes | -       |
| user_id    | uuid                     |    NO    | -       |     | -       |
| client_id  | uuid                     |    NO    | -       |     | -       |
| scopes     | text                     |    NO    | -       |     | -       |
| granted_at | timestamp with time zone |    NO    | now()   |     | -       |
| revoked_at | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- oauth_consents_revoked_after_granted [c]: CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at)))
- oauth_consents_scopes_length [c]: CHECK ((char_length(scopes) <= 2048))
- oauth_consents_scopes_not_empty [c]: CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
- oauth_consents_client_id_fkey [f]: FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE
- oauth_consents_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- oauth_consents_pkey [p]: PRIMARY KEY (id)
- oauth_consents_user_client_unique [u]: UNIQUE (user_id, client_id)

Indexes:

- oauth_consents_active_client_idx: CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL)
- oauth_consents_active_user_client_idx: CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL)
- oauth_consents_pkey: CREATE UNIQUE INDEX oauth_consents_pkey ON auth.oauth_consents USING btree (id)
- oauth_consents_user_client_unique: CREATE UNIQUE INDEX oauth_consents_user_client_unique ON auth.oauth_consents USING btree (user_id, client_id)
- oauth_consents_user_order_idx: CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC)

### auth.one_time_tokens

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column     | Data type                   | Nullable | Default | PK  | Comment |
| ---------- | --------------------------- | :------: | ------- | :-: | ------- |
| id         | uuid                        |    NO    | -       | yes | -       |
| user_id    | uuid                        |    NO    | -       |     | -       |
| token_type | auth.one_time_token_type    |    NO    | -       |     | -       |
| token_hash | text                        |    NO    | -       |     | -       |
| relates_to | text                        |    NO    | -       |     | -       |
| created_at | timestamp without time zone |    NO    | now()   |     | -       |
| updated_at | timestamp without time zone |    NO    | now()   |     | -       |

Constraints:

- one_time_tokens_token_hash_check [c]: CHECK ((char_length(token_hash) > 0))
- one_time_tokens_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- one_time_tokens_pkey [p]: PRIMARY KEY (id)

Indexes:

- one_time_tokens_pkey: CREATE UNIQUE INDEX one_time_tokens_pkey ON auth.one_time_tokens USING btree (id)
- one_time_tokens_relates_to_hash_idx: CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to)
- one_time_tokens_token_hash_hash_idx: CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash)
- one_time_tokens_user_id_token_type_key: CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type)

### auth.refresh_tokens

Type: table; RLS: True; Approx rows: 93; Primary key: id
Comment: Auth: Store of tokens used to refresh JWT tokens once they expire.

| Column      | Data type                | Nullable | Default                                         | PK  | Comment |
| ----------- | ------------------------ | :------: | ----------------------------------------------- | :-: | ------- |
| instance_id | uuid                     |   YES    | -                                               |     | -       |
| id          | bigint                   |    NO    | nextval('auth.refresh_tokens_id_seq'::regclass) | yes | -       |
| token       | character varying        |   YES    | -                                               |     | -       |
| user_id     | character varying        |   YES    | -                                               |     | -       |
| revoked     | boolean                  |   YES    | -                                               |     | -       |
| created_at  | timestamp with time zone |   YES    | -                                               |     | -       |
| updated_at  | timestamp with time zone |   YES    | -                                               |     | -       |
| parent      | character varying        |   YES    | -                                               |     | -       |
| session_id  | uuid                     |   YES    | -                                               |     | -       |

Constraints:

- refresh_tokens_session_id_fkey [f]: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
- refresh_tokens_pkey [p]: PRIMARY KEY (id)
- refresh_tokens_token_unique [u]: UNIQUE (token)

Indexes:

- refresh_tokens_instance_id_idx: CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id)
- refresh_tokens_instance_id_user_id_idx: CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id)
- refresh_tokens_parent_idx: CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent)
- refresh_tokens_pkey: CREATE UNIQUE INDEX refresh_tokens_pkey ON auth.refresh_tokens USING btree (id)
- refresh_tokens_session_id_revoked_idx: CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked)
- refresh_tokens_token_unique: CREATE UNIQUE INDEX refresh_tokens_token_unique ON auth.refresh_tokens USING btree (token)
- refresh_tokens_updated_at_idx: CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC)

### auth.saml_providers

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Manages SAML Identity Provider connections.

| Column            | Data type                | Nullable | Default | PK  | Comment |
| ----------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id                | uuid                     |    NO    | -       | yes | -       |
| sso_provider_id   | uuid                     |    NO    | -       |     | -       |
| entity_id         | text                     |    NO    | -       |     | -       |
| metadata_xml      | text                     |    NO    | -       |     | -       |
| metadata_url      | text                     |   YES    | -       |     | -       |
| attribute_mapping | jsonb                    |   YES    | -       |     | -       |
| created_at        | timestamp with time zone |   YES    | -       |     | -       |
| updated_at        | timestamp with time zone |   YES    | -       |     | -       |
| name_id_format    | text                     |   YES    | -       |     | -       |

Constraints:

- entity_id not empty [c]: CHECK ((char_length(entity_id) > 0))
- metadata_url not empty [c]: CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0)))
- metadata_xml not empty [c]: CHECK ((char_length(metadata_xml) > 0))
- saml_providers_sso_provider_id_fkey [f]: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
- saml_providers_pkey [p]: PRIMARY KEY (id)
- saml_providers_entity_id_key [u]: UNIQUE (entity_id)

Indexes:

- saml_providers_entity_id_key: CREATE UNIQUE INDEX saml_providers_entity_id_key ON auth.saml_providers USING btree (entity_id)
- saml_providers_pkey: CREATE UNIQUE INDEX saml_providers_pkey ON auth.saml_providers USING btree (id)
- saml_providers_sso_provider_id_idx: CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id)

### auth.saml_relay_states

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Contains SAML Relay State information for each Service Provider initiated login.

| Column          | Data type                | Nullable | Default | PK  | Comment |
| --------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id              | uuid                     |    NO    | -       | yes | -       |
| sso_provider_id | uuid                     |    NO    | -       |     | -       |
| request_id      | text                     |    NO    | -       |     | -       |
| for_email       | text                     |   YES    | -       |     | -       |
| redirect_to     | text                     |   YES    | -       |     | -       |
| created_at      | timestamp with time zone |   YES    | -       |     | -       |
| updated_at      | timestamp with time zone |   YES    | -       |     | -       |
| flow_state_id   | uuid                     |   YES    | -       |     | -       |

Constraints:

- request_id not empty [c]: CHECK ((char_length(request_id) > 0))
- saml_relay_states_flow_state_id_fkey [f]: FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE
- saml_relay_states_sso_provider_id_fkey [f]: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
- saml_relay_states_pkey [p]: PRIMARY KEY (id)

Indexes:

- saml_relay_states_created_at_idx: CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC)
- saml_relay_states_for_email_idx: CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email)
- saml_relay_states_pkey: CREATE UNIQUE INDEX saml_relay_states_pkey ON auth.saml_relay_states USING btree (id)
- saml_relay_states_sso_provider_id_idx: CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id)

### auth.schema_migrations

Type: table; RLS: True; Approx rows: 76; Primary key: version
Comment: Auth: Manages updates to the auth system.

| Column  | Data type         | Nullable | Default | PK  | Comment |
| ------- | ----------------- | :------: | ------- | :-: | ------- |
| version | character varying |    NO    | -       | yes | -       |

Constraints:

- schema_migrations_pkey [p]: PRIMARY KEY (version)

Indexes:

- schema_migrations_pkey: CREATE UNIQUE INDEX schema_migrations_pkey ON auth.schema_migrations USING btree (version)

### auth.sessions

Type: table; RLS: True; Approx rows: 80; Primary key: id
Comment: Auth: Stores session data associated to a user.

| Column                 | Data type                   | Nullable | Default | PK  | Comment                                                                                                               |
| ---------------------- | --------------------------- | :------: | ------- | :-: | --------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid                        |    NO    | -       | yes | -                                                                                                                     |
| user_id                | uuid                        |    NO    | -       |     | -                                                                                                                     |
| created_at             | timestamp with time zone    |   YES    | -       |     | -                                                                                                                     |
| updated_at             | timestamp with time zone    |   YES    | -       |     | -                                                                                                                     |
| factor_id              | uuid                        |   YES    | -       |     | -                                                                                                                     |
| aal                    | auth.aal_level              |   YES    | -       |     | -                                                                                                                     |
| not_after              | timestamp with time zone    |   YES    | -       |     | Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired. |
| refreshed_at           | timestamp without time zone |   YES    | -       |     | -                                                                                                                     |
| user_agent             | text                        |   YES    | -       |     | -                                                                                                                     |
| ip                     | inet                        |   YES    | -       |     | -                                                                                                                     |
| tag                    | text                        |   YES    | -       |     | -                                                                                                                     |
| oauth_client_id        | uuid                        |   YES    | -       |     | -                                                                                                                     |
| refresh_token_hmac_key | text                        |   YES    | -       |     | Holds a HMAC-SHA256 key used to sign refresh tokens for this session.                                                 |
| refresh_token_counter  | bigint                      |   YES    | -       |     | Holds the ID (counter) of the last issued refresh token.                                                              |
| scopes                 | text                        |   YES    | -       |     | -                                                                                                                     |

Constraints:

- sessions_scopes_length [c]: CHECK ((char_length(scopes) <= 4096))
- sessions_oauth_client_id_fkey [f]: FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE
- sessions_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- sessions_pkey [p]: PRIMARY KEY (id)

Indexes:

- sessions_not_after_idx: CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC)
- sessions_oauth_client_id_idx: CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id)
- sessions_pkey: CREATE UNIQUE INDEX sessions_pkey ON auth.sessions USING btree (id)
- sessions_user_id_idx: CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id)
- user_id_created_at_idx: CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at)

### auth.sso_domains

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Manages SSO email address domain mapping to an SSO Identity Provider.

| Column          | Data type                | Nullable | Default | PK  | Comment |
| --------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id              | uuid                     |    NO    | -       | yes | -       |
| sso_provider_id | uuid                     |    NO    | -       |     | -       |
| domain          | text                     |    NO    | -       |     | -       |
| created_at      | timestamp with time zone |   YES    | -       |     | -       |
| updated_at      | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- domain not empty [c]: CHECK ((char_length(domain) > 0))
- sso_domains_sso_provider_id_fkey [f]: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
- sso_domains_pkey [p]: PRIMARY KEY (id)

Indexes:

- sso_domains_domain_idx: CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain))
- sso_domains_pkey: CREATE UNIQUE INDEX sso_domains_pkey ON auth.sso_domains USING btree (id)
- sso_domains_sso_provider_id_idx: CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id)

### auth.sso_providers

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Auth: Manages SSO identity provider information; see saml_providers for SAML.

| Column      | Data type                | Nullable | Default | PK  | Comment                                                                                                                               |
| ----------- | ------------------------ | :------: | ------- | :-: | ------------------------------------------------------------------------------------------------------------------------------------- |
| id          | uuid                     |    NO    | -       | yes | -                                                                                                                                     |
| resource_id | text                     |   YES    | -       |     | Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code. |
| created_at  | timestamp with time zone |   YES    | -       |     | -                                                                                                                                     |
| updated_at  | timestamp with time zone |   YES    | -       |     | -                                                                                                                                     |
| disabled    | boolean                  |   YES    | -       |     | -                                                                                                                                     |

Constraints:

- resource_id not empty [c]: CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
- sso_providers_pkey [p]: PRIMARY KEY (id)

Indexes:

- sso_providers_pkey: CREATE UNIQUE INDEX sso_providers_pkey ON auth.sso_providers USING btree (id)
- sso_providers_resource_id_idx: CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id))
- sso_providers_resource_id_pattern_idx: CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops)

### auth.users

Type: table; RLS: True; Approx rows: 101; Primary key: id
Comment: Auth: Stores user login data within a secure schema.

| Column                      | Data type                | Nullable | Default                 | PK  | Comment                                                                                                  |
| --------------------------- | ------------------------ | :------: | ----------------------- | :-: | -------------------------------------------------------------------------------------------------------- |
| instance_id                 | uuid                     |   YES    | -                       |     | -                                                                                                        |
| id                          | uuid                     |    NO    | -                       | yes | -                                                                                                        |
| aud                         | character varying        |   YES    | -                       |     | -                                                                                                        |
| role                        | character varying        |   YES    | -                       |     | -                                                                                                        |
| email                       | character varying        |   YES    | -                       |     | -                                                                                                        |
| encrypted_password          | character varying        |   YES    | -                       |     | -                                                                                                        |
| email_confirmed_at          | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| invited_at                  | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| confirmation_token          | character varying        |   YES    | -                       |     | -                                                                                                        |
| confirmation_sent_at        | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| recovery_token              | character varying        |   YES    | -                       |     | -                                                                                                        |
| recovery_sent_at            | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| email_change_token_new      | character varying        |   YES    | -                       |     | -                                                                                                        |
| email_change                | character varying        |   YES    | -                       |     | -                                                                                                        |
| email_change_sent_at        | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| last_sign_in_at             | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| raw_app_meta_data           | jsonb                    |   YES    | -                       |     | -                                                                                                        |
| raw_user_meta_data          | jsonb                    |   YES    | -                       |     | -                                                                                                        |
| is_super_admin              | boolean                  |   YES    | -                       |     | -                                                                                                        |
| created_at                  | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| updated_at                  | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| phone                       | text                     |   YES    | NULL::character varying |     | -                                                                                                        |
| phone_confirmed_at          | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| phone_change                | text                     |   YES    | ''::character varying   |     | -                                                                                                        |
| phone_change_token          | character varying        |   YES    | ''::character varying   |     | -                                                                                                        |
| phone_change_sent_at        | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| confirmed_at                | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| email_change_token_current  | character varying        |   YES    | ''::character varying   |     | -                                                                                                        |
| email_change_confirm_status | smallint                 |   YES    | 0                       |     | -                                                                                                        |
| banned_until                | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| reauthentication_token      | character varying        |   YES    | ''::character varying   |     | -                                                                                                        |
| reauthentication_sent_at    | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| is_sso_user                 | boolean                  |    NO    | false                   |     | Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails. |
| deleted_at                  | timestamp with time zone |   YES    | -                       |     | -                                                                                                        |
| is_anonymous                | boolean                  |    NO    | false                   |     | -                                                                                                        |

Constraints:

- users_email_change_confirm_status_check [c]: CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
- users_pkey [p]: PRIMARY KEY (id)
- users_phone_key [u]: UNIQUE (phone)

Indexes:

- confirmation_token_idx: CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]\*$'::text)
- email_change_token_current_idx: CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]\*$'::text)
- email_change_token_new_idx: CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]\*$'::text)
- reauthentication_token_idx: CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]\*$'::text)
- recovery_token_idx: CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]\*$'::text)
- users_email_partial_key: CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false)
- users_instance_id_email_idx: CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text))
- users_instance_id_idx: CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id)
- users_is_anonymous_idx: CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous)
- users_phone_key: CREATE UNIQUE INDEX users_phone_key ON auth.users USING btree (phone)
- users_pkey: CREATE UNIQUE INDEX users_pkey ON auth.users USING btree (id)

### auth.webauthn_challenges

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column         | Data type                | Nullable | Default           | PK  | Comment |
| -------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id             | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| user_id        | uuid                     |   YES    | -                 |     | -       |
| challenge_type | text                     |    NO    | -                 |     | -       |
| session_data   | jsonb                    |    NO    | -                 |     | -       |
| created_at     | timestamp with time zone |    NO    | now()             |     | -       |
| expires_at     | timestamp with time zone |    NO    | -                 |     | -       |

Constraints:

- webauthn_challenges_challenge_type_check [c]: CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
- webauthn_challenges_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- webauthn_challenges_pkey [p]: PRIMARY KEY (id)

Indexes:

- webauthn_challenges_expires_at_idx: CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at)
- webauthn_challenges_pkey: CREATE UNIQUE INDEX webauthn_challenges_pkey ON auth.webauthn_challenges USING btree (id)
- webauthn_challenges_user_id_idx: CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id)

### auth.webauthn_credentials

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column           | Data type                | Nullable | Default           | PK  | Comment |
| ---------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id               | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| user_id          | uuid                     |    NO    | -                 |     | -       |
| credential_id    | bytea                    |    NO    | -                 |     | -       |
| public_key       | bytea                    |    NO    | -                 |     | -       |
| attestation_type | text                     |    NO    | ''::text          |     | -       |
| aaguid           | uuid                     |   YES    | -                 |     | -       |
| sign_count       | bigint                   |    NO    | 0                 |     | -       |
| transports       | jsonb                    |    NO    | '[]'::jsonb       |     | -       |
| backup_eligible  | boolean                  |    NO    | false             |     | -       |
| backed_up        | boolean                  |    NO    | false             |     | -       |
| friendly_name    | text                     |    NO    | ''::text          |     | -       |
| created_at       | timestamp with time zone |    NO    | now()             |     | -       |
| updated_at       | timestamp with time zone |    NO    | now()             |     | -       |
| last_used_at     | timestamp with time zone |   YES    | -                 |     | -       |

Constraints:

- webauthn_credentials_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- webauthn_credentials_pkey [p]: PRIMARY KEY (id)

Indexes:

- webauthn_credentials_credential_id_key: CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id)
- webauthn_credentials_pkey: CREATE UNIQUE INDEX webauthn_credentials_pkey ON auth.webauthn_credentials USING btree (id)
- webauthn_credentials_user_id_idx: CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id)

### cron.job

Type: table; RLS: True; Approx rows: 1; Primary key: jobid

| Column   | Data type | Nullable | Default                             | PK  | Comment |
| -------- | --------- | :------: | ----------------------------------- | :-: | ------- |
| jobid    | bigint    |    NO    | nextval('cron.jobid_seq'::regclass) | yes | -       |
| schedule | text      |    NO    | -                                   |     | -       |
| command  | text      |    NO    | -                                   |     | -       |
| nodename | text      |    NO    | 'localhost'::text                   |     | -       |
| nodeport | integer   |    NO    | inet_server_port()                  |     | -       |
| database | text      |    NO    | current_database()                  |     | -       |
| username | text      |    NO    | CURRENT_USER                        |     | -       |
| active   | boolean   |    NO    | true                                |     | -       |
| jobname  | text      |   YES    | -                                   |     | -       |

Constraints:

- job_pkey [p]: PRIMARY KEY (jobid)
- jobname_username_uniq [u]: UNIQUE (jobname, username)

Indexes:

- job_pkey: CREATE UNIQUE INDEX job_pkey ON cron.job USING btree (jobid)
- jobname_username_uniq: CREATE UNIQUE INDEX jobname_username_uniq ON cron.job USING btree (jobname, username)

RLS policies:

- cron_job_policy [ALL, PERMISSIVE, roles={public}]: using=(username = CURRENT_USER); check=-

### cron.job_run_details

Type: table; RLS: True; Approx rows: 0; Primary key: runid

| Column         | Data type                | Nullable | Default                             | PK  | Comment |
| -------------- | ------------------------ | :------: | ----------------------------------- | :-: | ------- |
| jobid          | bigint                   |   YES    | -                                   |     | -       |
| runid          | bigint                   |    NO    | nextval('cron.runid_seq'::regclass) | yes | -       |
| job_pid        | integer                  |   YES    | -                                   |     | -       |
| database       | text                     |   YES    | -                                   |     | -       |
| username       | text                     |   YES    | -                                   |     | -       |
| command        | text                     |   YES    | -                                   |     | -       |
| status         | text                     |   YES    | -                                   |     | -       |
| return_message | text                     |   YES    | -                                   |     | -       |
| start_time     | timestamp with time zone |   YES    | -                                   |     | -       |
| end_time       | timestamp with time zone |   YES    | -                                   |     | -       |

Constraints:

- job_run_details_pkey [p]: PRIMARY KEY (runid)

Indexes:

- job_run_details_pkey: CREATE UNIQUE INDEX job_run_details_pkey ON cron.job_run_details USING btree (runid)

RLS policies:

- cron_job_run_details_policy [ALL, PERMISSIVE, roles={public}]: using=(username = CURRENT_USER); check=-

### extensions.pg_stat_statements

Type: view; RLS: False; Approx rows: -1; Primary key: none

| Column                 | Data type                | Nullable | Default | PK  | Comment |
| ---------------------- | ------------------------ | :------: | ------- | :-: | ------- |
| userid                 | oid                      |   YES    | -       |     | -       |
| dbid                   | oid                      |   YES    | -       |     | -       |
| toplevel               | boolean                  |   YES    | -       |     | -       |
| queryid                | bigint                   |   YES    | -       |     | -       |
| query                  | text                     |   YES    | -       |     | -       |
| plans                  | bigint                   |   YES    | -       |     | -       |
| total_plan_time        | double precision         |   YES    | -       |     | -       |
| min_plan_time          | double precision         |   YES    | -       |     | -       |
| max_plan_time          | double precision         |   YES    | -       |     | -       |
| mean_plan_time         | double precision         |   YES    | -       |     | -       |
| stddev_plan_time       | double precision         |   YES    | -       |     | -       |
| calls                  | bigint                   |   YES    | -       |     | -       |
| total_exec_time        | double precision         |   YES    | -       |     | -       |
| min_exec_time          | double precision         |   YES    | -       |     | -       |
| max_exec_time          | double precision         |   YES    | -       |     | -       |
| mean_exec_time         | double precision         |   YES    | -       |     | -       |
| stddev_exec_time       | double precision         |   YES    | -       |     | -       |
| rows                   | bigint                   |   YES    | -       |     | -       |
| shared_blks_hit        | bigint                   |   YES    | -       |     | -       |
| shared_blks_read       | bigint                   |   YES    | -       |     | -       |
| shared_blks_dirtied    | bigint                   |   YES    | -       |     | -       |
| shared_blks_written    | bigint                   |   YES    | -       |     | -       |
| local_blks_hit         | bigint                   |   YES    | -       |     | -       |
| local_blks_read        | bigint                   |   YES    | -       |     | -       |
| local_blks_dirtied     | bigint                   |   YES    | -       |     | -       |
| local_blks_written     | bigint                   |   YES    | -       |     | -       |
| temp_blks_read         | bigint                   |   YES    | -       |     | -       |
| temp_blks_written      | bigint                   |   YES    | -       |     | -       |
| shared_blk_read_time   | double precision         |   YES    | -       |     | -       |
| shared_blk_write_time  | double precision         |   YES    | -       |     | -       |
| local_blk_read_time    | double precision         |   YES    | -       |     | -       |
| local_blk_write_time   | double precision         |   YES    | -       |     | -       |
| temp_blk_read_time     | double precision         |   YES    | -       |     | -       |
| temp_blk_write_time    | double precision         |   YES    | -       |     | -       |
| wal_records            | bigint                   |   YES    | -       |     | -       |
| wal_fpi                | bigint                   |   YES    | -       |     | -       |
| wal_bytes              | numeric                  |   YES    | -       |     | -       |
| jit_functions          | bigint                   |   YES    | -       |     | -       |
| jit_generation_time    | double precision         |   YES    | -       |     | -       |
| jit_inlining_count     | bigint                   |   YES    | -       |     | -       |
| jit_inlining_time      | double precision         |   YES    | -       |     | -       |
| jit_optimization_count | bigint                   |   YES    | -       |     | -       |
| jit_optimization_time  | double precision         |   YES    | -       |     | -       |
| jit_emission_count     | bigint                   |   YES    | -       |     | -       |
| jit_emission_time      | double precision         |   YES    | -       |     | -       |
| jit_deform_count       | bigint                   |   YES    | -       |     | -       |
| jit_deform_time        | double precision         |   YES    | -       |     | -       |
| stats_since            | timestamp with time zone |   YES    | -       |     | -       |
| minmax_stats_since     | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- []: -

Indexes:

- : -

### extensions.pg_stat_statements_info

Type: view; RLS: False; Approx rows: -1; Primary key: none

| Column      | Data type                | Nullable | Default | PK  | Comment |
| ----------- | ------------------------ | :------: | ------- | :-: | ------- |
| dealloc     | bigint                   |   YES    | -       |     | -       |
| stats_reset | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- []: -

Indexes:

- : -

### public.audit_log

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Append-only audit history. Authenticated clients may read or insert only through manager-scoped RLS and cannot update or delete rows.

| Column      | Data type                | Nullable | Default           | PK  | Comment |
| ----------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id          | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| user_id     | uuid                     |    NO    | -                 |     | -       |
| action      | text                     |    NO    | -                 |     | -       |
| target_type | text                     |    NO    | -                 |     | -       |
| target_id   | text                     |    NO    | -                 |     | -       |
| created_at  | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- audit_log_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
- audit_log_pkey [p]: PRIMARY KEY (id)

Indexes:

- audit_log_created_at_idx: CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC)
- audit_log_pkey: CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id)
- audit_log_user_created_at_idx: CREATE INDEX audit_log_user_created_at_idx ON public.audit_log USING btree (user_id, created_at DESC)

RLS policies:

- Managers can insert audit log [INSERT, PERMISSIVE, roles={public}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text))))
- Managers can read audit log [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text)))); check=-

### public.availability_email_attachments

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column                 | Data type                | Nullable | Default           | PK  | Comment |
| ---------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                     | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| intake_id              | uuid                     |    NO    | -                 |     | -       |
| provider_attachment_id | text                     |    NO    | -                 |     | -       |
| filename               | text                     |    NO    | -                 |     | -       |
| content_type           | text                     |    NO    | -                 |     | -       |
| content_disposition    | text                     |   YES    | -                 |     | -       |
| size_bytes             | integer                  |   YES    | -                 |     | -       |
| content_base64         | text                     |   YES    | -                 |     | -       |
| download_status        | text                     |    NO    | 'stored'::text    |     | -       |
| download_error         | text                     |   YES    | -                 |     | -       |
| created_at             | timestamp with time zone |    NO    | now()             |     | -       |
| ocr_status             | text                     |    NO    | 'not_run'::text   |     | -       |
| ocr_text               | text                     |   YES    | -                 |     | -       |
| ocr_model              | text                     |   YES    | -                 |     | -       |
| ocr_error              | text                     |   YES    | -                 |     | -       |

Constraints:

- availability_email_attachments_download_status_check [c]: CHECK ((download_status = ANY (ARRAY['stored'::text, 'skipped'::text, 'failed'::text])))
- availability_email_attachments_ocr_status_check [c]: CHECK ((ocr_status = ANY (ARRAY['not_run'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
- availability_email_attachments_intake_id_fkey [f]: FOREIGN KEY (intake_id) REFERENCES availability_email_intakes(id) ON DELETE CASCADE
- availability_email_attachments_pkey [p]: PRIMARY KEY (id)
- availability_email_attachments_provider_attachment_id_key [u]: UNIQUE (provider_attachment_id)

Indexes:

- availability_email_attachments_intake_idx: CREATE INDEX availability_email_attachments_intake_idx ON public.availability_email_attachments USING btree (intake_id)
- availability_email_attachments_pkey: CREATE UNIQUE INDEX availability_email_attachments_pkey ON public.availability_email_attachments USING btree (id)
- availability_email_attachments_provider_attachment_id_key: CREATE UNIQUE INDEX availability_email_attachments_provider_attachment_id_key ON public.availability_email_attachments USING btree (provider_attachment_id)

RLS policies:

- Managers and leads can read all availability email attachments [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles p<br> WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'lead'::text]))))); check=-
- Managers can modify availability email attachments [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()

### public.availability_email_intake_items

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column                    | Data type                | Nullable | Default              | PK  | Comment |
| ------------------------- | ------------------------ | :------: | -------------------- | :-: | ------- |
| id                        | uuid                     |    NO    | gen_random_uuid()    | yes | -       |
| intake_id                 | uuid                     |    NO    | -                    |     | -       |
| source_type               | text                     |    NO    | -                    |     | -       |
| source_label              | text                     |    NO    | -                    |     | -       |
| attachment_id             | uuid                     |   YES    | -                    |     | -       |
| raw_text                  | text                     |   YES    | -                    |     | -       |
| ocr_status                | text                     |    NO    | 'not_run'::text      |     | -       |
| ocr_model                 | text                     |   YES    | -                    |     | -       |
| ocr_error                 | text                     |   YES    | -                    |     | -       |
| parse_status              | text                     |    NO    | 'needs_review'::text |     | -       |
| confidence_level          | text                     |    NO    | 'low'::text          |     | -       |
| confidence_reasons        | jsonb                    |    NO    | '[]'::jsonb          |     | -       |
| extracted_employee_name   | text                     |   YES    | -                    |     | -       |
| employee_match_candidates | jsonb                    |    NO    | '[]'::jsonb          |     | -       |
| matched_therapist_id      | uuid                     |   YES    | -                    |     | -       |
| matched_cycle_id          | uuid                     |   YES    | -                    |     | -       |
| parsed_requests           | jsonb                    |    NO    | '[]'::jsonb          |     | -       |
| unresolved_lines          | jsonb                    |    NO    | '[]'::jsonb          |     | -       |
| auto_applied_at           | timestamp with time zone |   YES    | -                    |     | -       |
| auto_applied_by           | uuid                     |   YES    | -                    |     | -       |
| apply_error               | text                     |   YES    | -                    |     | -       |
| reviewed_at               | timestamp with time zone |   YES    | -                    |     | -       |
| reviewed_by               | uuid                     |   YES    | -                    |     | -       |
| created_at                | timestamp with time zone |    NO    | now()                |     | -       |
| updated_at                | timestamp with time zone |    NO    | now()                |     | -       |
| original_parsed_requests  | jsonb                    |   YES    | -                    |     | -       |
| manually_edited_at        | timestamp with time zone |   YES    | -                    |     | -       |

Constraints:

- availability_email_intake_items_confidence_level_check [c]: CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
- availability_email_intake_items_ocr_status_check [c]: CHECK ((ocr_status = ANY (ARRAY['not_run'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
- availability_email_intake_items_parse_status_check [c]: CHECK ((parse_status = ANY (ARRAY['parsed'::text, 'auto_applied'::text, 'needs_review'::text, 'failed'::text])))
- availability_email_intake_items_source_type_check [c]: CHECK ((source_type = ANY (ARRAY['body'::text, 'attachment'::text])))
- availability_email_intake_items_attachment_id_fkey [f]: FOREIGN KEY (attachment_id) REFERENCES availability_email_attachments(id) ON DELETE SET NULL
- availability_email_intake_items_auto_applied_by_fkey [f]: FOREIGN KEY (auto_applied_by) REFERENCES profiles(id) ON DELETE SET NULL
- availability_email_intake_items_intake_id_fkey [f]: FOREIGN KEY (intake_id) REFERENCES availability_email_intakes(id) ON DELETE CASCADE
- availability_email_intake_items_matched_cycle_id_fkey [f]: FOREIGN KEY (matched_cycle_id) REFERENCES schedule_cycles(id) ON DELETE SET NULL
- availability_email_intake_items_matched_therapist_id_fkey [f]: FOREIGN KEY (matched_therapist_id) REFERENCES profiles(id) ON DELETE SET NULL
- availability_email_intake_items_reviewed_by_fkey [f]: FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL
- availability_email_intake_items_pkey [p]: PRIMARY KEY (id)

Indexes:

- availability_email_intake_items_intake_idx: CREATE INDEX availability_email_intake_items_intake_idx ON public.availability_email_intake_items USING btree (intake_id, created_at DESC)
- availability_email_intake_items_pkey: CREATE UNIQUE INDEX availability_email_intake_items_pkey ON public.availability_email_intake_items USING btree (id)
- availability_email_intake_items_status_idx: CREATE INDEX availability_email_intake_items_status_idx ON public.availability_email_intake_items USING btree (parse_status, created_at DESC)

RLS policies:

- Managers and leads can read all availability email intake items [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles p<br> WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'lead'::text]))))); check=-
- Managers can modify availability email intake items [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()

### public.availability_email_intakes

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column               | Data type                | Nullable | Default              | PK  | Comment |
| -------------------- | ------------------------ | :------: | -------------------- | :-: | ------- |
| id                   | uuid                     |    NO    | gen_random_uuid()    | yes | -       |
| provider             | text                     |    NO    | 'resend'::text       |     | -       |
| provider_email_id    | text                     |    NO    | -                    |     | -       |
| provider_message_id  | text                     |   YES    | -                    |     | -       |
| from_email           | text                     |    NO    | -                    |     | -       |
| from_name            | text                     |   YES    | -                    |     | -       |
| subject              | text                     |   YES    | -                    |     | -       |
| text_content         | text                     |   YES    | -                    |     | -       |
| html_content         | text                     |   YES    | -                    |     | -       |
| received_at          | timestamp with time zone |    NO    | -                    |     | -       |
| matched_therapist_id | uuid                     |   YES    | -                    |     | -       |
| matched_cycle_id     | uuid                     |   YES    | -                    |     | -       |
| parse_status         | text                     |    NO    | 'needs_review'::text |     | -       |
| parse_summary        | text                     |   YES    | -                    |     | -       |
| parsed_requests      | jsonb                    |    NO    | '[]'::jsonb          |     | -       |
| raw_payload          | jsonb                    |    NO    | '{}'::jsonb          |     | -       |
| applied_at           | timestamp with time zone |   YES    | -                    |     | -       |
| applied_by           | uuid                     |   YES    | -                    |     | -       |
| created_at           | timestamp with time zone |    NO    | now()                |     | -       |
| updated_at           | timestamp with time zone |    NO    | now()                |     | -       |
| batch_status         | text                     |    NO    | 'needs_review'::text |     | -       |
| item_count           | integer                  |    NO    | 0                    |     | -       |
| auto_applied_count   | integer                  |    NO    | 0                    |     | -       |
| needs_review_count   | integer                  |    NO    | 0                    |     | -       |
| failed_count         | integer                  |    NO    | 0                    |     | -       |

Constraints:

- availability_email_intakes_batch_status_check [c]: CHECK ((batch_status = ANY (ARRAY['parsed'::text, 'needs_review'::text, 'failed'::text, 'applied'::text])))
- availability_email_intakes_parse_status_check [c]: CHECK ((parse_status = ANY (ARRAY['parsed'::text, 'needs_review'::text, 'failed'::text, 'applied'::text])))
- availability_email_intakes_provider_check [c]: CHECK ((provider = ANY (ARRAY['resend'::text, 'manual'::text])))
- availability_email_intakes_applied_by_fkey [f]: FOREIGN KEY (applied_by) REFERENCES profiles(id) ON DELETE SET NULL
- availability_email_intakes_matched_cycle_id_fkey [f]: FOREIGN KEY (matched_cycle_id) REFERENCES schedule_cycles(id) ON DELETE SET NULL
- availability_email_intakes_matched_therapist_id_fkey [f]: FOREIGN KEY (matched_therapist_id) REFERENCES profiles(id) ON DELETE SET NULL
- availability_email_intakes_pkey [p]: PRIMARY KEY (id)
- availability_email_intakes_provider_email_id_key [u]: UNIQUE (provider_email_id)

Indexes:

- availability_email_intakes_matched_therapist_idx: CREATE INDEX availability_email_intakes_matched_therapist_idx ON public.availability_email_intakes USING btree (matched_therapist_id)
- availability_email_intakes_parse_status_idx: CREATE INDEX availability_email_intakes_parse_status_idx ON public.availability_email_intakes USING btree (parse_status, received_at DESC)
- availability_email_intakes_pkey: CREATE UNIQUE INDEX availability_email_intakes_pkey ON public.availability_email_intakes USING btree (id)
- availability_email_intakes_provider_email_id_key: CREATE UNIQUE INDEX availability_email_intakes_provider_email_id_key ON public.availability_email_intakes USING btree (provider_email_id)
- availability_email_intakes_received_at_idx: CREATE INDEX availability_email_intakes_received_at_idx ON public.availability_email_intakes USING btree (received_at DESC)

RLS policies:

- Managers and leads can read all availability email intakes [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles p<br> WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'lead'::text]))))); check=-
- Managers can modify availability email intakes [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()

### public.availability_entries

Type: table; RLS: True; Approx rows: 46; Primary key: id

| Column       | Data type                      | Nullable | Default                         | PK  | Comment |
| ------------ | ------------------------------ | :------: | ------------------------------- | :-: | ------- |
| id           | uuid                           |    NO    | gen_random_uuid()               | yes | -       |
| therapist_id | uuid                           |    NO    | -                               |     | -       |
| cycle_id     | uuid                           |    NO    | -                               |     | -       |
| date         | date                           |    NO    | -                               |     | -       |
| shift_type   | public.availability_shift_type |    NO    | 'both'::availability_shift_type |     | -       |
| entry_type   | public.availability_entry_type |    NO    | -                               |     | -       |
| reason       | text                           |   YES    | -                               |     | -       |
| created_by   | uuid                           |    NO    | -                               |     | -       |
| created_at   | timestamp with time zone       |    NO    | now()                           |     | -       |

Constraints:

- availability_entries_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- availability_entries_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- availability_entries_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- availability_entries_pkey [p]: PRIMARY KEY (id)

Indexes:

- availability_entries_conflict_lookup_idx: CREATE INDEX availability_entries_conflict_lookup_idx ON public.availability_entries USING btree (therapist_id, cycle_id, date, entry_type, shift_type)
- availability_entries_cycle_date_idx: CREATE INDEX availability_entries_cycle_date_idx ON public.availability_entries USING btree (cycle_id, date)
- availability_entries_pkey: CREATE UNIQUE INDEX availability_entries_pkey ON public.availability_entries USING btree (id)
- availability_entries_therapist_cycle_idx: CREATE INDEX availability_entries_therapist_cycle_idx ON public.availability_entries USING btree (therapist_id, cycle_id)
- availability_entries_unique_therapist_cycle_date_shift_idx: CREATE UNIQUE INDEX availability_entries_unique_therapist_cycle_date_shift_idx ON public.availability_entries USING btree (therapist_id, cycle_id, date, shift_type)

RLS policies:

- Managers and leads can read availability entries [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor_profile<br> WHERE ((actor_profile.id = auth.uid()) AND ((actor_profile.role = ANY (ARRAY['manager'::text, 'lead'::text])) OR ((actor_profile.role = ANY (ARRAY['therapist'::text, 'staff'::text])) AND (COALESCE(actor_profile.is_lead_eligible, false) = true)))))); check=-
- Therapists can delete own availability entries [DELETE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-
- Therapists can insert own availability entries [INSERT, PERMISSIVE, roles={public}]: using=-; check=((auth.uid() = therapist_id) AND (auth.uid() = created_by))
- Therapists can update own availability entries [UPDATE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=(auth.uid() = therapist_id)
- Therapists can view own availability entries [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-

### public.availability_overrides

Type: table; RLS: True; Approx rows: 91; Primary key: id

| Column                | Data type                | Nullable | Default           | PK  | Comment |
| --------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                    | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| cycle_id              | uuid                     |    NO    | -                 |     | -       |
| therapist_id          | uuid                     |    NO    | -                 |     | -       |
| date                  | date                     |    NO    | -                 |     | -       |
| shift_type            | text                     |    NO    | 'both'::text      |     | -       |
| override_type         | text                     |    NO    | -                 |     | -       |
| note                  | text                     |   YES    | -                 |     | -       |
| created_by            | uuid                     |    NO    | -                 |     | -       |
| created_at            | timestamp with time zone |    NO    | now()             |     | -       |
| source                | text                     |    NO    | 'therapist'::text |     | -       |
| updated_at            | timestamp with time zone |    NO    | now()             |     | -       |
| source_intake_id      | uuid                     |   YES    | -                 |     | -       |
| source_intake_item_id | uuid                     |   YES    | -                 |     | -       |

Constraints:

- availability_overrides_override_type_check [c]: CHECK ((override_type = ANY (ARRAY['force_off'::text, 'force_on'::text])))
- availability_overrides_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text, 'both'::text])))
- availability_overrides_source_check [c]: CHECK ((source = ANY (ARRAY['therapist'::text, 'manager'::text])))
- availability_overrides_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- availability_overrides_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- availability_overrides_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- availability_overrides_pkey [p]: PRIMARY KEY (id)
- availability_overrides_unique_cycle_therapist_date_shift [u]: UNIQUE (cycle_id, therapist_id, date, shift_type)

Indexes:

- availability_overrides_cycle_date_idx: CREATE INDEX availability_overrides_cycle_date_idx ON public.availability_overrides USING btree (cycle_id, date)
- availability_overrides_cycle_therapist_idx: CREATE INDEX availability_overrides_cycle_therapist_idx ON public.availability_overrides USING btree (cycle_id, therapist_id)
- availability_overrides_pkey: CREATE UNIQUE INDEX availability_overrides_pkey ON public.availability_overrides USING btree (id)
- availability_overrides_source_intake_id_idx: CREATE INDEX availability_overrides_source_intake_id_idx ON public.availability_overrides USING btree (source_intake_id) WHERE (source_intake_id IS NOT NULL)
- availability_overrides_source_intake_item_id_idx: CREATE INDEX availability_overrides_source_intake_item_id_idx ON public.availability_overrides USING btree (source_intake_item_id) WHERE (source_intake_item_id IS NOT NULL)
- availability_overrides_unique_cycle_therapist_date_shift: CREATE UNIQUE INDEX availability_overrides_unique_cycle_therapist_date_shift ON public.availability_overrides USING btree (cycle_id, therapist_id, date, shift_type)

RLS policies:

- Managers and leads can read all availability overrides [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor_profile<br> WHERE ((actor_profile.id = auth.uid()) AND ((actor_profile.role = ANY (ARRAY['manager'::text, 'lead'::text])) OR ((actor_profile.role = ANY (ARRAY['therapist'::text, 'staff'::text])) AND (availability_overrides.therapist_id = auth.uid())))))); check=-
- Managers can modify all availability overrides [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()
- Therapists can delete own availability overrides [DELETE, PERMISSIVE, roles={public}]: using=((auth.uid() = therapist_id) AND (source = 'therapist'::text)); check=-
- Therapists can insert own availability overrides [INSERT, PERMISSIVE, roles={public}]: using=-; check=((auth.uid() = therapist_id) AND (auth.uid() = created_by) AND (source = 'therapist'::text))
- Therapists can update own availability overrides [UPDATE, PERMISSIVE, roles={public}]: using=((auth.uid() = therapist_id) AND (source = 'therapist'::text)); check=((auth.uid() = therapist_id) AND (source = 'therapist'::text))
- Therapists can view own availability overrides [SELECT, PERMISSIVE, roles={public}]: using=((auth.uid() = therapist_id) AND (source = 'therapist'::text)); check=-

### public.availability_requests

Type: table; RLS: True; Approx rows: 46; Primary key: id

| Column     | Data type                | Nullable | Default            | PK  | Comment |
| ---------- | ------------------------ | :------: | ------------------ | :-: | ------- |
| id         | uuid                     |    NO    | uuid_generate_v4() | yes | -       |
| user_id    | uuid                     |   YES    | -                  |     | -       |
| cycle_id   | uuid                     |   YES    | -                  |     | -       |
| date       | date                     |    NO    | -                  |     | -       |
| reason     | text                     |   YES    | -                  |     | -       |
| created_at | timestamp with time zone |   YES    | now()              |     | -       |

Constraints:

- availability_requests_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- availability_requests_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
- availability_requests_pkey [p]: PRIMARY KEY (id)

Indexes:

- availability_cycle_date_idx: CREATE INDEX availability_cycle_date_idx ON public.availability_requests USING btree (cycle_id, date)
- availability_requests_pkey: CREATE UNIQUE INDEX availability_requests_pkey ON public.availability_requests USING btree (id)
- availability_unique_user_cycle_date_idx: CREATE UNIQUE INDEX availability_unique_user_cycle_date_idx ON public.availability_requests USING btree (user_id, cycle_id, date) WHERE (cycle_id IS NOT NULL)
- availability_unique_user_date_no_cycle_idx: CREATE UNIQUE INDEX availability_unique_user_date_no_cycle_idx ON public.availability_requests USING btree (user_id, date) WHERE (cycle_id IS NULL)
- availability_user_date_idx: CREATE INDEX availability_user_date_idx ON public.availability_requests USING btree (user_id, date)

RLS policies:

- Managers can view all availability [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles<br> WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)))); check=-
- Users can delete their own availability [DELETE, PERMISSIVE, roles={public}]: using=(auth.uid() = user_id); check=-
- Users can insert their own availability [INSERT, PERMISSIVE, roles={public}]: using=-; check=(auth.uid() = user_id)
- Users can view their own availability [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = user_id); check=-

### public.availability_reviews

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column       | Data type                | Nullable | Default           | PK  | Comment |
| ------------ | ------------------------ | :------: | ----------------- | :-: | ------- |
| id           | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| therapist_id | uuid                     |    NO    | -                 |     | -       |
| cycle_id     | uuid                     |    NO    | -                 |     | -       |
| status       | text                     |    NO    | 'pending'::text   |     | -       |
| reviewed_by  | uuid                     |   YES    | -                 |     | -       |
| reviewed_at  | timestamp with time zone |   YES    | -                 |     | -       |
| created_at   | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- availability_reviews_status_check [c]: CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
- availability_reviews_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- availability_reviews_reviewed_by_fkey [f]: FOREIGN KEY (reviewed_by) REFERENCES profiles(id)
- availability_reviews_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- availability_reviews_pkey [p]: PRIMARY KEY (id)
- availability_reviews_therapist_cycle_unique [u]: UNIQUE (therapist_id, cycle_id)

Indexes:

- availability_reviews_pkey: CREATE UNIQUE INDEX availability_reviews_pkey ON public.availability_reviews USING btree (id)
- availability_reviews_therapist_cycle_unique: CREATE UNIQUE INDEX availability_reviews_therapist_cycle_unique ON public.availability_reviews USING btree (therapist_id, cycle_id)

RLS policies:

- managers_all_availability_reviews [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles<br> WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)))); check=(EXISTS ( SELECT 1<br> FROM profiles<br> WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'manager'::text))))
- therapists_read_own_availability_reviews [SELECT, PERMISSIVE, roles={public}]: using=(therapist_id = auth.uid()); check=-

### public.cycle_templates

Type: table; RLS: True; Approx rows: 2; Primary key: id

| Column      | Data type                | Nullable | Default           | PK  | Comment |
| ----------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id          | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| name        | text                     |    NO    | -                 |     | -       |
| description | text                     |   YES    | -                 |     | -       |
| created_by  | uuid                     |   YES    | -                 |     | -       |
| created_at  | timestamp with time zone |    NO    | now()             |     | -       |
| shift_data  | jsonb                    |    NO    | -                 |     | -       |
| site_id     | text                     |    NO    | 'default'::text   |     | -       |

Constraints:

- cycle_templates_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id)
- cycle_templates_pkey [p]: PRIMARY KEY (id)

Indexes:

- cycle_templates_pkey: CREATE UNIQUE INDEX cycle_templates_pkey ON public.cycle_templates USING btree (id)
- cycle_templates_site_created_at_idx: CREATE INDEX cycle_templates_site_created_at_idx ON public.cycle_templates USING btree (site_id, created_at DESC)

RLS policies:

- Managers can manage site templates [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND COALESCE(actor.is_active, true) AND (actor.archived_at IS NULL) AND (actor.site_id = cycle_templates.site_id)))); check=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND COALESCE(actor.is_active, true) AND (actor.archived_at IS NULL) AND (actor.site_id = cycle_templates.site_id))))

### public.employee_roster

Type: table; RLS: True; Approx rows: 24; Primary key: id

| Column                 | Data type                | Nullable | Default           | PK  | Comment |
| ---------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                     | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| full_name              | text                     |    NO    | -                 |     | -       |
| normalized_full_name   | text                     |    NO    | -                 |     | -       |
| role                   | text                     |    NO    | -                 |     | -       |
| shift_type             | text                     |    NO    | 'day'::text       |     | -       |
| employment_type        | text                     |    NO    | 'full_time'::text |     | -       |
| max_work_days_per_week | smallint                 |    NO    | 3                 |     | -       |
| is_lead_eligible       | boolean                  |    NO    | false             |     | -       |
| is_active              | boolean                  |    NO    | true              |     | -       |
| matched_profile_id     | uuid                     |   YES    | -                 |     | -       |
| matched_email          | text                     |   YES    | -                 |     | -       |
| matched_at             | timestamp with time zone |   YES    | -                 |     | -       |
| created_by             | uuid                     |   YES    | -                 |     | -       |
| updated_by             | uuid                     |   YES    | -                 |     | -       |
| created_at             | timestamp with time zone |    NO    | now()             |     | -       |
| updated_at             | timestamp with time zone |    NO    | now()             |     | -       |
| phone_number           | text                     |   YES    | -                 |     | -       |

Constraints:

- employee_roster_employment_type_check [c]: CHECK ((employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'prn'::text])))
- employee_roster_max_work_days_per_week_check [c]: CHECK (((max_work_days_per_week >= 1) AND (max_work_days_per_week <= 7)))
- employee_roster_role_check [c]: CHECK ((role = ANY (ARRAY['manager'::text, 'therapist'::text, 'lead'::text])))
- employee_roster_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- employee_roster_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
- employee_roster_matched_profile_id_fkey [f]: FOREIGN KEY (matched_profile_id) REFERENCES profiles(id) ON DELETE SET NULL
- employee_roster_updated_by_fkey [f]: FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
- employee_roster_pkey [p]: PRIMARY KEY (id)
- employee_roster_normalized_full_name_key [u]: UNIQUE (normalized_full_name)

Indexes:

- employee_roster_active_name_idx: CREATE INDEX employee_roster_active_name_idx ON public.employee_roster USING btree (normalized_full_name) WHERE (is_active = true)
- employee_roster_normalized_full_name_key: CREATE UNIQUE INDEX employee_roster_normalized_full_name_key ON public.employee_roster USING btree (normalized_full_name)
- employee_roster_pkey: CREATE UNIQUE INDEX employee_roster_pkey ON public.employee_roster USING btree (id)

RLS policies:

- Managers can mutate employee roster [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()
- Managers can read employee roster [SELECT, PERMISSIVE, roles={public}]: using=is_manager(); check=-

### public.lottery_decisions

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column              | Data type                | Nullable | Default           | PK  | Comment |
| ------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                  | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| site_id             | text                     |    NO    | -                 |     | -       |
| shift_date          | date                     |    NO    | -                 |     | -       |
| shift_type          | text                     |    NO    | -                 |     | -       |
| keep_to_work        | integer                  |    NO    | -                 |     | -       |
| scheduled_count     | integer                  |    NO    | -                 |     | -       |
| reductions_needed   | integer                  |    NO    | -                 |     | -       |
| context_signature   | text                     |    NO    | -                 |     | -       |
| recommended_actions | jsonb                    |    NO    | '[]'::jsonb       |     | -       |
| applied_actions     | jsonb                    |    NO    | '[]'::jsonb       |     | -       |
| override_applied    | boolean                  |    NO    | false             |     | -       |
| applied_at          | timestamp with time zone |    NO    | now()             |     | -       |
| applied_by          | uuid                     |    NO    | -                 |     | -       |
| superseded_at       | timestamp with time zone |   YES    | -                 |     | -       |
| superseded_by       | uuid                     |   YES    | -                 |     | -       |

Constraints:

- lottery_decisions_keep_to_work_check [c]: CHECK ((keep_to_work >= 0))
- lottery_decisions_reductions_needed_check [c]: CHECK ((reductions_needed >= 0))
- lottery_decisions_scheduled_count_check [c]: CHECK ((scheduled_count >= 0))
- lottery_decisions_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- lottery_decisions_applied_by_fkey [f]: FOREIGN KEY (applied_by) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_decisions_superseded_by_fkey [f]: FOREIGN KEY (superseded_by) REFERENCES profiles(id) ON DELETE SET NULL
- lottery_decisions_pkey [p]: PRIMARY KEY (id)

Indexes:

- lottery_decisions_pkey: CREATE UNIQUE INDEX lottery_decisions_pkey ON public.lottery_decisions USING btree (id)
- lottery_decisions_site_slot_idx: CREATE INDEX lottery_decisions_site_slot_idx ON public.lottery_decisions USING btree (site_id, shift_date DESC, shift_type, applied_at DESC)

RLS policies:

- Managers can manage lottery decisions [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_decisions.site_id)))); check=((auth.uid() = applied_by) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_decisions.site_id)))))
- Managers can read lottery decisions [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_decisions.site_id)))); check=-

### public.lottery_history_entries

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column             | Data type                | Nullable | Default           | PK  | Comment |
| ------------------ | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                 | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| site_id            | text                     |    NO    | -                 |     | -       |
| shift_id           | uuid                     |    NO    | -                 |     | -       |
| decision_id        | uuid                     |   YES    | -                 |     | -       |
| therapist_id       | uuid                     |    NO    | -                 |     | -       |
| shift_date         | date                     |    NO    | -                 |     | -       |
| shift_type         | text                     |    NO    | -                 |     | -       |
| applied_status     | public.assignment_status |    NO    | -                 |     | -       |
| created_at         | timestamp with time zone |    NO    | now()             |     | -       |
| created_by         | uuid                     |    NO    | -                 |     | -       |
| invalidated_at     | timestamp with time zone |   YES    | -                 |     | -       |
| invalidated_by     | uuid                     |   YES    | -                 |     | -       |
| invalidated_reason | text                     |   YES    | -                 |     | -       |
| override_applied   | boolean                  |    NO    | false             |     | -       |
| request_restored   | boolean                  |    NO    | false             |     | -       |

Constraints:

- lottery_history_entries_applied_status_check [c]: CHECK ((applied_status = ANY (ARRAY['on_call'::assignment_status, 'cancelled'::assignment_status])))
- lottery_history_entries_invalidated_reason_check [c]: CHECK ((invalidated_reason = ANY (ARRAY['status_reverted'::text, 'status_changed'::text])))
- lottery_history_entries_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- lottery_history_entries_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_history_entries_decision_id_fkey [f]: FOREIGN KEY (decision_id) REFERENCES lottery_decisions(id) ON DELETE SET NULL
- lottery_history_entries_invalidated_by_fkey [f]: FOREIGN KEY (invalidated_by) REFERENCES profiles(id) ON DELETE SET NULL
- lottery_history_entries_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- lottery_history_entries_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_history_entries_pkey [p]: PRIMARY KEY (id)

Indexes:

- lottery_history_entries_pkey: CREATE UNIQUE INDEX lottery_history_entries_pkey ON public.lottery_history_entries USING btree (id)
- lottery_history_entries_shift_idx: CREATE INDEX lottery_history_entries_shift_idx ON public.lottery_history_entries USING btree (shift_id, created_at DESC)
- lottery_history_entries_site_therapist_idx: CREATE INDEX lottery_history_entries_site_therapist_idx ON public.lottery_history_entries USING btree (site_id, therapist_id, shift_type, shift_date DESC, created_at DESC)

RLS policies:

- Managers and owners can read lottery history entries [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_history_entries.site_id) AND ((actor.role = 'manager'::text) OR (lottery_history_entries.therapist_id = auth.uid()))))); check=-
- Managers can manage lottery history entries [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_history_entries.site_id)))); check=((auth.uid() = created_by) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_history_entries.site_id)))))

### public.lottery_list_entries

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column        | Data type                | Nullable | Default           | PK  | Comment |
| ------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id            | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| site_id       | text                     |    NO    | -                 |     | -       |
| shift_type    | text                     |    NO    | -                 |     | -       |
| therapist_id  | uuid                     |    NO    | -                 |     | -       |
| display_order | integer                  |    NO    | -                 |     | -       |
| created_at    | timestamp with time zone |    NO    | now()             |     | -       |
| created_by    | uuid                     |    NO    | -                 |     | -       |
| updated_at    | timestamp with time zone |    NO    | now()             |     | -       |
| updated_by    | uuid                     |    NO    | -                 |     | -       |

Constraints:

- lottery_list_entries_display_order_check [c]: CHECK ((display_order > 0))
- lottery_list_entries_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- lottery_list_entries_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_list_entries_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_list_entries_updated_by_fkey [f]: FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_list_entries_pkey [p]: PRIMARY KEY (id)

Indexes:

- lottery_list_entries_pkey: CREATE UNIQUE INDEX lottery_list_entries_pkey ON public.lottery_list_entries USING btree (id)
- lottery_list_entries_site_shift_lookup_idx: CREATE INDEX lottery_list_entries_site_shift_lookup_idx ON public.lottery_list_entries USING btree (site_id, shift_type, updated_at DESC)
- lottery_list_entries_site_shift_order_idx: CREATE UNIQUE INDEX lottery_list_entries_site_shift_order_idx ON public.lottery_list_entries USING btree (site_id, shift_type, display_order)
- lottery_list_entries_site_shift_therapist_idx: CREATE UNIQUE INDEX lottery_list_entries_site_shift_therapist_idx ON public.lottery_list_entries USING btree (site_id, shift_type, therapist_id)

RLS policies:

- Active users can read lottery list entries [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_list_entries.site_id)))); check=-
- Managers can manage lottery list entries [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_list_entries.site_id)))); check=((auth.uid() = created_by) AND (auth.uid() = updated_by) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_list_entries.site_id)))))

### public.lottery_requests

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column        | Data type                | Nullable | Default           | PK  | Comment |
| ------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id            | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| site_id       | text                     |    NO    | -                 |     | -       |
| therapist_id  | uuid                     |    NO    | -                 |     | -       |
| shift_date    | date                     |    NO    | -                 |     | -       |
| shift_type    | text                     |    NO    | -                 |     | -       |
| requested_at  | timestamp with time zone |    NO    | -                 |     | -       |
| state         | text                     |    NO    | -                 |     | -       |
| created_at    | timestamp with time zone |    NO    | now()             |     | -       |
| created_by    | uuid                     |    NO    | -                 |     | -       |
| suppressed_at | timestamp with time zone |   YES    | -                 |     | -       |
| suppressed_by | uuid                     |   YES    | -                 |     | -       |
| restored_at   | timestamp with time zone |   YES    | -                 |     | -       |
| restored_by   | uuid                     |   YES    | -                 |     | -       |

Constraints:

- lottery_requests_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- lottery_requests_state_check [c]: CHECK ((state = ANY (ARRAY['active'::text, 'suppressed_status'::text, 'suppressed_schedule'::text])))
- lottery_requests_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_requests_restored_by_fkey [f]: FOREIGN KEY (restored_by) REFERENCES profiles(id) ON DELETE SET NULL
- lottery_requests_suppressed_by_fkey [f]: FOREIGN KEY (suppressed_by) REFERENCES profiles(id) ON DELETE SET NULL
- lottery_requests_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- lottery_requests_pkey [p]: PRIMARY KEY (id)

Indexes:

- lottery_requests_active_or_restorable_idx: CREATE UNIQUE INDEX lottery_requests_active_or_restorable_idx ON public.lottery_requests USING btree (site_id, therapist_id, shift_date, shift_type) WHERE (state = ANY (ARRAY['active'::text, 'suppressed_status'::text]))
- lottery_requests_pkey: CREATE UNIQUE INDEX lottery_requests_pkey ON public.lottery_requests USING btree (id)
- lottery_requests_site_shift_idx: CREATE INDEX lottery_requests_site_shift_idx ON public.lottery_requests USING btree (site_id, shift_date, shift_type, state, requested_at)
- lottery_requests_site_therapist_idx: CREATE INDEX lottery_requests_site_therapist_idx ON public.lottery_requests USING btree (site_id, therapist_id, shift_date DESC, requested_at DESC)

RLS policies:

- Managers and owners can read lottery requests [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_requests.site_id) AND ((actor.role = 'manager'::text) OR (lottery_requests.therapist_id = auth.uid()))))); check=-
- Users can insert their own active lottery requests [INSERT, PERMISSIVE, roles={public}]: using=-; check=((auth.uid() = created_by) AND (auth.uid() = therapist_id) AND (state = 'active'::text) AND (suppressed_at IS NULL) AND (suppressed_by IS NULL) AND (restored_at IS NULL) AND (restored_by IS NULL) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = lottery_requests.site_id)))))

### public.notification_outbox

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Server-managed notification queue. Managers may insert/read outbox rows through RLS, but deletion is intentionally reserved for service-role maintenance.

| Column           | Data type                | Nullable | Default           | PK  | Comment |
| ---------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id               | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| publish_event_id | uuid                     |    NO    | -                 |     | -       |
| user_id          | uuid                     |   YES    | -                 |     | -       |
| email            | text                     |    NO    | -                 |     | -       |
| name             | text                     |   YES    | -                 |     | -       |
| channel          | text                     |    NO    | 'email'::text     |     | -       |
| status           | text                     |    NO    | 'queued'::text    |     | -       |
| attempt_count    | integer                  |    NO    | 0                 |     | -       |
| last_error       | text                     |   YES    | -                 |     | -       |
| sent_at          | timestamp with time zone |   YES    | -                 |     | -       |
| created_at       | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- notification_outbox_attempt_count_check [c]: CHECK ((attempt_count >= 0))
- notification_outbox_channel_check [c]: CHECK ((channel = 'email'::text))
- notification_outbox_status_check [c]: CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
- notification_outbox_publish_event_id_fkey [f]: FOREIGN KEY (publish_event_id) REFERENCES publish_events(id) ON DELETE CASCADE
- notification_outbox_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
- notification_outbox_pkey [p]: PRIMARY KEY (id)

Indexes:

- notification_outbox_event_status_idx: CREATE INDEX notification_outbox_event_status_idx ON public.notification_outbox USING btree (publish_event_id, status)
- notification_outbox_pkey: CREATE UNIQUE INDEX notification_outbox_pkey ON public.notification_outbox USING btree (id)
- notification_outbox_status_created_at_idx: CREATE INDEX notification_outbox_status_created_at_idx ON public.notification_outbox USING btree (status, created_at)
- notification_outbox_unique_email_per_event_idx: CREATE UNIQUE INDEX notification_outbox_unique_email_per_event_idx ON public.notification_outbox USING btree (publish_event_id, email, channel)

RLS policies:

- Managers can insert notification outbox [INSERT, PERMISSIVE, roles={public}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text))))
- Managers can read notification outbox [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text)))); check=-

### public.notifications

Type: table; RLS: True; Approx rows: 586; Primary key: id
Comment: Notifications are user-visible records with read/update RLS; authenticated Data API clients cannot delete notification rows.

| Column      | Data type                | Nullable | Default           | PK  | Comment |
| ----------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id          | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| user_id     | uuid                     |    NO    | -                 |     | -       |
| event_type  | text                     |    NO    | -                 |     | -       |
| title       | text                     |    NO    | -                 |     | -       |
| message     | text                     |    NO    | -                 |     | -       |
| target_type | text                     |   YES    | -                 |     | -       |
| target_id   | text                     |   YES    | -                 |     | -       |
| created_at  | timestamp with time zone |    NO    | now()             |     | -       |
| read_at     | timestamp with time zone |   YES    | -                 |     | -       |

Constraints:

- notifications_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
- notifications_pkey [p]: PRIMARY KEY (id)

Indexes:

- notifications_pkey: CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)
- notifications_unique_idempotent_event_idx: CREATE UNIQUE INDEX notifications_unique_idempotent_event_idx ON public.notifications USING btree (user_id, event_type, target_type, target_id) WHERE ((target_type IS NOT NULL) AND (target_id IS NOT NULL) AND (event_type = ANY (ARRAY['cycle_published'::text, 'shift_reminder'::text])))
- notifications_unread_user_idx: CREATE INDEX notifications_unread_user_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL)
- notifications_user_created_at_idx: CREATE INDEX notifications_user_created_at_idx ON public.notifications USING btree (user_id, created_at DESC)

RLS policies:

- Managers can insert notifications [INSERT, PERMISSIVE, roles={public}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text))))
- Users can read own notifications [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = user_id); check=-
- Users can update own notifications [UPDATE, PERMISSIVE, roles={public}]: using=(auth.uid() = user_id); check=(auth.uid() = user_id)

### public.preliminary_requests

Type: table; RLS: True; Approx rows: 1; Primary key: id

| Column        | Data type                | Nullable | Default           | PK  | Comment |
| ------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id            | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| snapshot_id   | uuid                     |    NO    | -                 |     | -       |
| shift_id      | uuid                     |    NO    | -                 |     | -       |
| requester_id  | uuid                     |    NO    | -                 |     | -       |
| type          | text                     |    NO    | -                 |     | -       |
| status        | text                     |    NO    | -                 |     | -       |
| note          | text                     |   YES    | -                 |     | -       |
| decision_note | text                     |   YES    | -                 |     | -       |
| approved_by   | uuid                     |   YES    | -                 |     | -       |
| approved_at   | timestamp with time zone |   YES    | -                 |     | -       |
| created_at    | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- preliminary_requests_status_check [c]: CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'cancelled'::text])))
- preliminary_requests_type_check [c]: CHECK ((type = ANY (ARRAY['claim_open_shift'::text, 'request_change'::text])))
- preliminary_requests_approved_by_fkey [f]: FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL
- preliminary_requests_requester_id_fkey [f]: FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE
- preliminary_requests_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- preliminary_requests_snapshot_id_fkey [f]: FOREIGN KEY (snapshot_id) REFERENCES preliminary_snapshots(id) ON DELETE CASCADE
- preliminary_requests_pkey [p]: PRIMARY KEY (id)

Indexes:

- preliminary_requests_one_pending_claim_per_shift_idx: CREATE UNIQUE INDEX preliminary_requests_one_pending_claim_per_shift_idx ON public.preliminary_requests USING btree (snapshot_id, shift_id) WHERE ((type = 'claim_open_shift'::text) AND (status = 'pending'::text))
- preliminary_requests_pkey: CREATE UNIQUE INDEX preliminary_requests_pkey ON public.preliminary_requests USING btree (id)
- preliminary_requests_requester_created_idx: CREATE INDEX preliminary_requests_requester_created_idx ON public.preliminary_requests USING btree (requester_id, created_at DESC)
- preliminary_requests_snapshot_status_created_idx: CREATE INDEX preliminary_requests_snapshot_status_created_idx ON public.preliminary_requests USING btree (snapshot_id, status, created_at DESC)

RLS policies:

- Managers can read all preliminary requests [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL)))); check=-
- Managers can update preliminary requests [UPDATE, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL)))); check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL))))
- Users can cancel own preliminary requests [UPDATE, PERMISSIVE, roles={public}]: using=((auth.uid() = requester_id) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1<br> FROM profiles requester_profile<br> WHERE ((requester_profile.id = auth.uid()) AND (requester_profile.is_active = true) AND (requester_profile.archived_at IS NULL))))); check=((auth.uid() = requester_id) AND (EXISTS ( SELECT 1<br> FROM profiles requester_profile<br> WHERE ((requester_profile.id = auth.uid()) AND (requester_profile.is_active = true) AND (requester_profile.archived_at IS NULL)))))
- Users can create own preliminary requests [INSERT, PERMISSIVE, roles={public}]: using=-; check=((auth.uid() = requester_id) AND (EXISTS ( SELECT 1<br> FROM profiles requester_profile<br> WHERE ((requester_profile.id = auth.uid()) AND (requester_profile.is_active = true) AND (requester_profile.archived_at IS NULL)))))
- Users can read own preliminary requests [SELECT, PERMISSIVE, roles={public}]: using=((auth.uid() = requester_id) AND (EXISTS ( SELECT 1<br> FROM profiles requester_profile<br> WHERE ((requester_profile.id = auth.uid()) AND (requester_profile.is_active = true) AND (requester_profile.archived_at IS NULL))))); check=-

### public.preliminary_shift_states

Type: table; RLS: True; Approx rows: 6; Primary key: id

| Column            | Data type                | Nullable | Default           | PK  | Comment |
| ----------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| snapshot_id       | uuid                     |    NO    | -                 |     | -       |
| shift_id          | uuid                     |    NO    | -                 |     | -       |
| state             | text                     |    NO    | -                 |     | -       |
| reserved_by       | uuid                     |   YES    | -                 |     | -       |
| active_request_id | uuid                     |   YES    | -                 |     | -       |
| updated_at        | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- preliminary_shift_states_state_check [c]: CHECK ((state = ANY (ARRAY['tentative_assignment'::text, 'open'::text, 'pending_claim'::text, 'pending_change'::text])))
- preliminary_shift_states_active_request_id_fkey [f]: FOREIGN KEY (active_request_id) REFERENCES preliminary_requests(id) ON DELETE SET NULL
- preliminary_shift_states_reserved_by_fkey [f]: FOREIGN KEY (reserved_by) REFERENCES profiles(id) ON DELETE SET NULL
- preliminary_shift_states_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- preliminary_shift_states_snapshot_id_fkey [f]: FOREIGN KEY (snapshot_id) REFERENCES preliminary_snapshots(id) ON DELETE CASCADE
- preliminary_shift_states_pkey [p]: PRIMARY KEY (id)
- preliminary_shift_states_snapshot_id_shift_id_key [u]: UNIQUE (snapshot_id, shift_id)

Indexes:

- preliminary_shift_states_pkey: CREATE UNIQUE INDEX preliminary_shift_states_pkey ON public.preliminary_shift_states USING btree (id)
- preliminary_shift_states_reserved_by_idx: CREATE INDEX preliminary_shift_states_reserved_by_idx ON public.preliminary_shift_states USING btree (reserved_by) WHERE (reserved_by IS NOT NULL)
- preliminary_shift_states_snapshot_id_shift_id_key: CREATE UNIQUE INDEX preliminary_shift_states_snapshot_id_shift_id_key ON public.preliminary_shift_states USING btree (snapshot_id, shift_id)
- preliminary_shift_states_snapshot_state_idx: CREATE INDEX preliminary_shift_states_snapshot_state_idx ON public.preliminary_shift_states USING btree (snapshot_id, state)

RLS policies:

- Logged in users can read active preliminary shift states [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM (preliminary_snapshots snapshot<br> JOIN profiles viewer_profile ON ((viewer_profile.id = auth.uid())))<br> WHERE ((snapshot.id = preliminary_shift_states.snapshot_id) AND (snapshot.status = 'active'::text) AND (viewer_profile.is_active = true) AND (viewer_profile.archived_at IS NULL)))); check=-
- Managers can mutate preliminary shift states [ALL, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL)))); check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL))))

### public.preliminary_snapshots

Type: table; RLS: True; Approx rows: 1; Primary key: id

| Column     | Data type                | Nullable | Default           | PK  | Comment |
| ---------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id         | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| cycle_id   | uuid                     |    NO    | -                 |     | -       |
| created_by | uuid                     |    NO    | -                 |     | -       |
| sent_at    | timestamp with time zone |    NO    | now()             |     | -       |
| status     | text                     |    NO    | -                 |     | -       |
| created_at | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- preliminary_snapshots_status_check [c]: CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'closed'::text])))
- preliminary_snapshots_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
- preliminary_snapshots_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- preliminary_snapshots_pkey [p]: PRIMARY KEY (id)

Indexes:

- preliminary_snapshots_cycle_created_idx: CREATE INDEX preliminary_snapshots_cycle_created_idx ON public.preliminary_snapshots USING btree (cycle_id, created_at DESC)
- preliminary_snapshots_one_active_per_cycle_idx: CREATE UNIQUE INDEX preliminary_snapshots_one_active_per_cycle_idx ON public.preliminary_snapshots USING btree (cycle_id) WHERE (status = 'active'::text)
- preliminary_snapshots_pkey: CREATE UNIQUE INDEX preliminary_snapshots_pkey ON public.preliminary_snapshots USING btree (id)

RLS policies:

- Logged in users can read active preliminary snapshots [SELECT, PERMISSIVE, roles={public}]: using=((status = 'active'::text) AND (EXISTS ( SELECT 1<br> FROM profiles viewer_profile<br> WHERE ((viewer_profile.id = auth.uid()) AND (viewer_profile.is_active = true) AND (viewer_profile.archived_at IS NULL))))); check=-
- Managers can insert preliminary snapshots [INSERT, PERMISSIVE, roles={public}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL))))
- Managers can update preliminary snapshots [UPDATE, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL)))); check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text) AND (manager_profile.is_active = true) AND (manager_profile.archived_at IS NULL))))

### public.profiles

Type: table; RLS: True; Approx rows: 40; Primary key: id
Comment: Profile deletes are intentionally service-role/admin maintenance operations; authenticated Data API clients may insert or update through RLS but cannot delete profiles.

| Column                                    | Data type                | Nullable | Default           | PK  | Comment                                                                  |
| ----------------------------------------- | ------------------------ | :------: | ----------------- | :-: | ------------------------------------------------------------------------ |
| id                                        | uuid                     |    NO    | -                 | yes | -                                                                        |
| full_name                                 | text                     |    NO    | -                 |     | -                                                                        |
| email                                     | text                     |    NO    | -                 |     | -                                                                        |
| role                                      | text                     |   YES    | -                 |     | -                                                                        |
| shift_type                                | text                     |    NO    | 'day'::text       |     | -                                                                        |
| created_at                                | timestamp with time zone |   YES    | now()             |     | -                                                                        |
| is_lead_eligible                          | boolean                  |    NO    | false             |     | -                                                                        |
| phone_number                              | text                     |   YES    | -                 |     | -                                                                        |
| employment_type                           | text                     |    NO    | 'full_time'::text |     | -                                                                        |
| max_work_days_per_week                    | smallint                 |    NO    | 3                 |     | -                                                                        |
| on_fmla                                   | boolean                  |    NO    | false             |     | -                                                                        |
| fmla_return_date                          | date                     |   YES    | -                 |     | -                                                                        |
| is_active                                 | boolean                  |    NO    | true              |     | -                                                                        |
| preferred_work_days                       | \_int2[]                 |    NO    | '{}'::smallint[]  |     | -                                                                        |
| default_calendar_view                     | text                     |    NO    | 'day'::text       |     | -                                                                        |
| default_landing_page                      | text                     |    NO    | 'dashboard'::text |     | -                                                                        |
| site_id                                   | text                     |    NO    | 'default'::text   |     | -                                                                        |
| archived_at                               | timestamp with time zone |   YES    | -                 |     | -                                                                        |
| archived_by                               | uuid                     |   YES    | -                 |     | -                                                                        |
| default_schedule_view                     | text                     |    NO    | 'week'::text      |     | -                                                                        |
| max_consecutive_days                      | integer                  |    NO    | 3                 |     | Preferred maximum consecutive work days for therapist scheduling flows.  |
| notification_in_app_enabled               | boolean                  |    NO    | true              |     | When false, app notification rows should not be created for this user.   |
| notification_email_enabled                | boolean                  |    NO    | true              |     | When false, email notification delivery should be skipped for this user. |
| preferred_work_days_mode                  | text                     |    NO    | 'unset'::text     |     | -                                                                        |
| staff_onboarding_required                 | boolean                  |    NO    | false             |     | -                                                                        |
| staff_onboarding_preferences_confirmed_at | timestamp with time zone |   YES    | -                 |     | -                                                                        |
| staff_onboarding_theme_confirmed_at       | timestamp with time zone |   YES    | -                 |     | -                                                                        |
| staff_onboarding_completed_at             | timestamp with time zone |   YES    | -                 |     | -                                                                        |

Constraints:

- profiles_default_calendar_view_check [c]: CHECK ((default_calendar_view = ANY (ARRAY['day'::text, 'night'::text])))
- profiles_default_landing_page_check [c]: CHECK ((default_landing_page = ANY (ARRAY['dashboard'::text, 'coverage'::text])))
- profiles_default_schedule_view_check [c]: CHECK ((default_schedule_view = ANY (ARRAY['week'::text, 'roster'::text])))
- profiles_employment_type_check [c]: CHECK ((employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'prn'::text])))
- profiles_max_consecutive_days_check [c]: CHECK (((max_consecutive_days >= 1) AND (max_consecutive_days <= 7)))
- profiles_max_work_days_per_week_check [c]: CHECK (((max_work_days_per_week >= 1) AND (max_work_days_per_week <= 7)))
- profiles_preferred_work_days_mode_check [c]: CHECK ((preferred_work_days_mode = ANY (ARRAY['unset'::text, 'specific_days'::text, 'no_preference'::text])))
- profiles_preferred_work_days_valid_check [c]: CHECK ((preferred_work_days <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]))
- profiles_role_check [c]: CHECK ((role = ANY (ARRAY['manager'::text, 'therapist'::text, 'lead'::text])))
- profiles_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- profiles_archived_by_fkey [f]: FOREIGN KEY (archived_by) REFERENCES profiles(id) ON DELETE SET NULL
- profiles_id_fkey [f]: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
- profiles_pkey [p]: PRIMARY KEY (id)

Indexes:

- profiles_archived_at_idx: CREATE INDEX profiles_archived_at_idx ON public.profiles USING btree (archived_at)
- profiles_pkey: CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)

RLS policies:

- Managers and leads can read all profiles [SELECT, PERMISSIVE, roles={public}]: using=(is_manager() OR is_lead()); check=-
- Managers can update all profiles [UPDATE, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text)))); check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text))))
- Users can insert own profile [INSERT, PERMISSIVE, roles={public}]: using=-; check=(auth.uid() = id)
- Users can read own profile [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = id); check=-
- Users can update own profile [UPDATE, PERMISSIVE, roles={public}]: using=(auth.uid() = id); check=-

### public.publish_events

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Append-only publish history. Managers may insert/read publish events through RLS, but deletion is intentionally reserved for service-role maintenance.

| Column          | Data type                | Nullable | Default           | PK  | Comment |
| --------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id              | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| cycle_id        | uuid                     |    NO    | -                 |     | -       |
| published_at    | timestamp with time zone |    NO    | now()             |     | -       |
| published_by    | uuid                     |    NO    | -                 |     | -       |
| status          | text                     |    NO    | 'success'::text   |     | -       |
| recipient_count | integer                  |    NO    | 0                 |     | -       |
| channel         | text                     |    NO    | 'email'::text     |     | -       |
| queued_count    | integer                  |    NO    | 0                 |     | -       |
| sent_count      | integer                  |    NO    | 0                 |     | -       |
| failed_count    | integer                  |    NO    | 0                 |     | -       |
| error_message   | text                     |   YES    | -                 |     | -       |

Constraints:

- publish_events_channel_check [c]: CHECK ((channel = 'email'::text))
- publish_events_failed_count_check [c]: CHECK ((failed_count >= 0))
- publish_events_queued_count_check [c]: CHECK ((queued_count >= 0))
- publish_events_recipient_count_check [c]: CHECK ((recipient_count >= 0))
- publish_events_sent_count_check [c]: CHECK ((sent_count >= 0))
- publish_events_status_check [c]: CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text])))
- publish_events_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- publish_events_published_by_fkey [f]: FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE RESTRICT
- publish_events_pkey [p]: PRIMARY KEY (id)

Indexes:

- publish_events_cycle_published_at_idx: CREATE INDEX publish_events_cycle_published_at_idx ON public.publish_events USING btree (cycle_id, published_at DESC)
- publish_events_pkey: CREATE UNIQUE INDEX publish_events_pkey ON public.publish_events USING btree (id)

RLS policies:

- Managers can insert publish events [INSERT, PERMISSIVE, roles={public}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text))))
- Managers can read publish events [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles manager_profile<br> WHERE ((manager_profile.id = auth.uid()) AND (manager_profile.role = 'manager'::text)))); check=-

### public.resend_webhook_receipts

Type: table; RLS: True; Approx rows: 0; Primary key: svix_id

| Column       | Data type                | Nullable | Default | PK  | Comment |
| ------------ | ------------------------ | :------: | ------- | :-: | ------- |
| svix_id      | text                     |    NO    | -       | yes | -       |
| event_type   | text                     |    NO    | -       |     | -       |
| email_id     | text                     |   YES    | -       |     | -       |
| received_at  | timestamp with time zone |    NO    | now()   |     | -       |
| processed_at | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- resend_webhook_receipts_pkey [p]: PRIMARY KEY (svix_id)

Indexes:

- resend_webhook_receipts_pkey: CREATE UNIQUE INDEX resend_webhook_receipts_pkey ON public.resend_webhook_receipts USING btree (svix_id)

RLS policies:

- Service role only [ALL, PERMISSIVE, roles={public}]: using=false; check=-

### public.schedule_cycles

Type: table; RLS: True; Approx rows: 8; Primary key: id

| Column              | Data type                | Nullable | Default            | PK  | Comment                                                                                             |
| ------------------- | ------------------------ | :------: | ------------------ | :-: | --------------------------------------------------------------------------------------------------- |
| id                  | uuid                     |    NO    | uuid_generate_v4() | yes | -                                                                                                   |
| label               | text                     |    NO    | -                  |     | -                                                                                                   |
| start_date          | date                     |    NO    | -                  |     | -                                                                                                   |
| end_date            | date                     |    NO    | -                  |     | -                                                                                                   |
| published           | boolean                  |   YES    | false              |     | -                                                                                                   |
| created_at          | timestamp with time zone |   YES    | now()              |     | -                                                                                                   |
| archived_at         | timestamp with time zone |   YES    | -                  |     | -                                                                                                   |
| availability_due_at | timestamp with time zone |   YES    | -                  |     | Optional deadline for therapist availability submission; UI falls back to inferred dates when null. |
| site_id             | text                     |    NO    | 'default'::text    |     | -                                                                                                   |

Constraints:

- schedule_cycles_pkey [p]: PRIMARY KEY (id)

Indexes:

- schedule_cycles_archived_at_idx: CREATE INDEX schedule_cycles_archived_at_idx ON public.schedule_cycles USING btree (archived_at)
- schedule_cycles_pkey: CREATE UNIQUE INDEX schedule_cycles_pkey ON public.schedule_cycles USING btree (id)
- schedule_cycles_published_start_date_idx: CREATE INDEX schedule_cycles_published_start_date_idx ON public.schedule_cycles USING btree (published, start_date DESC)
- schedule_cycles_site_start_idx: CREATE INDEX schedule_cycles_site_start_idx ON public.schedule_cycles USING btree (site_id, start_date DESC)

RLS policies:

- Active users can view same-site published cycles [SELECT, PERMISSIVE, roles={authenticated}]: using=((published = true) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id))))); check=-
- Leads can view same-site cycles [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'lead'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id)))); check=-
- Managers can delete same-site unpublished cycles [DELETE, PERMISSIVE, roles={authenticated}]: using=((published = false) AND (EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id))))); check=-
- Managers can insert same-site cycles [INSERT, PERMISSIVE, roles={authenticated}]: using=-; check=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id))))
- Managers can update same-site cycles [UPDATE, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id)))); check=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id))))
- Managers can view same-site cycles [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = schedule_cycles.site_id)))); check=-

### public.shift_operational_entries

Type: table; RLS: True; Approx rows: 0; Primary key: id
Comment: Operational shift state is written by trusted server routes, triggers, and RPC flows; authenticated Data API clients have read-only RLS visibility and no direct write grants.

| Column          | Data type                | Nullable | Default           | PK  | Comment |
| --------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id              | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| shift_id        | uuid                     |    NO    | -                 |     | -       |
| code            | public.assignment_status |    NO    | -                 |     | -       |
| note            | text                     |   YES    | -                 |     | -       |
| left_early_time | time without time zone   |   YES    | -                 |     | -       |
| active          | boolean                  |    NO    | true              |     | -       |
| created_at      | timestamp with time zone |    NO    | now()             |     | -       |
| created_by      | uuid                     |    NO    | -                 |     | -       |
| replaced_at     | timestamp with time zone |   YES    | -                 |     | -       |
| replaced_by     | uuid                     |   YES    | -                 |     | -       |

Constraints:

- shift_operational_entries_code_check [c]: CHECK ((code <> 'scheduled'::assignment_status))
- shift_operational_entries_created_by_fkey [f]: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
- shift_operational_entries_replaced_by_fkey [f]: FOREIGN KEY (replaced_by) REFERENCES auth.users(id) ON DELETE SET NULL
- shift_operational_entries_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- shift_operational_entries_pkey [p]: PRIMARY KEY (id)

Indexes:

- shift_operational_entries_one_active_per_shift_idx: CREATE UNIQUE INDEX shift_operational_entries_one_active_per_shift_idx ON public.shift_operational_entries USING btree (shift_id) WHERE (active = true)
- shift_operational_entries_pkey: CREATE UNIQUE INDEX shift_operational_entries_pkey ON public.shift_operational_entries USING btree (id)
- shift_operational_entries_shift_created_idx: CREATE INDEX shift_operational_entries_shift_created_idx ON public.shift_operational_entries USING btree (shift_id, created_at DESC)

RLS policies:

- Active users can read same-site operational entries [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM (shifts shift<br> JOIN profiles actor ON ((actor.id = auth.uid())))<br> WHERE ((shift.id = shift_operational_entries.shift_id) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shift.site_id)))); check=-

### public.shift_operational_entry_audit

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column          | Data type                | Nullable | Default           | PK  | Comment |
| --------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id              | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| shift_id        | uuid                     |    NO    | -                 |     | -       |
| entry_id        | uuid                     |   YES    | -                 |     | -       |
| action_type     | text                     |    NO    | -                 |     | -       |
| code            | public.assignment_status |    NO    | -                 |     | -       |
| note            | text                     |   YES    | -                 |     | -       |
| left_early_time | time without time zone   |   YES    | -                 |     | -       |
| acted_by        | uuid                     |    NO    | -                 |     | -       |
| acted_at        | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- shift_operational_entry_audit_action_type_check [c]: CHECK ((action_type = ANY (ARRAY['add'::text, 'replace'::text, 'remove'::text])))
- shift_operational_entry_audit_acted_by_fkey [f]: FOREIGN KEY (acted_by) REFERENCES auth.users(id) ON DELETE CASCADE
- shift_operational_entry_audit_entry_id_fkey [f]: FOREIGN KEY (entry_id) REFERENCES shift_operational_entries(id) ON DELETE SET NULL
- shift_operational_entry_audit_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- shift_operational_entry_audit_pkey [p]: PRIMARY KEY (id)

Indexes:

- shift_operational_entry_audit_pkey: CREATE UNIQUE INDEX shift_operational_entry_audit_pkey ON public.shift_operational_entry_audit USING btree (id)
- shift_operational_entry_audit_shift_idx: CREATE INDEX shift_operational_entry_audit_shift_idx ON public.shift_operational_entry_audit USING btree (shift_id, acted_at DESC)

RLS policies:

- Managers and leads can read same-site operational entry audit [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM (shifts shift<br> JOIN profiles actor ON ((actor.id = auth.uid())))<br> WHERE ((shift.id = shift_operational_entry_audit.shift_id) AND (actor.site_id = shift.site_id) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND ((actor.role = ANY (ARRAY['manager'::text, 'lead'::text])) OR ((actor.role = ANY (ARRAY['therapist'::text, 'staff'::text])) AND (COALESCE(actor.is_lead_eligible, false) = true)))))); check=-

### public.shift_post_interests

Type: table; RLS: True; Approx rows: 3; Primary key: id
Comment: Pickup-interest writes are routed through service-role RPCs and trusted server routes; authenticated clients cannot insert interests directly.

| Column        | Data type                | Nullable | Default           | PK  | Comment |
| ------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id            | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| shift_post_id | uuid                     |    NO    | -                 |     | -       |
| therapist_id  | uuid                     |    NO    | -                 |     | -       |
| status        | text                     |    NO    | 'pending'::text   |     | -       |
| created_at    | timestamp with time zone |    NO    | now()             |     | -       |
| responded_at  | timestamp with time zone |   YES    | -                 |     | -       |

Constraints:

- shift_post_interests_status_check [c]: CHECK ((status = ANY (ARRAY['pending'::text, 'withdrawn'::text, 'selected'::text, 'declined'::text])))
- shift_post_interests_shift_post_id_fkey [f]: FOREIGN KEY (shift_post_id) REFERENCES shift_posts(id) ON DELETE CASCADE
- shift_post_interests_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- shift_post_interests_pkey [p]: PRIMARY KEY (id)

Indexes:

- shift_post_interests_active_unique_idx: CREATE UNIQUE INDEX shift_post_interests_active_unique_idx ON public.shift_post_interests USING btree (shift_post_id, therapist_id) WHERE (status = ANY (ARRAY['pending'::text, 'selected'::text]))
- shift_post_interests_one_selected_per_post_idx: CREATE UNIQUE INDEX shift_post_interests_one_selected_per_post_idx ON public.shift_post_interests USING btree (shift_post_id) WHERE (status = 'selected'::text)
- shift_post_interests_pkey: CREATE UNIQUE INDEX shift_post_interests_pkey ON public.shift_post_interests USING btree (id)
- shift_post_interests_post_status_idx: CREATE INDEX shift_post_interests_post_status_idx ON public.shift_post_interests USING btree (shift_post_id, status, created_at)
- shift_post_interests_queue_order_idx: CREATE INDEX shift_post_interests_queue_order_idx ON public.shift_post_interests USING btree (shift_post_id, status, created_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'selected'::text]))

RLS policies:

- Managers can read shift post interests [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL)))); check=-
- Post participants can read shift post interests [SELECT, PERMISSIVE, roles={public}]: using=((therapist_id = auth.uid()) OR (EXISTS ( SELECT 1<br> FROM shift_posts post<br> WHERE ((post.id = shift_post_interests.shift_post_id) AND (post.posted_by = auth.uid()))))); check=-
- Therapists can update their own shift post interest [UPDATE, PERMISSIVE, roles={public}]: using=((therapist_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'selected'::text]))); check=((therapist_id = auth.uid()) AND (status = 'withdrawn'::text))

### public.shift_posts

Type: table; RLS: True; Approx rows: 9; Primary key: id
Comment: Lifecycle writes are routed through service-role RPCs and trusted server routes; authenticated clients cannot insert or update shift_posts directly.

| Column                 | Data type                | Nullable | Default            | PK  | Comment                                                                                                      |
| ---------------------- | ------------------------ | :------: | ------------------ | :-: | ------------------------------------------------------------------------------------------------------------ |
| id                     | uuid                     |    NO    | uuid_generate_v4() | yes | -                                                                                                            |
| shift_id               | uuid                     |   YES    | -                  |     | -                                                                                                            |
| posted_by              | uuid                     |   YES    | -                  |     | -                                                                                                            |
| message                | text                     |    NO    | -                  |     | -                                                                                                            |
| type                   | text                     |    NO    | -                  |     | -                                                                                                            |
| status                 | text                     |    NO    | 'pending'::text    |     | -                                                                                                            |
| created_at             | timestamp with time zone |   YES    | now()              |     | -                                                                                                            |
| claimed_by             | uuid                     |   YES    | -                  |     | -                                                                                                            |
| swap_shift_id          | uuid                     |   YES    | -                  |     | -                                                                                                            |
| expired_at             | timestamp with time zone |   YES    | -                  |     | -                                                                                                            |
| manager_override       | boolean                  |    NO    | false              |     | -                                                                                                            |
| override_reason        | text                     |   YES    | -                  |     | -                                                                                                            |
| visibility             | text                     |    NO    | 'team'::text       |     | team = visible on the shared board, direct = private between requester, recipient, and managers.             |
| recipient_response     | text                     |   YES    | -                  |     | For direct requests, tracks whether the targeted therapist has accepted or declined before manager approval. |
| recipient_responded_at | timestamp with time zone |   YES    | -                  |     | Timestamp when the targeted therapist last accepted or declined a direct request.                            |
| request_kind           | text                     |    NO    | 'standard'::text   |     | standard = regular swap/pickup request, call_in = lead/manager-triggered help alert for a called-in shift.   |

Constraints:

- shift_posts_recipient_response_check [c]: CHECK ((recipient_response = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
- shift_posts_request_kind_check [c]: CHECK ((request_kind = ANY (ARRAY['standard'::text, 'call_in'::text])))
- shift_posts_status_check [c]: CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text, 'withdrawn'::text])))
- shift_posts_type_check [c]: CHECK ((type = ANY (ARRAY['swap'::text, 'pickup'::text])))
- shift_posts_visibility_check [c]: CHECK ((visibility = ANY (ARRAY['team'::text, 'direct'::text])))
- shift_posts_claimed_by_fkey [f]: FOREIGN KEY (claimed_by) REFERENCES profiles(id) ON DELETE SET NULL
- shift_posts_posted_by_fkey [f]: FOREIGN KEY (posted_by) REFERENCES profiles(id) ON DELETE CASCADE
- shift_posts_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- shift_posts_swap_shift_id_fkey [f]: FOREIGN KEY (swap_shift_id) REFERENCES shifts(id) ON DELETE SET NULL
- shift_posts_pkey [p]: PRIMARY KEY (id)

Indexes:

- shift_posts_claimed_by_idx: CREATE INDEX shift_posts_claimed_by_idx ON public.shift_posts USING btree (claimed_by) WHERE (claimed_by IS NOT NULL)
- shift_posts_one_pending_call_in_per_shift_idx: CREATE UNIQUE INDEX shift_posts_one_pending_call_in_per_shift_idx ON public.shift_posts USING btree (shift_id) WHERE ((request_kind = 'call_in'::text) AND (status = 'pending'::text))
- shift_posts_pkey: CREATE UNIQUE INDEX shift_posts_pkey ON public.shift_posts USING btree (id)
- shift_posts_posted_by_idx: CREATE INDEX shift_posts_posted_by_idx ON public.shift_posts USING btree (posted_by)
- shift_posts_shift_id_idx: CREATE INDEX shift_posts_shift_id_idx ON public.shift_posts USING btree (shift_id)
- shift_posts_status_created_idx: CREATE INDEX shift_posts_status_created_idx ON public.shift_posts USING btree (status, created_at DESC)

RLS policies:

- Authenticated users can read team shift posts [SELECT, PERMISSIVE, roles={public}]: using=((auth.uid() IS NOT NULL) AND (COALESCE(visibility, 'team'::text) = 'team'::text)); check=-
- Managers can read all shift posts [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL)))); check=-
- Participants can read direct shift posts [SELECT, PERMISSIVE, roles={public}]: using=((COALESCE(visibility, 'team'::text) = 'direct'::text) AND (auth.uid() IS NOT NULL) AND ((posted_by = auth.uid()) OR (claimed_by = auth.uid()))); check=-
- Users can delete their own shift posts [DELETE, PERMISSIVE, roles={public}]: using=(auth.uid() = posted_by); check=-

### public.shift_reminder_outbox

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column        | Data type                | Nullable | Default           | PK  | Comment |
| ------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id            | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| user_id       | uuid                     |   YES    | -                 |     | -       |
| shift_id      | uuid                     |   YES    | -                 |     | -       |
| remind_type   | text                     |    NO    | -                 |     | -       |
| status        | text                     |    NO    | 'queued'::text    |     | -       |
| email         | text                     |    NO    | -                 |     | -       |
| name          | text                     |   YES    | -                 |     | -       |
| attempt_count | integer                  |    NO    | 0                 |     | -       |
| last_error    | text                     |   YES    | -                 |     | -       |
| send_after    | timestamp with time zone |    NO    | -                 |     | -       |
| sent_at       | timestamp with time zone |   YES    | -                 |     | -       |
| created_at    | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- shift_reminder_outbox_remind_type_check [c]: CHECK ((remind_type = '24h'::text))
- shift_reminder_outbox_status_check [c]: CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
- shift_reminder_outbox_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- shift_reminder_outbox_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
- shift_reminder_outbox_pkey [p]: PRIMARY KEY (id)
- shift_reminder_outbox_shift_id_remind_type_key [u]: UNIQUE (shift_id, remind_type)

Indexes:

- shift_reminder_outbox_pkey: CREATE UNIQUE INDEX shift_reminder_outbox_pkey ON public.shift_reminder_outbox USING btree (id)
- shift_reminder_outbox_shift_id_remind_type_key: CREATE UNIQUE INDEX shift_reminder_outbox_shift_id_remind_type_key ON public.shift_reminder_outbox USING btree (shift_id, remind_type)

RLS policies:

- Service role only [ALL, PERMISSIVE, roles={public}]: using=false; check=-

### public.shift_status_changes

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column         | Data type                | Nullable | Default           | PK  | Comment |
| -------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id             | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| shift_id       | uuid                     |    NO    | -                 |     | -       |
| therapist_name | text                     |    NO    | -                 |     | -       |
| from_status    | text                     |    NO    | -                 |     | -       |
| to_status      | text                     |    NO    | -                 |     | -       |
| changed_at     | timestamp with time zone |    NO    | now()             |     | -       |
| changed_by     | uuid                     |    NO    | -                 |     | -       |

Constraints:

- shift_status_changes_changed_by_fkey [f]: FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE CASCADE
- shift_status_changes_shift_id_fkey [f]: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
- shift_status_changes_pkey [p]: PRIMARY KEY (id)

Indexes:

- shift_status_changes_changed_by_idx: CREATE INDEX shift_status_changes_changed_by_idx ON public.shift_status_changes USING btree (changed_by, changed_at DESC)
- shift_status_changes_pkey: CREATE UNIQUE INDEX shift_status_changes_pkey ON public.shift_status_changes USING btree (id)
- shift_status_changes_shift_id_idx: CREATE INDEX shift_status_changes_shift_id_idx ON public.shift_status_changes USING btree (shift_id, changed_at DESC)

RLS policies:

- Managers and leads can insert shift status changes [INSERT, PERMISSIVE, roles={public}]: using=-; check=((auth.uid() = changed_by) AND (EXISTS ( SELECT 1<br> FROM profiles actor_profile<br> WHERE ((actor_profile.id = auth.uid()) AND ((actor_profile.role = ANY (ARRAY['manager'::text, 'lead'::text])) OR ((actor_profile.role = ANY (ARRAY['therapist'::text, 'staff'::text])) AND (COALESCE(actor_profile.is_lead_eligible, false) = true)))))))
- Managers and leads can read shift status changes [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor_profile<br> WHERE ((actor_profile.id = auth.uid()) AND ((actor_profile.role = ANY (ARRAY['manager'::text, 'lead'::text])) OR ((actor_profile.role = ANY (ARRAY['therapist'::text, 'staff'::text])) AND (COALESCE(actor_profile.is_lead_eligible, false) = true)))))); check=-

### public.shifts

Type: table; RLS: True; Approx rows: 993; Primary key: id

| Column                       | Data type                | Nullable | Default                        | PK  | Comment |
| ---------------------------- | ------------------------ | :------: | ------------------------------ | :-: | ------- |
| id                           | uuid                     |    NO    | uuid_generate_v4()             | yes | -       |
| cycle_id                     | uuid                     |   YES    | -                              |     | -       |
| user_id                      | uuid                     |   YES    | -                              |     | -       |
| date                         | date                     |    NO    | -                              |     | -       |
| shift_type                   | text                     |    NO    | -                              |     | -       |
| status                       | text                     |    NO    | 'scheduled'::text              |     | -       |
| created_at                   | timestamp with time zone |   YES    | now()                          |     | -       |
| role                         | public.shift_role        |    NO    | 'staff'::shift_role            |     | -       |
| site_id                      | text                     |    NO    | 'default'::text                |     | -       |
| assignment_status            | public.assignment_status |    NO    | 'scheduled'::assignment_status |     | -       |
| status_note                  | text                     |   YES    | -                              |     | -       |
| left_early_time              | time without time zone   |   YES    | -                              |     | -       |
| status_updated_at            | timestamp with time zone |   YES    | -                              |     | -       |
| status_updated_by            | uuid                     |   YES    | -                              |     | -       |
| availability_override        | boolean                  |    NO    | false                          |     | -       |
| availability_override_reason | text                     |   YES    | -                              |     | -       |
| availability_override_by     | uuid                     |   YES    | -                              |     | -       |
| availability_override_at     | timestamp with time zone |   YES    | -                              |     | -       |
| unfilled_reason              | text                     |   YES    | -                              |     | -       |

Constraints:

- shifts_shift_type_check [c]: CHECK ((shift_type = ANY (ARRAY['day'::text, 'night'::text])))
- shifts_status_check [c]: CHECK ((status = ANY (ARRAY['scheduled'::text, 'on_call'::text, 'sick'::text, 'called_off'::text])))
- shifts_availability_override_by_fkey [f]: FOREIGN KEY (availability_override_by) REFERENCES profiles(id) ON DELETE SET NULL
- shifts_cycle_id_fkey [f]: FOREIGN KEY (cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- shifts_status_updated_by_fkey [f]: FOREIGN KEY (status_updated_by) REFERENCES profiles(id) ON DELETE SET NULL
- shifts_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
- shifts_pkey [p]: PRIMARY KEY (id)
- shifts_unique_cycle_user_date [u]: UNIQUE (cycle_id, user_id, date) DEFERRABLE

Indexes:

- idx_shift_assignments_assignment_status: CREATE INDEX idx_shift_assignments_assignment_status ON public.shifts USING btree (assignment_status)
- idx_shift_assignments_status_updated_at: CREATE INDEX idx_shift_assignments_status_updated_at ON public.shifts USING btree (status_updated_at)
- shifts_assignment_status_idx: CREATE INDEX shifts_assignment_status_idx ON public.shifts USING btree (assignment_status, date DESC)
- shifts_availability_override_idx: CREATE INDEX shifts_availability_override_idx ON public.shifts USING btree (availability_override, date DESC)
- shifts_cycle_date_idx: CREATE INDEX shifts_cycle_date_idx ON public.shifts USING btree (cycle_id, date)
- shifts_pkey: CREATE UNIQUE INDEX shifts_pkey ON public.shifts USING btree (id)
- shifts_site_cycle_idx: CREATE INDEX shifts_site_cycle_idx ON public.shifts USING btree (site_id, cycle_id)
- shifts_site_id_idx: CREATE INDEX shifts_site_id_idx ON public.shifts USING btree (site_id)
- shifts_unfilled_reason_idx: CREATE INDEX shifts_unfilled_reason_idx ON public.shifts USING btree (cycle_id, date, shift_type) WHERE (unfilled_reason IS NOT NULL)
- shifts_unique_cycle_user_date: CREATE UNIQUE INDEX shifts_unique_cycle_user_date ON public.shifts USING btree (cycle_id, user_id, date)
- shifts_unique_designated_lead_per_slot_idx: CREATE UNIQUE INDEX shifts_unique_designated_lead_per_slot_idx ON public.shifts USING btree (cycle_id, date, shift_type) WHERE (role = 'lead'::shift_role)
- shifts_user_date_idx: CREATE INDEX shifts_user_date_idx ON public.shifts USING btree (user_id, date)

RLS policies:

- Active users can view same-site published shifts [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM (schedule_cycles cycle<br> JOIN profiles actor ON ((actor.id = auth.uid())))<br> WHERE ((cycle.id = shifts.cycle_id) AND (cycle.published = true) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id) AND (actor.site_id = cycle.site_id)))); check=-
- Leads can view same-site shifts [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'lead'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id)))); check=-
- Managers can delete same-site shifts [DELETE, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id)))); check=-
- Managers can insert same-site shifts [INSERT, PERMISSIVE, roles={authenticated}]: using=-; check=((EXISTS ( SELECT 1<br> FROM (profiles actor<br> JOIN schedule_cycles cycle ON ((cycle.id = shifts.cycle_id)))<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id) AND (actor.site_id = cycle.site_id)))) AND ((user_id IS NULL) OR (EXISTS ( SELECT 1<br> FROM profiles therapist<br> WHERE ((therapist.id = shifts.user_id) AND (therapist.role = ANY (ARRAY['therapist'::text, 'lead'::text])) AND (therapist.is_active = true) AND (therapist.archived_at IS NULL) AND (therapist.site_id = shifts.site_id))))))
- Managers can update same-site shifts [UPDATE, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id)))); check=((EXISTS ( SELECT 1<br> FROM (profiles actor<br> JOIN schedule_cycles cycle ON ((cycle.id = shifts.cycle_id)))<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id) AND (actor.site_id = cycle.site_id)))) AND ((user_id IS NULL) OR (EXISTS ( SELECT 1<br> FROM profiles therapist<br> WHERE ((therapist.id = shifts.user_id) AND (therapist.role = ANY (ARRAY['therapist'::text, 'lead'::text])) AND (therapist.is_active = true) AND (therapist.archived_at IS NULL) AND (therapist.site_id = shifts.site_id))))))
- Managers can view same-site shifts [SELECT, PERMISSIVE, roles={authenticated}]: using=(EXISTS ( SELECT 1<br> FROM profiles actor<br> WHERE ((actor.id = auth.uid()) AND (actor.role = 'manager'::text) AND (actor.is_active = true) AND (actor.archived_at IS NULL) AND (actor.site_id = shifts.site_id)))); check=-

### public.therapist_availability_submissions

Type: table; RLS: True; Approx rows: 10; Primary key: id

| Column            | Data type                | Nullable | Default           | PK  | Comment |
| ----------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| therapist_id      | uuid                     |    NO    | -                 |     | -       |
| schedule_cycle_id | uuid                     |    NO    | -                 |     | -       |
| submitted_at      | timestamp with time zone |    NO    | -                 |     | -       |
| last_edited_at    | timestamp with time zone |    NO    | -                 |     | -       |
| created_at        | timestamp with time zone |    NO    | now()             |     | -       |
| updated_at        | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- therapist_availability_submissions_schedule_cycle_id_fkey [f]: FOREIGN KEY (schedule_cycle_id) REFERENCES schedule_cycles(id) ON DELETE CASCADE
- therapist_availability_submissions_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- therapist_availability_submissions_pkey [p]: PRIMARY KEY (id)
- therapist_availability_submissions_unique_cycle [u]: UNIQUE (therapist_id, schedule_cycle_id)

Indexes:

- therapist_availability_submissions_cycle_idx: CREATE INDEX therapist_availability_submissions_cycle_idx ON public.therapist_availability_submissions USING btree (schedule_cycle_id)
- therapist_availability_submissions_pkey: CREATE UNIQUE INDEX therapist_availability_submissions_pkey ON public.therapist_availability_submissions USING btree (id)
- therapist_availability_submissions_therapist_idx: CREATE INDEX therapist_availability_submissions_therapist_idx ON public.therapist_availability_submissions USING btree (therapist_id)
- therapist_availability_submissions_unique_cycle: CREATE UNIQUE INDEX therapist_availability_submissions_unique_cycle ON public.therapist_availability_submissions USING btree (therapist_id, schedule_cycle_id)

RLS policies:

- Managers and leads can read all availability submissions [SELECT, PERMISSIVE, roles={public}]: using=(EXISTS ( SELECT 1<br> FROM profiles p<br> WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'lead'::text]))))); check=-
- Therapists can delete own availability submissions [DELETE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-
- Therapists can insert own availability submissions [INSERT, PERMISSIVE, roles={public}]: using=-; check=(auth.uid() = therapist_id)
- Therapists can read own availability submissions [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-
- Therapists can update own availability submissions [UPDATE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=(auth.uid() = therapist_id)

### public.work_patterns

Type: table; RLS: True; Approx rows: 24; Primary key: therapist_id

| Column              | Data type                | Nullable | Default              | PK  | Comment |
| ------------------- | ------------------------ | :------: | -------------------- | :-: | ------- |
| therapist_id        | uuid                     |    NO    | -                    | yes | -       |
| works_dow           | \_int2[]                 |    NO    | '{}'::smallint[]     |     | -       |
| offs_dow            | \_int2[]                 |    NO    | '{}'::smallint[]     |     | -       |
| weekend_rotation    | text                     |    NO    | 'none'::text         |     | -       |
| weekend_anchor_date | date                     |   YES    | -                    |     | -       |
| works_dow_mode      | text                     |    NO    | 'hard'::text         |     | -       |
| shift_preference    | text                     |    NO    | 'either'::text       |     | -       |
| created_at          | timestamp with time zone |    NO    | now()                |     | -       |
| updated_at          | timestamp with time zone |    NO    | now()                |     | -       |
| pattern_type        | text                     |    NO    | 'weekly_fixed'::text |     | -       |
| weekly_weekdays     | \_int2[]                 |    NO    | '{}'::smallint[]     |     | -       |
| weekend_rule        | text                     |    NO    | 'none'::text         |     | -       |
| cycle_anchor_date   | date                     |   YES    | -                    |     | -       |
| cycle_segments      | jsonb                    |    NO    | '[]'::jsonb          |     | -       |

Constraints:

- work_patterns_cycle_anchor_required_check [c]: CHECK (((pattern_type <> 'repeating_cycle'::text) OR (cycle_anchor_date IS NOT NULL)))
- work_patterns_cycle_segments_is_array_check [c]: CHECK ((jsonb_typeof(cycle_segments) = 'array'::text))
- work_patterns_every_other_weekend_anchor_required_check [c]: CHECK (((weekend_rule <> 'every_other_weekend'::text) OR (weekend_anchor_date IS NOT NULL)))
- work_patterns_offs_dow_values_check [c]: CHECK ((offs_dow <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]))
- work_patterns_pattern_type_check [c]: CHECK ((pattern_type = ANY (ARRAY['weekly_fixed'::text, 'weekly_with_weekend_rotation'::text, 'repeating_cycle'::text, 'none'::text])))
- work_patterns_weekend_anchor_required_check [c]: CHECK (((weekend_rotation <> 'every_other'::text) OR (weekend_anchor_date IS NOT NULL)))
- work_patterns_weekend_anchor_saturday_check [c]: CHECK (((weekend_rotation <> 'every_other'::text) OR (EXTRACT(dow FROM weekend_anchor_date) = (6)::numeric)))
- work_patterns_weekend_rotation_check [c]: CHECK ((weekend_rotation = ANY (ARRAY['none'::text, 'every_other'::text])))
- work_patterns_weekend_rule_check [c]: CHECK ((weekend_rule = ANY (ARRAY['none'::text, 'every_weekend'::text, 'every_other_weekend'::text])))
- work_patterns_weekly_weekdays_values_check [c]: CHECK ((weekly_weekdays <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]))
- work_patterns_works_dow_mode_check [c]: CHECK ((works_dow_mode = ANY (ARRAY['hard'::text, 'soft'::text])))
- work_patterns_works_dow_values_check [c]: CHECK ((works_dow <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]))
- work_patterns_therapist_id_fkey [f]: FOREIGN KEY (therapist_id) REFERENCES profiles(id) ON DELETE CASCADE
- work_patterns_pkey [p]: PRIMARY KEY (therapist_id)

Indexes:

- work_patterns_pkey: CREATE UNIQUE INDEX work_patterns_pkey ON public.work_patterns USING btree (therapist_id)
- work_patterns_weekend_rotation_idx: CREATE INDEX work_patterns_weekend_rotation_idx ON public.work_patterns USING btree (weekend_rotation)

RLS policies:

- Managers can modify all work patterns [ALL, PERMISSIVE, roles={public}]: using=is_manager(); check=is_manager()
- Managers can read all work patterns [SELECT, PERMISSIVE, roles={public}]: using=is_manager(); check=-
- Therapists can delete own work pattern [DELETE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-
- Therapists can insert own work pattern [INSERT, PERMISSIVE, roles={public}]: using=-; check=(auth.uid() = therapist_id)
- Therapists can read own work pattern [SELECT, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=-
- Therapists can update own work pattern [UPDATE, PERMISSIVE, roles={public}]: using=(auth.uid() = therapist_id); check=(auth.uid() = therapist_id)

### realtime.messages

Type: partitioned table; RLS: True; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_inserted_at_topic_index: CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_pkey: CREATE UNIQUE INDEX messages_pkey ON ONLY realtime.messages USING btree (id, inserted_at)

### realtime.messages_2026_04_14

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_14_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_14_inserted_at_topic_idx: CREATE INDEX messages_2026_04_14_inserted_at_topic_idx ON realtime.messages_2026_04_14 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_14_pkey: CREATE UNIQUE INDEX messages_2026_04_14_pkey ON realtime.messages_2026_04_14 USING btree (id, inserted_at)

### realtime.messages_2026_04_15

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_15_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_15_inserted_at_topic_idx: CREATE INDEX messages_2026_04_15_inserted_at_topic_idx ON realtime.messages_2026_04_15 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_15_pkey: CREATE UNIQUE INDEX messages_2026_04_15_pkey ON realtime.messages_2026_04_15 USING btree (id, inserted_at)

### realtime.messages_2026_04_16

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_16_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_16_inserted_at_topic_idx: CREATE INDEX messages_2026_04_16_inserted_at_topic_idx ON realtime.messages_2026_04_16 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_16_pkey: CREATE UNIQUE INDEX messages_2026_04_16_pkey ON realtime.messages_2026_04_16 USING btree (id, inserted_at)

### realtime.messages_2026_04_17

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_17_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_17_inserted_at_topic_idx: CREATE INDEX messages_2026_04_17_inserted_at_topic_idx ON realtime.messages_2026_04_17 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_17_pkey: CREATE UNIQUE INDEX messages_2026_04_17_pkey ON realtime.messages_2026_04_17 USING btree (id, inserted_at)

### realtime.messages_2026_04_18

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_18_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_18_inserted_at_topic_idx: CREATE INDEX messages_2026_04_18_inserted_at_topic_idx ON realtime.messages_2026_04_18 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_18_pkey: CREATE UNIQUE INDEX messages_2026_04_18_pkey ON realtime.messages_2026_04_18 USING btree (id, inserted_at)

### realtime.messages_2026_04_19

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_19_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_19_inserted_at_topic_idx: CREATE INDEX messages_2026_04_19_inserted_at_topic_idx ON realtime.messages_2026_04_19 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_19_pkey: CREATE UNIQUE INDEX messages_2026_04_19_pkey ON realtime.messages_2026_04_19 USING btree (id, inserted_at)

### realtime.messages_2026_04_20

Type: table; RLS: False; Approx rows: 0; Primary key: inserted_at, id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| topic       | text                        |    NO    | -                 |     | -       |
| extension   | text                        |    NO    | -                 |     | -       |
| payload     | jsonb                       |   YES    | -                 |     | -       |
| event       | text                        |   YES    | -                 |     | -       |
| private     | boolean                     |   YES    | false             |     | -       |
| updated_at  | timestamp without time zone |    NO    | now()             |     | -       |
| inserted_at | timestamp without time zone |    NO    | now()             | yes | -       |
| id          | uuid                        |    NO    | gen_random_uuid() | yes | -       |

Constraints:

- messages_2026_04_20_pkey [p]: PRIMARY KEY (id, inserted_at)

Indexes:

- messages_2026_04_20_inserted_at_topic_idx: CREATE INDEX messages_2026_04_20_inserted_at_topic_idx ON realtime.messages_2026_04_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE))
- messages_2026_04_20_pkey: CREATE UNIQUE INDEX messages_2026_04_20_pkey ON realtime.messages_2026_04_20 USING btree (id, inserted_at)

### realtime.schema_migrations

Type: table; RLS: False; Approx rows: 69; Primary key: version

| Column      | Data type                   | Nullable | Default | PK  | Comment |
| ----------- | --------------------------- | :------: | ------- | :-: | ------- |
| version     | bigint                      |    NO    | -       | yes | -       |
| inserted_at | timestamp without time zone |   YES    | -       |     | -       |

Constraints:

- schema_migrations_pkey [p]: PRIMARY KEY (version)

Indexes:

- schema_migrations_pkey: CREATE UNIQUE INDEX schema_migrations_pkey ON realtime.schema_migrations USING btree (version)

### realtime.subscription

Type: table; RLS: False; Approx rows: 0; Primary key: id

| Column          | Data type                   | Nullable | Default                              | PK  | Comment |
| --------------- | --------------------------- | :------: | ------------------------------------ | :-: | ------- |
| id              | bigint                      |    NO    | -                                    | yes | -       |
| subscription_id | uuid                        |    NO    | -                                    |     | -       |
| entity          | regclass                    |    NO    | -                                    |     | -       |
| filters         | \_user_defined_filter[]     |    NO    | '{}'::realtime.user_defined_filter[] |     | -       |
| claims          | jsonb                       |    NO    | -                                    |     | -       |
| claims_role     | regrole                     |    NO    | -                                    |     | -       |
| created_at      | timestamp without time zone |    NO    | timezone('utc'::text, now())         |     | -       |
| action_filter   | text                        |   YES    | '\*'::text                           |     | -       |

Constraints:

- subscription_action_filter_check [c]: CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
- pk_subscription [p]: PRIMARY KEY (id)

Indexes:

- ix_realtime_subscription_entity: CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity)
- pk_subscription: CREATE UNIQUE INDEX pk_subscription ON realtime.subscription USING btree (id)
- subscription_subscription_id_entity_filters_action_filter_key: CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter)

### storage.buckets

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column             | Data type                | Nullable | Default                        | PK  | Comment                                   |
| ------------------ | ------------------------ | :------: | ------------------------------ | :-: | ----------------------------------------- |
| id                 | text                     |    NO    | -                              | yes | -                                         |
| name               | text                     |    NO    | -                              |     | -                                         |
| owner              | uuid                     |   YES    | -                              |     | Field is deprecated, use owner_id instead |
| created_at         | timestamp with time zone |   YES    | now()                          |     | -                                         |
| updated_at         | timestamp with time zone |   YES    | now()                          |     | -                                         |
| public             | boolean                  |   YES    | false                          |     | -                                         |
| avif_autodetection | boolean                  |   YES    | false                          |     | -                                         |
| file_size_limit    | bigint                   |   YES    | -                              |     | -                                         |
| allowed_mime_types | \_text[]                 |   YES    | -                              |     | -                                         |
| owner_id           | text                     |   YES    | -                              |     | -                                         |
| type               | storage.buckettype       |    NO    | 'STANDARD'::storage.buckettype |     | -                                         |

Constraints:

- buckets_pkey [p]: PRIMARY KEY (id)

Indexes:

- bname: CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name)
- buckets_pkey: CREATE UNIQUE INDEX buckets_pkey ON storage.buckets USING btree (id)

### storage.buckets_analytics

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column     | Data type                | Nullable | Default                         | PK  | Comment |
| ---------- | ------------------------ | :------: | ------------------------------- | :-: | ------- |
| name       | text                     |    NO    | -                               |     | -       |
| type       | storage.buckettype       |    NO    | 'ANALYTICS'::storage.buckettype |     | -       |
| format     | text                     |    NO    | 'ICEBERG'::text                 |     | -       |
| created_at | timestamp with time zone |    NO    | now()                           |     | -       |
| updated_at | timestamp with time zone |    NO    | now()                           |     | -       |
| id         | uuid                     |    NO    | gen_random_uuid()               | yes | -       |
| deleted_at | timestamp with time zone |   YES    | -                               |     | -       |

Constraints:

- buckets_analytics_pkey [p]: PRIMARY KEY (id)

Indexes:

- buckets_analytics_pkey: CREATE UNIQUE INDEX buckets_analytics_pkey ON storage.buckets_analytics USING btree (id)
- buckets_analytics_unique_name_idx: CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL)

### storage.buckets_vectors

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column     | Data type                | Nullable | Default                      | PK  | Comment |
| ---------- | ------------------------ | :------: | ---------------------------- | :-: | ------- |
| id         | text                     |    NO    | -                            | yes | -       |
| type       | storage.buckettype       |    NO    | 'VECTOR'::storage.buckettype |     | -       |
| created_at | timestamp with time zone |    NO    | now()                        |     | -       |
| updated_at | timestamp with time zone |    NO    | now()                        |     | -       |

Constraints:

- buckets_vectors_pkey [p]: PRIMARY KEY (id)

Indexes:

- buckets_vectors_pkey: CREATE UNIQUE INDEX buckets_vectors_pkey ON storage.buckets_vectors USING btree (id)

### storage.migrations

Type: table; RLS: True; Approx rows: 57; Primary key: id

| Column      | Data type                   | Nullable | Default           | PK  | Comment |
| ----------- | --------------------------- | :------: | ----------------- | :-: | ------- |
| id          | integer                     |    NO    | -                 | yes | -       |
| name        | character varying           |    NO    | -                 |     | -       |
| hash        | character varying           |    NO    | -                 |     | -       |
| executed_at | timestamp without time zone |   YES    | CURRENT_TIMESTAMP |     | -       |

Constraints:

- migrations_pkey [p]: PRIMARY KEY (id)
- migrations_name_key [u]: UNIQUE (name)

Indexes:

- migrations_name_key: CREATE UNIQUE INDEX migrations_name_key ON storage.migrations USING btree (name)
- migrations_pkey: CREATE UNIQUE INDEX migrations_pkey ON storage.migrations USING btree (id)

### storage.objects

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column           | Data type                | Nullable | Default           | PK  | Comment                                   |
| ---------------- | ------------------------ | :------: | ----------------- | :-: | ----------------------------------------- |
| id               | uuid                     |    NO    | gen_random_uuid() | yes | -                                         |
| bucket_id        | text                     |   YES    | -                 |     | -                                         |
| name             | text                     |   YES    | -                 |     | -                                         |
| owner            | uuid                     |   YES    | -                 |     | Field is deprecated, use owner_id instead |
| created_at       | timestamp with time zone |   YES    | now()             |     | -                                         |
| updated_at       | timestamp with time zone |   YES    | now()             |     | -                                         |
| last_accessed_at | timestamp with time zone |   YES    | now()             |     | -                                         |
| metadata         | jsonb                    |   YES    | -                 |     | -                                         |
| path_tokens      | \_text[]                 |   YES    | -                 |     | -                                         |
| version          | text                     |   YES    | -                 |     | -                                         |
| owner_id         | text                     |   YES    | -                 |     | -                                         |
| user_metadata    | jsonb                    |   YES    | -                 |     | -                                         |

Constraints:

- objects_bucketId_fkey [f]: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
- objects_pkey [p]: PRIMARY KEY (id)

Indexes:

- bucketid_objname: CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name)
- idx_objects_bucket_id_name: CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C")
- idx_objects_bucket_id_name_lower: CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C")
- name_prefix_search: CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops)
- objects_pkey: CREATE UNIQUE INDEX objects_pkey ON storage.objects USING btree (id)

### storage.s3_multipart_uploads

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column           | Data type                | Nullable | Default | PK  | Comment |
| ---------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id               | text                     |    NO    | -       | yes | -       |
| in_progress_size | bigint                   |    NO    | 0       |     | -       |
| upload_signature | text                     |    NO    | -       |     | -       |
| bucket_id        | text                     |    NO    | -       |     | -       |
| key              | text                     |    NO    | -       |     | -       |
| version          | text                     |    NO    | -       |     | -       |
| owner_id         | text                     |   YES    | -       |     | -       |
| created_at       | timestamp with time zone |    NO    | now()   |     | -       |
| user_metadata    | jsonb                    |   YES    | -       |     | -       |

Constraints:

- s3_multipart_uploads_bucket_id_fkey [f]: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
- s3_multipart_uploads_pkey [p]: PRIMARY KEY (id)

Indexes:

- idx_multipart_uploads_list: CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at)
- s3_multipart_uploads_pkey: CREATE UNIQUE INDEX s3_multipart_uploads_pkey ON storage.s3_multipart_uploads USING btree (id)

### storage.s3_multipart_uploads_parts

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column      | Data type                | Nullable | Default           | PK  | Comment |
| ----------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id          | uuid                     |    NO    | gen_random_uuid() | yes | -       |
| upload_id   | text                     |    NO    | -                 |     | -       |
| size        | bigint                   |    NO    | 0                 |     | -       |
| part_number | integer                  |    NO    | -                 |     | -       |
| bucket_id   | text                     |    NO    | -                 |     | -       |
| key         | text                     |    NO    | -                 |     | -       |
| etag        | text                     |    NO    | -                 |     | -       |
| owner_id    | text                     |   YES    | -                 |     | -       |
| version     | text                     |    NO    | -                 |     | -       |
| created_at  | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- s3_multipart_uploads_parts_bucket_id_fkey [f]: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
- s3_multipart_uploads_parts_upload_id_fkey [f]: FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE
- s3_multipart_uploads_parts_pkey [p]: PRIMARY KEY (id)

Indexes:

- s3_multipart_uploads_parts_pkey: CREATE UNIQUE INDEX s3_multipart_uploads_parts_pkey ON storage.s3_multipart_uploads_parts USING btree (id)

### storage.vector_indexes

Type: table; RLS: True; Approx rows: 0; Primary key: id

| Column                 | Data type                | Nullable | Default           | PK  | Comment |
| ---------------------- | ------------------------ | :------: | ----------------- | :-: | ------- |
| id                     | text                     |    NO    | gen_random_uuid() | yes | -       |
| name                   | text                     |    NO    | -                 |     | -       |
| bucket_id              | text                     |    NO    | -                 |     | -       |
| data_type              | text                     |    NO    | -                 |     | -       |
| dimension              | integer                  |    NO    | -                 |     | -       |
| distance_metric        | text                     |    NO    | -                 |     | -       |
| metadata_configuration | jsonb                    |   YES    | -                 |     | -       |
| created_at             | timestamp with time zone |    NO    | now()             |     | -       |
| updated_at             | timestamp with time zone |    NO    | now()             |     | -       |

Constraints:

- vector_indexes_bucket_id_fkey [f]: FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id)
- vector_indexes_pkey [p]: PRIMARY KEY (id)

Indexes:

- vector_indexes_name_bucket_id_idx: CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id)
- vector_indexes_pkey: CREATE UNIQUE INDEX vector_indexes_pkey ON storage.vector_indexes USING btree (id)

### supabase_migrations.schema_migrations

Type: table; RLS: False; Approx rows: 96; Primary key: version

| Column          | Data type | Nullable | Default | PK  | Comment |
| --------------- | --------- | :------: | ------- | :-: | ------- |
| version         | text      |    NO    | -       | yes | -       |
| statements      | \_text[]  |   YES    | -       |     | -       |
| name            | text      |   YES    | -       |     | -       |
| created_by      | text      |   YES    | -       |     | -       |
| idempotency_key | text      |   YES    | -       |     | -       |
| rollback        | \_text[]  |   YES    | -       |     | -       |

Constraints:

- schema_migrations_pkey [p]: PRIMARY KEY (version)
- schema_migrations_idempotency_key_key [u]: UNIQUE (idempotency_key)

Indexes:

- schema_migrations_idempotency_key_key: CREATE UNIQUE INDEX schema_migrations_idempotency_key_key ON supabase_migrations.schema_migrations USING btree (idempotency_key)
- schema_migrations_pkey: CREATE UNIQUE INDEX schema_migrations_pkey ON supabase_migrations.schema_migrations USING btree (version)

### vault.decrypted_secrets

Type: view; RLS: False; Approx rows: -1; Primary key: none

| Column           | Data type                | Nullable | Default | PK  | Comment |
| ---------------- | ------------------------ | :------: | ------- | :-: | ------- |
| id               | uuid                     |   YES    | -       |     | -       |
| name             | text                     |   YES    | -       |     | -       |
| description      | text                     |   YES    | -       |     | -       |
| secret           | text                     |   YES    | -       |     | -       |
| decrypted_secret | text                     |   YES    | -       |     | -       |
| key_id           | uuid                     |   YES    | -       |     | -       |
| nonce            | bytea                    |   YES    | -       |     | -       |
| created_at       | timestamp with time zone |   YES    | -       |     | -       |
| updated_at       | timestamp with time zone |   YES    | -       |     | -       |

Constraints:

- []: -

Indexes:

- : -

### vault.secrets

Type: table; RLS: False; Approx rows: 0; Primary key: id
Comment: Table with encrypted `secret` column for storing sensitive information on disk.

| Column      | Data type                | Nullable | Default                            | PK  | Comment |
| ----------- | ------------------------ | :------: | ---------------------------------- | :-: | ------- |
| id          | uuid                     |    NO    | gen_random_uuid()                  | yes | -       |
| name        | text                     |   YES    | -                                  |     | -       |
| description | text                     |    NO    | ''::text                           |     | -       |
| secret      | text                     |    NO    | -                                  |     | -       |
| key_id      | uuid                     |   YES    | -                                  |     | -       |
| nonce       | bytea                    |   YES    | vault.\_crypto_aead_det_noncegen() |     | -       |
| created_at  | timestamp with time zone |    NO    | CURRENT_TIMESTAMP                  |     | -       |
| updated_at  | timestamp with time zone |    NO    | CURRENT_TIMESTAMP                  |     | -       |

Constraints:

- secrets_pkey [p]: PRIMARY KEY (id)

Indexes:

- secrets_name_idx: CREATE UNIQUE INDEX secrets_name_idx ON vault.secrets USING btree (name) WHERE (name IS NOT NULL)
- secrets_pkey: CREATE UNIQUE INDEX secrets_pkey ON vault.secrets USING btree (id)
