-- Append-only history of haircut notes so accidental wipes / failed retries
-- can still be recovered from the dashboard:
--
--   select created_at, haircut_id, field, left(body, 200)
--   from haircut_note_revisions
--   order by created_at desc
--   limit 50;

create table if not exists public.haircut_note_revisions (
  id uuid primary key default gen_random_uuid(),
  haircut_id uuid not null references public.haircuts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  field text not null check (field in ('public_notes', 'private_notes', 'stylist_notes')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists haircut_note_revisions_haircut_id_idx
  on public.haircut_note_revisions (haircut_id, created_at desc);

create index if not exists haircut_note_revisions_created_at_idx
  on public.haircut_note_revisions (created_at desc);

alter table public.haircut_note_revisions enable row level security;

drop policy if exists "Users read own note revisions" on public.haircut_note_revisions;
create policy "Users read own note revisions"
  on public.haircut_note_revisions
  for select
  to authenticated
  using (user_id = auth.uid());

-- No client inserts/updates/deletes — only the trigger writes.

create or replace function public.log_haircut_note_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if coalesce(NEW.public_notes, '') <> '' then
      insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
      values (NEW.id, NEW.user_id, 'public_notes', NEW.public_notes);
    end if;
    if coalesce(NEW.private_notes, '') <> '' then
      insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
      values (NEW.id, NEW.user_id, 'private_notes', NEW.private_notes);
    end if;
    if coalesce(NEW.stylist_notes, '') <> '' then
      insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
      values (NEW.id, NEW.user_id, 'stylist_notes', NEW.stylist_notes);
    end if;
    return NEW;
  end if;

  -- On update: snapshot the PREVIOUS non-empty value whenever a notes field changes
  -- (this is what lets us recover from an accidental wipe).
  if OLD.public_notes is distinct from NEW.public_notes
     and coalesce(OLD.public_notes, '') <> '' then
    insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
    values (OLD.id, OLD.user_id, 'public_notes', OLD.public_notes);
  end if;
  if OLD.private_notes is distinct from NEW.private_notes
     and coalesce(OLD.private_notes, '') <> '' then
    insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
    values (OLD.id, OLD.user_id, 'private_notes', OLD.private_notes);
  end if;
  if OLD.stylist_notes is distinct from NEW.stylist_notes
     and coalesce(OLD.stylist_notes, '') <> '' then
    insert into public.haircut_note_revisions (haircut_id, user_id, field, body)
    values (OLD.id, OLD.user_id, 'stylist_notes', OLD.stylist_notes);
  end if;

  return NEW;
end;
$$;

drop trigger if exists haircut_note_revisions_trg on public.haircuts;
create trigger haircut_note_revisions_trg
  after insert or update of public_notes, private_notes, stylist_notes
  on public.haircuts
  for each row
  execute function public.log_haircut_note_revision();
