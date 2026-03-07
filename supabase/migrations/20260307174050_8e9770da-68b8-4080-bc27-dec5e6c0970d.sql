-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.reviews_public SET (security_invoker = on);
ALTER VIEW public.community_reports_public SET (security_invoker = on);