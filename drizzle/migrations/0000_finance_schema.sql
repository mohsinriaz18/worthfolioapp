
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'expense',
  icon text NOT NULL DEFAULT '•',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read defaults and own" ON public.categories FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "insert own" ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own" ON public.categories FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "delete own" ON public.categories FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.categories (user_id, name, kind, icon) VALUES
 (NULL,'Groceries','expense','🛒'),(NULL,'Dining','expense','🍽'),(NULL,'Rent','expense','🏠'),
 (NULL,'Utilities','expense','💡'),(NULL,'Transport','expense','🚗'),(NULL,'Fuel','expense','⛽'),
 (NULL,'Shopping','expense','🛍'),(NULL,'Health','expense','💊'),(NULL,'Education','expense','📚'),
 (NULL,'Entertainment','expense','🎬'),(NULL,'Mobile & Internet','expense','📶'),(NULL,'Travel','expense','✈'),
 (NULL,'Charity','expense','🤲'),(NULL,'Family','expense','👪'),(NULL,'Other','expense','•'),
 (NULL,'Salary','income','💼'),(NULL,'Business','income','🏢'),(NULL,'Freelance','income','💻'),
 (NULL,'Dividends','income','📈'),(NULL,'Rental Income','income','🔑'),(NULL,'Gift','income','🎁'),(NULL,'Other Income','income','•');

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  bank text,
  account_type text NOT NULL DEFAULT 'checking',
  last4 text,
  opening_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  note text,
  occurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_day int NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  frequency text NOT NULL DEFAULT 'monthly',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  last_paid_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bills" ON public.bills FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'stocks',
  invested numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inv" ON public.investments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.net_worth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  snap_date date NOT NULL DEFAULT current_date,
  value numeric NOT NULL,
  UNIQUE (user_id, snap_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_worth_snapshots TO authenticated;
GRANT ALL ON public.net_worth_snapshots TO service_role;
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snaps" ON public.net_worth_snapshots FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX ON public.transactions (user_id, occurred_on);
