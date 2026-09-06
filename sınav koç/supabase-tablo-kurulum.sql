-- ============================================================
-- KPSS Koç / Kişisel Dijital Sınav Koçu — Supabase Şeması
-- Bu kodu Supabase panelinde "SQL Editor" sayfasına yapıştırıp "Run" ile çalıştırın.
-- ============================================================
-- Bu şema üç katmandan oluşur:
--   1) Sınav kataloğu (public read)   : exams, exam_programs, subjects, topics
--   2) Kullanıcı verisi (RLS korumalı): user_profiles, user_topics, user_exams,
--                                         user_exam_subjects, daily_logs, daily_log_tasks
--   3) Abonelik (gelecek için)         : subscriptions
-- ============================================================

-- ============================================================
-- 0) UZANTILAR
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) SINAV KATALOĞU — Tüm kullanıcılar okuyabilir.
-- ============================================================

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 'kpss_ortaogretim', 'yks', 'lgs'
  name text not null,                       -- 'KPSS Ortaöğretim'
  short_label text not null,                -- 'KPSS'
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_programs (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  code text not null,                       -- 'gy', 'tyt', 'ayt', 'hepsi'
  name text not null,                       -- 'Genel Yetenek', 'TYT', 'AYT', 'TYT + AYT'
  sort_order int not null default 0,
  unique (exam_id, code)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.exam_programs(id) on delete cascade,
  key text not null,                        -- 'turkce', 'matematik'
  name text not null,
  color text not null default '#4F46E5',
  sort_order int not null default 0,
  question_count int not null default 30,   -- Bu dersten denemede toplam soru
  wrong_penalty_divisor int not null default 4,
  unique (program_id, key)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (subject_id, name)
);

-- Katalog tabloları için RLS: sadece okuma herkese açık, yazma yok (admin paneli V2'de).
alter table public.exams enable row level security;
alter table public.exam_programs enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;

drop policy if exists "Katalog herkes okuyabilir" on public.exams;
create policy "Katalog herkes okuyabilir" on public.exams
  for select using (active = true);

drop policy if exists "Katalog herkes okuyabilir" on public.exam_programs;
create policy "Katalog herkes okuyabilir" on public.exam_programs
  for select using (true);

drop policy if exists "Katalog herkes okuyabilir" on public.subjects;
create policy "Katalog herkes okuyabilir" on public.subjects
  for select using (true);

drop policy if exists "Katalog herkes okuyabilir" on public.topics;
create policy "Katalog herkes okuyabilir" on public.topics
  for select using (active = true);

-- ============================================================
-- 2) KULLANICI VERİSİ — RLS ile sıkı koruma
-- ============================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  exam_id uuid references public.exams(id),
  program_id uuid references public.exam_programs(id),
  exam_date date,
  target_score numeric,
  target_net numeric,
  target_rank int,
  daily_goal_minutes int not null default 180,
  weekly_goal_minutes int not null default 1200,
  wrong_penalty_divisor int not null default 4,
  theme text not null default 'light',
  onboarded boolean not null default false,
  demo_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  status text not null default 'not_started',  -- not_started|studying|completed|review_needed|weak|strong
  study_count int not null default 0,
  last_study_date date,
  correct int not null default 0,
  wrong int not null default 0,
  blank int not null default 0,
  last_review_date date,
  next_review_date date,
  importance text not null default 'medium',     -- low|medium|high
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create table if not exists public.user_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_date date not null,
  total_duration_minutes int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_exam_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.user_exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  correct int not null default 0,
  wrong int not null default 0,
  blank int not null default 0,
  unique (exam_id, subject_id)
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists public.daily_log_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  topic_id uuid references public.topics(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_name_snapshot text not null,           -- konu silinse bile eski veri kaybolmasın
  subject_name_snapshot text not null,
  duration int not null,
  scheduled_time time,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3) ABONELİK — Gelecekte ödeme entegrasyonu için
-- ============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  status text not null default 'trial',        -- trial|active|expired|cancelled
  plan text not null default 'free',          -- free|premium_monthly|premium_yearly
  start_date timestamptz,
  end_date timestamptz,
  renewal_date timestamptz,
  provider text,                              -- 'iyzico'|'stripe'|null
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4) RLS — Tüm kullanıcı tablolarında
-- ============================================================

alter table public.user_profiles enable row level security;
alter table public.user_topics enable row level security;
alter table public.user_exams enable row level security;
alter table public.user_exam_subjects enable row level security;
alter table public.daily_logs enable row level security;
alter table public.daily_log_tasks enable row level security;
alter table public.subscriptions enable row level security;

