-- =========================================================================
-- ELITE CRM - SUPABASE FUNCTIONS & SCHEMA CONFIGURATION
-- =========================================================================
-- Paste this script into the Supabase SQL Editor and click RUN 🚀
-- This fixes the missing function 'create_subscription_deduct_credits' error
-- and corrects column constraints.
-- =========================================================================

-- 0. Add stream_url column to xtream_panels (the actual IPTV streaming server URL)
ALTER TABLE public.xtream_panels ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- 0b. Set the stream_url for existing panel (MH IPTV Server)
-- ⚠️ Update the URL below to match your actual IPTV streaming server
UPDATE public.xtream_panels 
SET stream_url = 'http://25.mhpro1.xyz:80' 
WHERE id = 1 AND (stream_url IS NULL OR stream_url = '');

-- 0c. Update service prices to correct EGP amounts (جنيه مصري)
-- ⚠️ Edit these prices to match your actual pricing
UPDATE public.services SET cost_credits = 0.0,   service_name = 'تجريبي 24 ساعة - TEST'  WHERE id = 10;
UPDATE public.services SET cost_credits = 55.0,  service_name = 'باقة 3 أشهر'            WHERE id = 54;
UPDATE public.services SET cost_credits = 110.0, service_name = 'باقة 6 أشهر'            WHERE id = 55;
UPDATE public.services SET cost_credits = 220.0, service_name = 'باقة 12 شهر'           WHERE id = 56;
UPDATE public.services SET cost_credits = 275.0, service_name = 'باقة 15 شهر'           WHERE id = 119;

-- 1. Adjust subscriptions_log columns for automatic ID generation and nullable expire_date
ALTER TABLE public.subscriptions_log ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);
ALTER TABLE public.subscriptions_log ALTER COLUMN expire_date DROP NOT NULL;

-- 2. Adjust subscriptions_log status check constraint to allow 'expired' status
ALTER TABLE public.subscriptions_log DROP CONSTRAINT IF EXISTS subscriptions_log_status_check;
ALTER TABLE public.subscriptions_log DROP CONSTRAINT IF EXISTS subscriptions_log_status_check1;
ALTER TABLE public.subscriptions_log ADD CONSTRAINT subscriptions_log_status_check CHECK (status IN ('active', 'disabled', 'expired'));

-- 3. Create create_subscription_deduct_credits function
CREATE OR REPLACE FUNCTION public.create_subscription_deduct_credits(
    p_reseller_id UUID,
    p_panel_id INTEGER,
    p_service_id INTEGER,
    p_line_username TEXT,
    p_line_password TEXT,
    p_expire_date TIMESTAMP WITH TIME ZONE,
    p_credits_deducted NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_current_credits NUMERIC;
    v_reseller_status TEXT;
    v_reseller_role TEXT;
    v_sub_id TEXT;
BEGIN
    -- Lock reseller row to prevent race conditions
    SELECT credits, status, role INTO v_current_credits, v_reseller_status, v_reseller_role
    FROM public.users
    WHERE id = p_reseller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'المستخدم غير موجود بالنظام');
    END IF;

    IF v_reseller_role != 'reseller' AND v_reseller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'هذا الحساب لا يملك صلاحية الموزعين');
    END IF;

    IF v_reseller_status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'الحساب موقوف حالياً');
    END IF;

    IF v_reseller_role = 'reseller' THEN
        IF v_current_credits < p_credits_deducted THEN
            RETURN json_build_object('success', false, 'error', 'رصيدك غير كافٍ لإتمام هذه العملية');
        END IF;

        UPDATE public.users
        SET credits = credits - p_credits_deducted
        WHERE id = p_reseller_id;
    END IF;

    -- Insert into subscriptions_log
    INSERT INTO public.subscriptions_log (
        sub_reseller_id, panel_id, service_id, line_username, line_password, expire_date, status
    ) VALUES (
        p_reseller_id, p_panel_id, p_service_id, p_line_username, p_line_password, p_expire_date, 'active'
    ) RETURNING id INTO v_sub_id;

    -- Log transaction in activity_logs
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.activity_logs (
            reseller_id, action, credits_before, credits_after, details
        ) VALUES (
            p_reseller_id, 'deduct', v_current_credits, v_current_credits - p_credits_deducted, 
            'إنشاء اشتراك للعميل: ' || p_line_username || ' بسعر ' || p_credits_deducted || ' نقطة'
        );
    END IF;

    RETURN json_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$ LANGUAGE plpgsql;

