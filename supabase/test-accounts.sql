-- Sif: seed test accounts so the platform feels alive, and make those test
-- accounts automatically connect/follow back.
--
-- ⚠️  DO NOT RUN IN PRODUCTION. This creates login-able accounts with a shared,
-- repo-visible password ('SifTest!2026'). It's for local/staging demos only.
-- If it was ever run against prod, remove the accounts (see teardown below) or
-- rotate their passwords before launch.
--
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run AFTER schema.sql, profiles.sql, posts.sql, public-profiles.sql, social.sql,
-- notifications.sql, and post-tags.sql.
--
-- To remove all test data later, run:
--   delete from auth.users where id in (select id from public.profiles where is_test);
-- (cascades to profiles, haircuts, posts, follows, connections, notifications).

create extension if not exists pgcrypto with schema extensions;

-- Flag so we can recognize seeded accounts and auto-respond on their behalf.
alter table public.profiles add column if not exists is_test boolean not null default false;

-- ============================================================
-- Auto connect-back / follow-back for test accounts
-- ============================================================

-- When someone requests a connection with a test account, accept it for them.
create or replace function public.auto_accept_test_connection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending'
     and exists (select 1 from public.profiles p where p.id = new.addressee_id and p.is_test) then
    update public.connections set status = 'accepted' where id = new.id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_auto_accept_test_connection on public.connections;
create trigger trg_auto_accept_test_connection
  after insert on public.connections
  for each row execute function public.auto_accept_test_connection();

-- When someone follows a test account, follow them back.
create or replace function public.auto_follow_back_test()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.following_id and p.is_test) then
    insert into public.follows (follower_id, following_id)
    values (new.following_id, new.follower_id)
    on conflict do nothing;
  end if;
  return null;
end; $$;

drop trigger if exists trg_auto_follow_back_test on public.follows;
create trigger trg_auto_follow_back_test
  after insert on public.follows
  for each row execute function public.auto_follow_back_test();

-- ============================================================
-- Seed helpers
-- ============================================================