-- user_profiles
drop policy if exists "user_profiles_select" on public.user_profiles;
create policy "user_profiles_select" on public.user_profiles for select using (auth.uid() = user_id);
drop policy if exists "user_profiles_insert" on public.user_profiles;
create policy "user_profiles_insert" on public.user_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "user_profiles_update" on public.user_profiles;
create policy "user_profiles_update" on public.user_profiles for update using (auth.uid() = user_id);
drop policy if exists "user_profiles_delete" on public.user_profiles;
create policy "user_profiles_delete" on public.user_profiles for delete using (auth.uid() = user_id);

-- user_topics
drop policy if exists "user_topics_select" on public.user_topics;
create policy "user_topics_select" on public.user_topics for select using (auth.uid() = user_id);
drop policy if exists "user_topics_insert" on public.user_topics;
create policy "user_topics_insert" on public.user_topics for insert with check (auth.uid() = user_id);
drop policy if exists "user_topics_update" on public.user_topics;
create policy "user_topics_update" on public.user_topics for update using (auth.uid() = user_id);
drop policy if exists "user_topics_delete" on public.user_topics;
create policy "user_topics_delete" on public.user_topics for delete using (auth.uid() = user_id);

-- user_exams
drop policy if exists "user_exams_select" on public.user_exams;
create policy "user_exams_select" on public.user_exams for select using (auth.uid() = user_id);
drop policy if exists "user_exams_insert" on public.user_exams;
create policy "user_exams_insert" on public.user_exams for insert with check (auth.uid() = user_id);
drop policy if exists "user_exams_update" on public.user_exams;
create policy "user_exams_update" on public.user_exams for update using (auth.uid() = user_id);
drop policy if exists "user_exams_delete" on public.user_exams;
create policy "user_exams_delete" on public.user_exams for delete using (auth.uid() = user_id);

-- user_exam_subjects
drop policy if exists "user_exam_subjects_select" on public.user_exam_subjects;
create policy "user_exam_subjects_select" on public.user_exam_subjects for select using (auth.uid() = user_id);
drop policy if exists "user_exam_subjects_insert" on public.user_exam_subjects;
create policy "user_exam_subjects_insert" on public.user_exam_subjects for insert with check (auth.uid() = user_id);
drop policy if exists "user_exam_subjects_update" on public.user_exam_subjects;
create policy "user_exam_subjects_update" on public.user_exam_subjects for update using (auth.uid() = user_id);
drop policy if exists "user_exam_subjects_delete" on public.user_exam_subjects;
create policy "user_exam_subjects_delete" on public.user_exam_subjects for delete using (auth.uid() = user_id);

-- daily_logs
drop policy if exists "daily_logs_select" on public.daily_logs;
create policy "daily_logs_select" on public.daily_logs for select using (auth.uid() = user_id);
drop policy if exists "daily_logs_insert" on public.daily_logs;
create policy "daily_logs_insert" on public.daily_logs for insert with check (auth.uid() = user_id);
drop policy if exists "daily_logs_update" on public.daily_logs;
create policy "daily_logs_update" on public.daily_logs for update using (auth.uid() = user_id);
drop policy if exists "daily_logs_delete" on public.daily_logs;
create policy "daily_logs_delete" on public.daily_logs for delete using (auth.uid() = user_id);

-- daily_log_tasks
drop policy if exists "daily_log_tasks_select" on public.daily_log_tasks;
create policy "daily_log_tasks_select" on public.daily_log_tasks for select using (auth.uid() = user_id);
drop policy if exists "daily_log_tasks_insert" on public.daily_log_tasks;
create policy "daily_log_tasks_insert" on public.daily_log_tasks for insert with check (auth.uid() = user_id);
drop policy if exists "daily_log_tasks_update" on public.daily_log_tasks;
create policy "daily_log_tasks_update" on public.daily_log_tasks for update using (auth.uid() = user_id);
drop policy if exists "daily_log_tasks_delete" on public.daily_log_tasks;
create policy "daily_log_tasks_delete" on public.daily_log_tasks for delete using (auth.uid() = user_id);

-- subscriptions
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions for select using (auth.uid() = user_id);