-- 4. Create renew_subscription_deduct_credits function
CREATE OR REPLACE FUNCTION public.renew_subscription_deduct_credits(
    p_reseller_id UUID,
    p_subscription_id TEXT,
    p_service_id INTEGER,
    p_credits_deducted NUMERIC,
    p_additional_days INTEGER
) RETURNS JSON AS $$
DECLARE
    v_current_credits NUMERIC;
    v_reseller_status TEXT;
    v_reseller_role TEXT;
    v_expire_date TIMESTAMP WITH TIME ZONE;
    v_line_username TEXT;
    v_new_expire TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT credits, status, role INTO v_current_credits, v_reseller_status, v_reseller_role
    FROM public.users
    WHERE id = p_reseller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'المستخدم غير موجود بالنظام');
    END IF;

    IF v_reseller_status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'الحساب موقوف حالياً');
    END IF;

    IF v_reseller_role = 'reseller' THEN
        IF v_current_credits < p_credits_deducted THEN
            RETURN json_build_object('success', false, 'error', 'رصيدك غير كافٍ لإتمام هذه العملية');
        END IF;

        UPDATE public.users
        SET credits = credits - p_credits_deducted
        WHERE id = p_reseller_id;
    END IF;

    SELECT expire_date, line_username INTO v_expire_date, v_line_username
    FROM public.subscriptions_log
    WHERE id = p_subscription_id AND (sub_reseller_id = p_reseller_id OR v_reseller_role = 'admin');

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'الاشتراك غير موجود أو لا ينتمي لصلاحياتك');
    END IF;

    IF v_expire_date IS NULL OR v_expire_date < now() THEN
        v_new_expire := now() + (p_additional_days || ' days')::INTERVAL;
    ELSE
        v_new_expire := v_expire_date + (p_additional_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.subscriptions_log
    SET expire_date = v_new_expire, status = 'active'
    WHERE id = p_subscription_id;

    -- Log transaction in activity_logs
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.activity_logs (
            reseller_id, action, credits_before, credits_after, details
        ) VALUES (
            p_reseller_id, 'deduct', v_current_credits, v_current_credits - p_credits_deducted, 
            'تجديد اشتراك العميل: ' || v_line_username || ' بقيمة ' || p_credits_deducted || ' نقطة'
        );
    END IF;

    RETURN json_build_object('success', true, 'new_expire_date', v_new_expire);
END;
$$ LANGUAGE plpgsql;

-- 5. Create refund_subscription_credits function
CREATE OR REPLACE FUNCTION public.refund_subscription_credits(
    p_reseller_id UUID,
    p_subscription_id TEXT,
    p_amount NUMERIC,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line_username TEXT;
    v_reseller_role TEXT;
    v_current_credits NUMERIC;
BEGIN
    SELECT role, credits INTO v_reseller_role, v_current_credits
    FROM public.users
    WHERE id = p_reseller_id;

    IF v_reseller_role = 'reseller' THEN
        UPDATE public.users
        SET credits = credits + p_amount
        WHERE id = p_reseller_id;
    END IF;

    SELECT line_username INTO v_line_username
    FROM public.subscriptions_log
    WHERE id = p_subscription_id;

    UPDATE public.subscriptions_log
    SET status = 'disabled'
    WHERE id = p_subscription_id;

    -- Log transaction in activity_logs
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.activity_logs (
            reseller_id, action, credits_before, credits_after, details
        ) VALUES (
            p_reseller_id, 'refund', v_current_credits, v_current_credits + p_amount, 
            'إرجاع رصيد للعميل: ' || COALESCE(v_line_username, '') || ' بقيمة ' || p_amount || ' نقطة - السبب: ' || p_reason
        );
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
