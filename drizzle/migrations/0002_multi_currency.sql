
ALTER TABLE public.accounts ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.transactions ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.transactions ADD COLUMN fx_usd numeric;
COMMENT ON COLUMN public.transactions.fx_usd IS 'USD value of 1 unit of currency on entry date; snapshot for historical conversion';
ALTER TABLE public.bills ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.investments ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.debts ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.goals ADD COLUMN currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.profiles ADD COLUMN primary_currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.profiles ADD COLUMN secondary_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.profiles ADD COLUMN display_currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE public.profiles ADD COLUMN last_used_currency text;
ALTER TABLE public.profiles ADD COLUMN manual_rates jsonb NOT NULL DEFAULT '{}'::jsonb;