-- ============================================================
-- 5) INDEXLER — Sık sorgulanan kolonlar
-- ============================================================
create index if not exists idx_user_topics_user on public.user_topics (user_id);
create index if not exists idx_user_exams_user_date on public.user_exams (user_id, exam_date desc);
create index if not exists idx_user_exam_subjects_exam on public.user_exam_subjects (exam_id);
create index if not exists idx_user_exam_subjects_user on public.user_exam_subjects (user_id);
create index if not exists idx_daily_logs_user_date on public.daily_logs (user_id, log_date desc);
create index if not exists idx_daily_log_tasks_user_date on public.daily_log_tasks (user_id, log_date desc);
create index if not exists idx_exam_programs_exam on public.exam_programs (exam_id);
create index if not exists idx_subjects_program on public.subjects (program_id);
create index if not exists idx_topics_subject on public.topics (subject_id);

-- ============================================================
-- 6) SEED: KPSS + YKS + LGS katalog verisi
-- ============================================================

-- KPSS
insert into public.exams (code, name, short_label, description, sort_order) values
  ('kpss_ortaogretim', 'KPSS Ortaöğretim', 'KPSS', 'Ortaöğretim düzeyinde KPSS hazırlık', 10)
on conflict (code) do nothing;

-- YKS
insert into public.exams (code, name, short_label, description, sort_order) values
  ('yks', 'YKS (TYT + AYT)', 'YKS', 'Yükseköğretim Kurumları Sınavı', 20)
on conflict (code) do nothing;

-- LGS
insert into public.exams (code, name, short_label, description, sort_order) values
  ('lgs', 'LGS', 'LGS', 'Liselere Geçiş Sınavı', 30)
on conflict (code) do nothing;

-- ============== KPSS PROGRAMLARI ==============
do $$
declare
  e_id uuid;
  p_gy uuid; p_gk uuid; p_gygk uuid;
begin
  select id into e_id from public.exams where code = 'kpss_ortaogretim';

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'gy', 'Genel Yetenek', 10)
    on conflict (exam_id, code) do nothing
    returning id into p_gy;
  if p_gy is null then select id into p_gy from public.exam_programs where exam_id = e_id and code = 'gy'; end if;

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'gk', 'Genel Kültür', 20)
    on conflict (exam_id, code) do nothing
    returning id into p_gk;
  if p_gk is null then select id into p_gk from public.exam_programs where exam_id = e_id and code = 'gk'; end if;

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'hepsi', 'Genel Yetenek + Genel Kültür', 30)
    on conflict (exam_id, code) do nothing
    returning id into p_gygk;
  if p_gygk is null then select id into p_gygk from public.exam_programs where exam_id = e_id and code = 'hepsi'; end if;

  -- KPSS Genel Yetenek dersleri
  insert into public.subjects (program_id, key, name, color, sort_order, question_count) values
    (p_gy, 'turkce',     'Türkçe',     '#4F46E5', 10, 30),
    (p_gy, 'matematik',  'Matematik',  '#7C3AED', 20, 30)
  on conflict (program_id, key) do nothing;

  insert into public.subjects (program_id, key, name, color, sort_order, question_count) values
    (p_gk, 'tarih',       'Tarih',        '#0891B2', 10, 27),
    (p_gk, 'cografya',    'Coğrafya',     '#059669', 20, 18),
    (p_gk, 'vatandaslik', 'Vatandaşlık',  '#D97706', 30, 9),
    (p_gk, 'guncel',      'Güncel Bilgiler','#DC2626', 40, 6)
  on conflict (program_id, key) do nothing;

  -- Konular — Türkçe
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('Sözcükte Anlam',1),('Cümlede Anlam',2),('Paragraf',3),('Sözcük Türleri',4),
      ('Fiiller',5),('Cümlenin Ögeleri',6),('Cümle Türleri',7),('Yazım Kuralları',8),
      ('Noktalama İşaretleri',9),('Ses Bilgisi',10),('Anlatım Bozukluğu',11)
    ) as t(name, sort_order) on true
    where s.key = 'turkce' and s.program_id = p_gy
    on conflict (subject_id, name) do nothing;

  -- Konular — Matematik
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('Temel Kavramlar',1),('Sayılar',2),('Bölme-Bölünebilme',3),('EBOB-EKOK',4),
      ('Rasyonel Sayılar',5),('Ondalık Sayılar',6),('Basit Eşitsizlik',7),('Mutlak Değer',8),
      ('Üslü Sayılar',9),('Köklü Sayılar',10),('Oran-Orantı',11),('Problemler',12),
      ('Kümeler',13),('Fonksiyonlar',14),('Permütasyon',15),('Kombinasyon',16),
      ('Olasılık',17),('Veri ve Grafikler',18),('Geometri',19)
    ) as t(name, sort_order) on true
    where s.key = 'matematik' and s.program_id = p_gy
    on conflict (subject_id, name) do nothing;

  -- Konular — Tarih
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('İlk Türk Devletleri',1),('Türk-İslam Devletleri',2),('Osmanlı Devleti',3),
      ('Osmanlı Kültür ve Medeniyeti',4),('XX. Yüzyıl Osmanlı',5),('Milli Mücadele',6),
      ('Atatürk İlke ve İnkılapları',7),('Cumhuriyet Dönemi',8),('Çağdaş Türk ve Dünya Tarihi',9)
    ) as t(name, sort_order) on true
    where s.key = 'tarih' and s.program_id = p_gk
    on conflict (subject_id, name) do nothing;

  -- Konular — Coğrafya
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('Türkiye''nin Coğrafi Konumu',1),('İklim',2),('Yer Şekilleri',3),('Nüfus',4),
      ('Göç',5),('Tarım',6),('Hayvancılık',7),('Madenler',8),('Enerji Kaynakları',9),
      ('Sanayi',10),('Ulaşım',11),('Turizm',12),('Bölgeler',13)
    ) as t(name, sort_order) on true
    where s.key = 'cografya' and s.program_id = p_gk
    on conflict (subject_id, name) do nothing;

  -- Konular — Vatandaşlık
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('Hukukun Temel Kavramları',1),('Anayasa',2),('Temel Hak ve Ödevler',3),
      ('Yasama',4),('Yürütme',5),('Yargı',6),('İdare',7),('Güncel Anayasal Bilgiler',8)
    ) as t(name, sort_order) on true
    where s.key = 'vatandaslik' and s.program_id = p_gk
    on conflict (subject_id, name) do nothing;

  -- Konular — Güncel Bilgiler
  insert into public.topics (subject_id, name, sort_order)
    select s.id, t.name, t.sort_order
    from public.subjects s
    join (values
      ('Türkiye''deki Güncel Gelişmeler',1),('Dünyadaki Önemli Gelişmeler',2),
      ('Kurumlar',3),('Önemli Kişiler',4),('Ödüller',5),
      ('Uluslararası Kuruluşlar',6),('Güncel Kültür/Sanat/Spor/Bilim',7)
    ) as t(name, sort_order) on true
    where s.key = 'guncel' and s.program_id = p_gk
    on conflict (subject_id, name) do nothing;
