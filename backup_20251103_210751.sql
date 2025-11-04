--
-- PostgreSQL database dump
--

\restrict QGKLm3lhmghn6SDBYX3eb2rASxvVbLIvgBo9nWnTPDfTAQQ1gagc50Rldkg30hi

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_users OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    operator_email text NOT NULL,
    operator_name text NOT NULL,
    tenant_id text NOT NULL,
    tenant_name text NOT NULL,
    target_user_upn text NOT NULL,
    target_user_name text NOT NULL,
    target_user_id text,
    change_type text NOT NULL,
    change_description text NOT NULL,
    phone_number text,
    routing_policy text,
    previous_phone_number text,
    previous_routing_policy text,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: configuration_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuration_profiles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    profile_name text NOT NULL,
    phone_number_prefix text NOT NULL,
    default_routing_policy text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.configuration_profiles OWNER TO postgres;

--
-- Name: customer_tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_tenants (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    tenant_name text NOT NULL,
    app_registration_id text,
    app_registration_secret text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_tenants OWNER TO postgres;

--
-- Name: operator_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operator_config (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    azure_tenant_id text NOT NULL,
    azure_client_id text NOT NULL,
    azure_client_secret text NOT NULL,
    redirect_uri text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.operator_config OWNER TO postgres;

--
-- Name: operator_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operator_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    azure_user_id text NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.operator_users OWNER TO postgres;

--
-- Name: tenant_powershell_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_powershell_credentials (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    username text NOT NULL,
    encrypted_password text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_powershell_credentials OWNER TO postgres;

--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_users (id, username, password, created_at) FROM stdin;
8e04f928-b8b4-4d36-bfe9-0881c5fd3bef	admin	$2b$10$yE/o/4kYSwCd.AxmrJVccO8v3JaRbXWQjyqjHWu8c0jpwedKDy4eu	2025-10-31 04:28:54.866368
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, operator_email, operator_name, tenant_id, tenant_name, target_user_upn, target_user_name, target_user_id, change_type, change_description, phone_number, routing_policy, previous_phone_number, previous_routing_policy, status, error_message, "timestamp") FROM stdin;
e77f324a-8516-40c8-b644-78f5685f5ed2	DevUser@ucrdev.onmicrosoft.com	Randy Bowles	905655b8-88f2-4fc8-9474-a4f2b0283b03	Dev Tenant	32b96d76-01df-49f5-a6c7-92ab81bfa961	Unknown	\N	voice_configuration_failed	Failed to assign phone number tel:+15554441212 and routing policy global	tel:+15554441212	global	\N	\N	failed	Failed to assign voice routing policy: BadRequest - Resource not found for the segment 'teamsPolicies'.. Phone number assignment requires PowerShell.	2025-10-31 07:24:49.053091
\.


--
-- Data for Name: configuration_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuration_profiles (id, tenant_id, profile_name, phone_number_prefix, default_routing_policy, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_tenants (id, tenant_id, tenant_name, app_registration_id, app_registration_secret, is_active, created_at, updated_at) FROM stdin;
83f508e2-0b8b-41da-9dba-8a329305c13e	905655b8-88f2-4fc8-9474-a4f2b0283b03	Dev Tenant	49a0a397-2cba-4e2c-82e5-6e2b042b1f29	ca1e2bfe2f95a87f7f8aa49e3be6eba32f1b2e94e862362f6cadf7ca6297a803270620e226172685d98dc674e4b064e5d7275d8f27b234602b102b0c76b8ce1417c3f68e07e0002f	t	2025-10-31 04:41:41.118925	2025-10-31 04:41:41.118925
\.


--
-- Data for Name: operator_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.operator_config (id, azure_tenant_id, azure_client_id, azure_client_secret, redirect_uri, created_at, updated_at) FROM stdin;
16bc9932-202a-4efb-97bd-5bdea1187529	905655b8-88f2-4fc8-9474-a4f2b0283b03	84592808-09ee-4f20-9f92-c65f45f6451b	8dce2724c8b4e06b733df5a6ab15bcbb3f0421eda0d310204ab211d6bf199aa380313e467dc6fb3925657e406b9a377a105c1b6daed528c7a6c32209ce949dbe4540f764c63b064f	https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback	2025-10-31 04:39:25.964607	2025-10-31 04:40:12.355
\.


--
-- Data for Name: operator_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.operator_users (id, azure_user_id, email, display_name, role, is_active, created_at, updated_at) FROM stdin;
0aee65a1-5306-473d-88cd-5e2f193265cf	32b96d76-01df-49f5-a6c7-92ab81bfa961	DevUser@ucrdev.onmicrosoft.com	Randy Bowles	admin	t	2025-10-31 06:13:15.3136	2025-10-31 06:23:46.757
d848a146-01cd-4d4f-82a9-8e755f921a24	4c2e9204-a92d-447e-aac1-a7a1fc1f1293	TeamsManagerServiceAccount@UCRDev.net	TeamsManager ServiceAccount	user	t	2025-10-31 07:46:47.887096	2025-10-31 07:46:47.887096
\.


--
-- Data for Name: tenant_powershell_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_powershell_credentials (id, tenant_id, username, encrypted_password, description, is_active, created_at, updated_at) FROM stdin;
1062448c-8e2b-4bfd-a7fd-47d6f1d0078f	83f508e2-0b8b-41da-9dba-8a329305c13e	TeamsManagerServiceAccount@UCRDev.net	b5a80dd16c159f86544f12195272e0c35d16c47123c55b4054130e7ff42cc2c90be3da7ceb9b79c516a7126b6e25ea1f		t	2025-10-31 07:12:58.377092	2025-10-31 07:12:58.377092
\.


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_unique UNIQUE (username);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: configuration_profiles configuration_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_profiles
    ADD CONSTRAINT configuration_profiles_pkey PRIMARY KEY (id);


--
-- Name: customer_tenants customer_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tenants
    ADD CONSTRAINT customer_tenants_pkey PRIMARY KEY (id);


--
-- Name: customer_tenants customer_tenants_tenant_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tenants
    ADD CONSTRAINT customer_tenants_tenant_id_unique UNIQUE (tenant_id);


--
-- Name: operator_config operator_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_config
    ADD CONSTRAINT operator_config_pkey PRIMARY KEY (id);


--
-- Name: operator_users operator_users_azure_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_users
    ADD CONSTRAINT operator_users_azure_user_id_unique UNIQUE (azure_user_id);


--
-- Name: operator_users operator_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_users
    ADD CONSTRAINT operator_users_pkey PRIMARY KEY (id);


--
-- Name: tenant_powershell_credentials tenant_powershell_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_powershell_credentials
    ADD CONSTRAINT tenant_powershell_credentials_pkey PRIMARY KEY (id);


--
-- Name: tenant_powershell_credentials tenant_powershell_credentials_tenant_id_customer_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_powershell_credentials
    ADD CONSTRAINT tenant_powershell_credentials_tenant_id_customer_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.customer_tenants(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict QGKLm3lhmghn6SDBYX3eb2rASxvVbLIvgBo9nWnTPDfTAQQ1gagc50Rldkg30hi