create or replace function public.seed_test_user(
  p_email text,
  p_username text,
  p_display text,
  p_bio text,
  p_avatar text,
  p_is_stylist boolean,
  p_instagram text default null,
  p_website text default null,
  p_privacy text default 'public'
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      p_email, crypt('SifTest!2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', ''
    );
  end if;

  insert into public.profiles (
    id, username, display_name, bio, avatar_url, instagram, website,
    privacy, profile_public, is_stylist, is_test
  ) values (
    uid, p_username, p_display, p_bio, p_avatar, p_instagram, p_website,
    p_privacy, p_privacy = 'public', p_is_stylist, true
  )
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    instagram = excluded.instagram,
    website = excluded.website,
    privacy = excluded.privacy,
    profile_public = excluded.profile_public,
    is_stylist = excluded.is_stylist,
    is_test = true;

  return uid;
end; $$;

create or replace function public.seed_test_post(
  p_uid uuid,
  p_cut text,
  p_photo text,
  p_caption text,
  p_stylist uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  insert into public.haircuts (user_id, date, cut_type, location, stylist, status, created_by)
  values (p_uid, current_date - (floor(random() * 60))::int, p_cut, '', '{}'::jsonb, 'active', p_uid)
  returning id into hid;

  insert into public.photos (haircut_id, user_id, uri, angle, note, position)
  values (hid, p_uid, p_photo, 'front', '', 0);

  insert into public.posts (user_id, haircut_id, caption, photo_url, cut_type, visibility, stylist_id)
  values (p_uid, hid, p_caption, p_photo, p_cut, 'public', p_stylist);
end; $$;

-- ============================================================
-- Seed data
-- ============================================================

do $$
declare
  -- stylists
  marcus uuid; lena uuid; dax uuid; ivy uuid; kenji uuid; rosa uuid;
  -- normal users
  jordan uuid; sam uuid; mia uuid; tre uuid; priya uuid; liam uuid; noah uuid; zoe uuid;
begin
  -- Stylists of various specialties
  marcus := public.seed_test_user('marcus.fades@sif.test', 'marcus_fades', 'Marcus Reyes',
    'Barber • skin fades, tapers & line-ups. Walk-ins welcome.', 'https://i.pravatar.cc/300?img=12', true,
    'marcus.fades', 'marcusreyescuts.com');
  lena := public.seed_test_user('lena.color@sif.test', 'lena_color', 'Lena Petrova',
    'Color specialist • balayage, lived-in blondes, gloss.', 'https://i.pravatar.cc/300?img=45', true,
    'lena.colors', null);
  dax := public.seed_test_user('dax.curls@sif.test', 'dax_curls', 'Dax Monroe',
    'Curly & textured hair. Dry cutting nerd.', 'https://i.pravatar.cc/300?img=33', true,
    'daxdoescurls', null);
  ivy := public.seed_test_user('ivy.braids@sif.test', 'ivy_braids', 'Ivy Coleman',
    'Braids, locs & protective styles. Booking 2 weeks out.', 'https://i.pravatar.cc/300?img=49', true,
    'ivybraids', 'ivycoleman.style');
  kenji := public.seed_test_user('kenji.shears@sif.test', 'kenji_shears', 'Kenji Tanaka',
    'Classic men''s grooming, scissor work, hot towel shaves.', 'https://i.pravatar.cc/300?img=15', true,
    'kenji.shears', null);
  rosa := public.seed_test_user('rosa.blonde@sif.test', 'rosa_blonde', 'Rosa Marin',
    'Blondes & foils. Olaplex everything.', 'https://i.pravatar.cc/300?img=20', true,
    'rosagoesblonde', null);

  -- Normal users
  jordan := public.seed_test_user('jordan@sif.test', 'jordan', 'Jordan Blake',
    'Trying to grow it out. Fade enthusiast.', 'https://i.pravatar.cc/300?img=8', false, null, null);
  sam := public.seed_test_user('sam@sif.test', 'sam_h', 'Sam Hayes',
    'Low maintenance, high standards.', 'https://i.pravatar.cc/300?img=11', false, null, null);
  mia := public.seed_test_user('mia@sif.test', 'mia_w', 'Mia Wong',
    'Curly girl. Color experiments.', 'https://i.pravatar.cc/300?img=24', false, null, null);
  tre := public.seed_test_user('tre@sif.test', 'tre', 'Tre Johnson',
    'Lining up every two weeks.', 'https://i.pravatar.cc/300?img=51', false, null, null);
  priya := public.seed_test_user('priya@sif.test', 'priya', 'Priya Nair',
    'Long layers forever.', 'https://i.pravatar.cc/300?img=27', false, null, null);
  liam := public.seed_test_user('liam@sif.test', 'liam', 'Liam O''Brien',
    'Textured crop guy.', 'https://i.pravatar.cc/300?img=53', false, null, null);
  noah := public.seed_test_user('noah@sif.test', 'noah', 'Noah Schmidt',
    'Mullet era.', 'https://i.pravatar.cc/300?img=60', false, null, null);
  zoe := public.seed_test_user('zoe@sif.test', 'zoe', 'Zoe Adams',
    'Bob appreciator.', 'https://i.pravatar.cc/300?img=31', false, null, null);

  -- Only seed posts the first time (so re-running doesn't duplicate them).
  if not exists (select 1 from public.posts p join public.profiles pr on pr.id = p.user_id where pr.is_test) then
    perform public.seed_test_post(jordan, 'Mid Skin Fade', 'https://i.pravatar.cc/600?img=8',  'Fresh fade before the weekend.', marcus);
    perform public.seed_test_post(tre,    'Line-up + Taper', 'https://i.pravatar.cc/600?img=51', 'Two weeks on the dot.', marcus);
    perform public.seed_test_post(sam,    'Scissor Crop', 'https://i.pravatar.cc/600?img=11', 'Kenji never misses.', kenji);
    perform public.seed_test_post(liam,   'Textured Crop', 'https://i.pravatar.cc/600?img=53', 'Grown out and loving it.', kenji);
    perform public.seed_test_post(mia,    'Balayage', 'https://i.pravatar.cc/600?img=24', 'New color, who dis.', lena);
    perform public.seed_test_post(priya,  'Long Layers', 'https://i.pravatar.cc/600?img=27', 'Lived-in blonde dream.', rosa);
    perform public.seed_test_post(mia,    'Curl Shaping', 'https://i.pravatar.cc/600?img=24', 'Dry cut changed everything.', dax);
    perform public.seed_test_post(zoe,    'Blunt Bob', 'https://i.pravatar.cc/600?img=31', 'Chopped it all off.', null);
    perform public.seed_test_post(noah,   'Mullet', 'https://i.pravatar.cc/600?img=60', 'Business up front.', null);
    perform public.seed_test_post(jordan, 'Burst Fade', 'https://i.pravatar.cc/600?img=14', 'Round two this month.', marcus);
    perform public.seed_test_post(priya,  'Protective Style', 'https://i.pravatar.cc/600?img=27', 'Knotless braids by Ivy.', ivy);
    perform public.seed_test_post(rosa,   'Platinum Foils', 'https://i.pravatar.cc/600?img=20', 'Before/after coming soon.', null);
  end if;
end $$;