end$$;

-- ============== YKS PROGRAMLARI ==============
do $$
declare
  e_id uuid;
  p_tyt uuid; p_ayt uuid; p_hepsi uuid;
  s_tyt_turkce uuid; s_tyt_mat uuid; s_tyt_fen uuid; s_tyt_sos uuid;
  s_ayt_mat uuid; s_ayt_fiz uuid; s_ayt_kim uuid; s_ayt_bio uuid;
begin
  select id into e_id from public.exams where code = 'yks';

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'tyt', 'TYT', 10)
    on conflict (exam_id, code) do nothing
    returning id into p_tyt;
  if p_tyt is null then select id into p_tyt from public.exam_programs where exam_id = e_id and code = 'tyt'; end if;

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'ayt', 'AYT', 20)
    on conflict (exam_id, code) do nothing
    returning id into p_ayt;
  if p_ayt is null then select id into p_ayt from public.exam_programs where exam_id = e_id and code = 'ayt'; end if;

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'hepsi', 'TYT + AYT', 30)
    on conflict (exam_id, code) do nothing
    returning id into p_hepsi;
  if p_hepsi is null then select id into p_hepsi from public.exam_programs where exam_id = e_id and code = 'hepsi'; end if;

  -- TYT Dersleri
  insert into public.subjects (program_id, key, name, color, sort_order, question_count) values
    (p_tyt, 'turkce',  'Türkçe',          '#4F46E5', 10, 40),
    (p_tyt, 'matematik','Temel Matematik','#7C3AED', 20, 40),
    (p_tyt, 'fen',      'Fen Bilimleri',  '#059669', 30, 20),
    (p_tyt, 'sosyal',   'Sosyal Bilimler','#D97706', 40, 20)
  on conflict (program_id, key) do nothing
  returning id into s_tyt_turkce; -- bu doldurulmayacak

  select id into s_tyt_turkce from public.subjects where program_id = p_tyt and key = 'turkce';
  select id into s_tyt_mat from public.subjects where program_id = p_tyt and key = 'matematik';
  select id into s_tyt_fen from public.subjects where program_id = p_tyt and key = 'fen';
  select id into s_tyt_sos from public.subjects where program_id = p_tyt and key = 'sosyal';

  -- TYT Türkçe Konuları
  insert into public.topics (subject_id, name, sort_order)
    select s_tyt_turkce, t.name, t.sort_order from (values
      ('Sözcükte Anlam',1),('Cümlede Anlam',2),('Paragraf',3),('Ses Bilgisi',4),
      ('Yazım Kuralları',5),('Noktalama İşaretleri',6),('Sözcük Türleri',7),
      ('Cümlenin Ögeleri',8),('Cümle Türleri',9),('Anlatım Bozukluğu',10)
    ) as t(name, sort_order)
    on conflict do nothing;

  -- TYT Matematik Konuları
  insert into public.topics (subject_id, name, sort_order)
    select s_tyt_mat, t.name, t.sort_order from (values
      ('Temel Kavramlar',1),('Sayı Basamakları',2),('Bölme-Bölünebilme',3),('EBOB-EKOK',4),
      ('Rasyonel Sayılar',5),('Basit Eşitsizlik',6),('Mutlak Değer',7),('Üslü Sayılar',8),
      ('Köklü Sayılar',9),('Oran-Orantı',10),('Problemler',11),('Kümeler',12),
      ('Fonksiyonlar',13),('Permütasyon-Kombinasyon',14),('Olasılık',15),('Veri-İstatistik',16),
      ('Geometri (Doğrular)',17),('Üçgenler',18),('Açılar',19),('Çokgenler',20),('Daire',21)
    ) as t(name, sort_order)
    on conflict do nothing;

  -- TYT Fen Bilimleri Konuları
  insert into public.topics (subject_id, name, sort_order)
    select s_tyt_fen, t.name, t.sort_order from (values
      ('Fizik: Hareket',1),('Fizik: Kuvvet',2),('Fizik: Enerji',3),
      ('Kimya: Madde ve Özellikleri',4),('Kimya: Atom',5),('Kimya: Periyodik Tablo',6),
      ('Biyoloji: Canlılar',7),('Biyoloji: Hücre',8),('Biyoloji: Sistemler',9)
    ) as t(name, sort_order)
    on conflict do nothing;

  -- TYT Sosyal Bilimler Konuları
  insert into public.topics (subject_id, name, sort_order)
    select s_tyt_sos, t.name, t.sort_order from (values
      ('Tarih: İlk Çağ',1),('Tarih: Osmanlı',2),('Tarih: Cumhuriyet',3),
      ('Coğrafya: Doğa',4),('Coğrafya: Nüfus',5),('Coğrafya: Ekonomi',6),
      ('Felsefe',7),('Din Kültürü',8)
    ) as t(name, sort_order)
    on conflict do nothing;

  -- AYT Dersleri (Sayısal)
  insert into public.subjects (program_id, key, name, color, sort_order, question_count) values
    (p_ayt, 'matematik', 'AYT Matematik', '#7C3AED', 10, 40),
    (p_ayt, 'fizik',     'Fizik',         '#0891B2', 20, 14),
    (p_ayt, 'kimya',     'Kimya',         '#059669', 30, 13),
    (p_ayt, 'biyoloji',  'Biyoloji',      '#DC2626', 40, 13)
  on conflict (program_id, key) do nothing;

  select id into s_ayt_mat from public.subjects where program_id = p_ayt and key = 'matematik';
  select id into s_ayt_fiz from public.subjects where program_id = p_ayt and key = 'fizik';
  select id into s_ayt_kim from public.subjects where program_id = p_ayt and key = 'kimya';
  select id into s_ayt_bio from public.subjects where program_id = p_ayt and key = 'biyoloji';

  insert into public.topics (subject_id, name, sort_order)
    select s_ayt_mat, t.name, t.sort_order from (values
      ('Fonksiyonlar',1),('Polinomlar',2),('İkinci Dereceden Denklemler',3),('Trigonometri',4),
      ('Logaritma',5),('Diziler',6),('Limit',7),('Türev',8),('İntegral',9)
    ) as t(name, sort_order)
    on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_ayt_fiz, t.name, t.sort_order from (values
      ('Vektörler',1),('Bağıl Hareket',2),('Atışlar',3),('İş-Güç-Enerji',4),
      ('Elektrostatik',5),('Elektrik Akımı',6),('Manyetizma',7),('Dalgalar',8),('Optik',9)
    ) as t(name, sort_order)
    on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_ayt_kim, t.name, t.sort_order from (values
      ('Kimyasal Türler Arası Etkileşim',1),('Mol Kavramı',2),('Kimyasal Tepkimeler',3),
      ('Asit-Baz-Tuz',4),('Karışımlar',5),('Kimya Her Yerde',6)
    ) as t(name, sort_order)
    on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_ayt_bio, t.name, t.sort_order from (values
      ('Canlıların Ortak Özellikleri',1),('Hücre',2),('Ekosistem',3),
      ('Kalıtım',4),('Evrim',5),('İnsan Fizyolojisi',6)
    ) as t(name, sort_order)
    on conflict do nothing;
