-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor).
-- It adds "undo" for weekly check-ins and cleanup of dead push subscriptions.

create or replace function public.undo_check_in(p_pact uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_p public.pacts; v_today date;
begin
  select * into v_p from public.pacts where id = p_pact;
  if not found then raise exception 'Pact not found'; end if;
  v_today := (now() at time zone v_p.timezone)::date;
  delete from public.checkins c
    where c.pact_id = p_pact and c.user_id = v_me and c.day = v_today
      and not exists (select 1 from public.doubts d where d.checkin_id = c.id);
  if not found then raise exception 'Can''t undo this one'; end if;
end $$;
revoke execute on function public.undo_check_in(uuid) from public, anon;
grant execute on function public.undo_check_in(uuid) to authenticated;

create or replace function public.drop_push_subscription(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.check_secret(p_secret) then raise exception 'Forbidden'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end $$;
revoke execute on function public.drop_push_subscription(text, text) from public, authenticated;
grant execute on function public.drop_push_subscription(text, text) to anon;