end$$;

-- ============== LGS ==============
do $$
declare
  e_id uuid;
  p_lgs uuid;
  s_turkce uuid; s_mat uuid; s_fen uuid; s_ink uuid; s_din uuid; s_ing uuid;
begin
  select id into e_id from public.exams where code = 'lgs';

  insert into public.exam_programs (exam_id, code, name, sort_order)
    values (e_id, 'lgs', 'LGS', 10)
    on conflict (exam_id, code) do nothing
    returning id into p_lgs;
  if p_lgs is null then select id into p_lgs from public.exam_programs where exam_id = e_id and code = 'lgs'; end if;

  insert into public.subjects (program_id, key, name, color, sort_order, question_count) values
    (p_lgs, 'turkce',       'Türkçe',                  '#4F46E5', 10, 20),
    (p_lgs, 'matematik',    'Matematik',               '#7C3AED', 20, 20),
    (p_lgs, 'fen',          'Fen Bilimleri',           '#059669', 30, 20),
    (p_lgs, 'inkilap',      'T.C. İnkılap Tarihi',     '#0891B2', 40, 10),
    (p_lgs, 'din',          'Din Kültürü ve Ahlak',    '#D97706', 50, 10),
    (p_lgs, 'ingilizce',    'İngilizce',               '#DC2626', 60, 10)
  on conflict (program_id, key) do nothing;

  select id into s_turkce from public.subjects where program_id = p_lgs and key = 'turkce';
  select id into s_mat from public.subjects where program_id = p_lgs and key = 'matematik';
  select id into s_fen from public.subjects where program_id = p_lgs and key = 'fen';
  select id into s_ink from public.subjects where program_id = p_lgs and key = 'inkilap';
  select id into s_din from public.subjects where program_id = p_lgs and key = 'din';
  select id into s_ing from public.subjects where program_id = p_lgs and key = 'ingilizce';

  insert into public.topics (subject_id, name, sort_order)
    select s_turkce, t.name, t.sort_order from (values
      ('Sözcükte Anlam',1),('Cümlede Anlam',2),('Paragraf',3),('Şiir Bilgisi',4),
      ('Sözcük Türleri',5),('Cümlenin Ögeleri',6),('Yazım-Noktalama',7)
    ) as t(name, sort_order) on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_mat, t.name, t.sort_order from (values
      ('Çarpanlar ve Katlar',1),('Üslü İfadeler',2),('Köklü İfadeler',3),
      ('Oran-Orantı',4),('Problemler',5),('Doğrular ve Açılar',6),
      ('Üçgenler',7),('Eşlik-Benzerlik',8),('Çokgenler',9),('Daire',10)
    ) as t(name, sort_order) on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_fen, t.name, t.sort_order from (values
      ('Madde ve Özellikleri',1),('Hareket ve Kuvvet',2),('Enerji',3),
      ('Isı ve Sıcaklık',4),('Elektrik',5),('Işık ve Ses',6),
      ('Hücre ve Bölünmeler',7),('Kalıtım',8),('Ekosistem',9)
    ) as t(name, sort_order) on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_ink, t.name, t.sort_order from (values
      ('Bir Kahraman Doğuyor',1),('Milli Uyanış',2),('Kurtuluş Savaşı',3),
      ('Atatürk İlke ve İnkılapları',4),('Demokratikleşme',5)
    ) as t(name, sort_order) on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_din, t.name, t.sort_order from (values
      ('İnanç',1),('İbadet',2),('Hz. Muhammed',3),('Ahlak ve Değerler',4)
    ) as t(name, sort_order) on conflict do nothing;

  insert into public.topics (subject_id, name, sort_order)
    select s_ing, t.name, t.sort_order from (values
      ('Friendship',1),('Teen Life',2),('Daily Routines',3),
      ('Holidays',4),('Technology',5),('Environment',6)
    ) as t(name, sort_order) on conflict do nothing;
end$$;

-- ============================================================
-- 7) ESKİ user_states TABLOSU İÇİN UYUMLULUK
-- Mevcut kullanıcıların verilerini yeni şemaya taşımak için
-- aşağıdaki SQL fonksiyonu kullanılabilir.
-- ============================================================

create or replace function public.migrate_user_state_to_normalized(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  raw jsonb;
  prof_record jsonb;
  exam_id_migrated uuid;
  program_id_migrated uuid;
  exam_code text := 'kpss_ortaogretim';
  program_code text := 'gy';
  subj_record jsonb;
  exam_record jsonb;
  topic_record jsonb;
  log_record jsonb;
  task_record jsonb;
  topic_lookup jsonb := '{}'::jsonb;
begin
  select data into raw from public.user_states where user_id = p_user_id;
  if raw is null then return; end if;

  -- Profil
  prof_record := raw->'settings';
  select id into exam_id_migrated from public.exams where code = exam_code limit 1;
  select id into program_id_migrated from public.exam_programs where exam_id = exam_id_migrated and code = program_code limit 1;

  insert into public.user_profiles (
    user_id, display_name, exam_id, program_id, exam_date,
    target_score, target_net, daily_goal_minutes, weekly_goal_minutes,
    wrong_penalty_divisor, theme, onboarded, demo_seeded
  ) values (
    p_user_id,
    null,
    exam_id_migrated,
    program_id_migrated,
    (prof_record->>'examDate')::date,
    (prof_record->>'targetScore')::numeric,
    (prof_record->>'targetNet')::numeric,
    coalesce((prof_record->>'dailyGoalMinutes')::int, 180),
    coalesce((prof_record->>'weeklyGoalMinutes')::int, 1200),
    coalesce((prof_record->>'wrongPenaltyDivisor')::int, 4),
    coalesce(prof_record->>'theme', 'light'),
    coalesce((prof_record->>'onboarded')::boolean, false),
    coalesce((prof_record->>'demoSeeded')::boolean, false)
  )
  on conflict (user_id) do update set
    exam_date = excluded.exam_date,
    target_score = excluded.target_score,
    target_net = excluded.target_net,
    updated_at = now();

  -- Konular: subject__topic adından DB id'ye eşleme haritası oluştur
  for topic_record in select * from jsonb_each(raw->'topics')
  loop
    declare
      subj_key text;
      topic_name text;
      subj_uuid uuid;
      topic_uuid uuid;
    begin
      subj_key := split_part(topic_record.key, '__', 1);
      topic_name := split_part(topic_record.key, '__', 2);
      select s.id into subj_uuid from public.subjects s
        join public.exam_programs p on p.id = s.program_id
        where p.id = program_id_migrated and s.key = subj_key
        limit 1;
      if subj_uuid is not null then
        select id into topic_uuid from public.topics where subject_id = subj_uuid and name = topic_name limit 1;
        if topic_uuid is not null then
          topic_lookup := topic_lookup || jsonb_build_object(topic_record.key, topic_uuid::text);
          insert into public.user_topics (
            user_id, topic_id, status, study_count, last_study_date,
            correct, wrong, blank, last_review_date, next_review_date, importance, note
          ) values (
            p_user_id, topic_uuid,
            case (topic_record.value->>'status')
              when 'Başlamadım' then 'not_started'
              when 'Çalışıyorum' then 'studying'
              when 'Tamamlandı' then 'completed'
              when 'Tekrar Gerekli' then 'review_needed'
              when 'Zayıf' then 'weak'
              when 'Çok İyi' then 'strong'
              else 'not_started'
            end,
            coalesce((topic_record.value->>'studyCount')::int, 0),
            (topic_record.value->>'lastStudyDate')::date,
            coalesce((topic_record.value->>'correct')::int, 0),
            coalesce((topic_record.value->>'wrong')::int, 0),
            coalesce((topic_record.value->>'blank')::int, 0),
            (topic_record.value->>'lastReviewDate')::date,
            (topic_record.value->>'nextReviewDate')::date,
            case (topic_record.value->>'importance')
              when 'Düşük' then 'low'
              when 'Yüksek' then 'high'
              else 'medium'
            end,
            topic_record.value->>'note'
          )
          on conflict (user_id, topic_id) do update set
            status = excluded.status,
            study_count = excluded.study_count,
            correct = excluded.correct,
            wrong = excluded.wrong,
            updated_at = now();
        end if;
      end if;
    end;
  end loop;

  -- Denemeler
  for exam_record in select * from jsonb_array_elements(raw->'exams')
  loop
    declare
      new_exam_id uuid := gen_random_uuid();
      sub_key text;
      sub_uuid uuid;
      sub_data jsonb;
    begin
      insert into public.user_exams (id, user_id, name, exam_date)
        values (new_exam_id, p_user_id, exam_record->>'name', (exam_record->>'date')::date);

      for sub_key, sub_data in select * from jsonb_each(exam_record->'subjects')
      loop
        select s.id into sub_uuid from public.subjects s
          join public.exam_programs p on p.id = s.program_id
          where p.id = program_id_migrated and s.key = sub_key
          limit 1;
        if sub_uuid is not null then
          insert into public.user_exam_subjects (user_id, exam_id, subject_id, correct, wrong, blank)
            values (p_user_id, new_exam_id, sub_uuid,
              coalesce((sub_data->>'correct')::int, 0),
              coalesce((sub_data->>'wrong')::int, 0),
              coalesce((sub_data->>'blank')::int, 0))
            on conflict do nothing;
        end if;
      end loop;
    end;
  end loop;

  -- Günlük loglar ve görevler
  for log_record in select * from jsonb_each(raw->'dailyLogs')
  loop
    declare
      log_date_iso text := log_record.key;
    begin
      insert into public.daily_logs (user_id, log_date, minutes)
        values (p_user_id, log_date_iso::date, coalesce((log_record.value->>'minutes')::int, 0))
        on conflict (user_id, log_date) do update set minutes = excluded.minutes;

      for task_record in select * from jsonb_array_elements(coalesce(log_record.value->'tasks', '[]'::jsonb))
      loop
        declare
          t_uuid uuid;
          s_uuid uuid;
          t_name text;
          s_name text;
        begin
          t_name := task_record->>'topic';
          s_name := subject_name_from_key(task_record->>'subject');
          select id into s_uuid from public.subjects s
            join public.exam_programs p on p.id = s.program_id
            where p.id = program_id_migrated and s.key = (task_record->>'subject')
            limit 1;
          select id into t_uuid from public.topics where subject_id = s_uuid and name = t_name limit 1;

          insert into public.daily_log_tasks (
            user_id, log_date, topic_id, subject_id,
            topic_name_snapshot, subject_name_snapshot,
            duration, scheduled_time, done
          ) values (
            p_user_id, log_date_iso::date, t_uuid, s_uuid,
            t_name, coalesce(s_name, task_record->>'subject'),
            coalesce((task_record->>'duration')::int, 0),
            (task_record->>'time')::time,
            coalesce((task_record->>'done')::boolean, false)
          );
        end;
      end loop;
    end;
  end loop;

  -- Subscription (yeni kullanıcılar için trial başlat)
  insert into public.subscriptions (user_id, status, plan, start_date, end_date)
    values (p_user_id, 'trial', 'free', now(), now() + interval '14 days')
    on conflict (user_id) do nothing;
end;
$$;

-- Yardımcı: subject key'den ad çözümle (migration sırasında kullanılır)
create or replace function public.subject_name_from_key(p_key text)
returns text
language sql
immutable
as $$
  select case p_key
    when 'turkce' then 'Türkçe'
    when 'matematik' then 'Matematik'
    when 'tarih' then 'Tarih'
    when 'cografya' then 'Coğrafya'
    when 'vatandaslik' then 'Vatandaşlık'
    when 'guncel' then 'Güncel Bilgiler'
    when 'fen' then 'Fen Bilimleri'
    when 'sosyal' then 'Sosyal Bilimler'
    when 'fizik' then 'Fizik'
    when 'kimya' then 'Kimya'
    when 'biyoloji' then 'Biyoloji'
    when 'inkilap' then 'T.C. İnkılap Tarihi'
    when 'din' then 'Din Kültürü ve Ahlak'
    when 'ingilizce' then 'İngilizce'
    else p_key
  end;
$$;

-- ============================================================
-- 8) OTOMATİK updated_at TETİKLEYİCİLERİ
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_topics_updated on public.user_topics;
create trigger trg_user_topics_updated before update on public.user_topics
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_exams_updated on public.user_exams;
create trigger trg_user_exams_updated before update on public.user_exams
  for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_logs_updated on public.daily_logs;
create trigger trg_daily_logs_updated before update on public.daily_logs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 9) YENİ KULLICI KAYIT OLDUĞUNDA OTOMATİK SUBSCRIPTION OLUŞTUR
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, status, plan, start_date, end_date)
    values (new.id, 'trial', 'free', now(), now() + interval '14 days')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- KURULUM TAMAMLANDI
-- ============================================================
-- Doğrulama sorgusu (Supabase SQL Editor'da çalıştır):
--   select 'exams' tablo, count(*) from public.exams
--   union all select 'programs', count(*) from public.exam_programs
--   union all select 'subjects', count(*) from public.subjects
--   union all select 'topics', count(*) from public.topics;
-- Beklenen: exams=3, programs>=8, subjects>=16, topics>=100
-- ============================================================