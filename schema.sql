-- ==========================================
-- نظام إدارة السيرفرات الموحد (Xtream Codes Multi-Panel Master Dashboard)
-- سكربت إنشاء الجداول وصلاحيات الأمان لقاعدة بيانات Supabase (النسخة المحدثة 2.0)
-- قم بنسخ هذا الكود بالكامل ولصقه في قسم الـ SQL Editor في لوحة Supabase الخاصة بك ثم اضغط Run 🚀
-- ==========================================

-- 1. جدول المستخدمين الموحد (Admins & Sub-Resellers)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- كلمة السر مشفرة بـ SHA-256
    role TEXT NOT NULL CHECK (role IN ('admin', 'reseller')),
    credits NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- إدراج حساب المسؤول الافتراضي (اسم المستخدم: admin | كلمة المرور: admin123)
INSERT INTO public.users (username, password_hash, role, credits, status)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 999999.00, 'active')
ON CONFLICT (username) DO NOTHING;

-- 2. جدول لوحات Xtream Codes المضافة للسيستم
CREATE TABLE IF NOT EXISTS public.xtream_panels (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- اسم اللوحة المميز (مثال: MH, Alfa, Nova)
    domain_url TEXT NOT NULL, -- رابط اللوحة (مثال: http://mh-server.com:8080)
    api_username TEXT NOT NULL, -- اسم مستخدم الآدمن للوحة
    api_password TEXT NOT NULL, -- كلمة سر الآدمن للوحة
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. جدول الخدمات والأسعار (الربط بين باقات السيرفرات ونظام النقاط/الرصيد)
CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    panel_id INTEGER REFERENCES public.xtream_panels(id) ON DELETE CASCADE NOT NULL,
    service_name TEXT NOT NULL, -- اسم الخدمة للموزعين (مثال: MH - 1 Month)
    package_id TEXT NOT NULL, -- معرّف الباقة الأصلي في لوحة الـ Xtream (Package ID)
    cost_credits NUMERIC(10, 2) NOT NULL DEFAULT 1.00, -- التكلفة بالنقاط للموزع الفرعي
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. سجل الاشتراكات العام (Subscriptions Log)
CREATE TABLE IF NOT EXISTS public.subscriptions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_reseller_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    panel_id INTEGER REFERENCES public.xtream_panels(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    line_username TEXT NOT NULL, -- اسم المستخدم للاشتراك المنشأ
    line_password TEXT NOT NULL, -- كلمة السر للاشتراك المنشأ
    expire_date TIMESTAMP WITH TIME ZONE, -- تاريخ انتهاء الاشتراك
    credits_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- النقاط التي خصمت
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. سجل المعاملات المالية والشحن (Credit Transactions Log)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_reseller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL, -- القيمة (موجبة للشحن، سالبة للخصم)
    action_type TEXT NOT NULL CHECK (action_type IN ('deposit', 'deduct', 'refund')), -- نوع الحركة
    description TEXT, -- تفاصيل الحركة (مثال: شحن رصيد بواسطة الآدمن)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- دالة PostgreSQL آمنة ومحمية لمعاملات خصم الرصيد وإنشاء الاشتراك (Atomic Transaction Function)
-- ==========================================

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
    v_sub_id UUID;
BEGIN
    -- قفل السطر الخاص بالموزع لمنع التعديل المتزامن (Race Conditions)
    SELECT credits, status, role INTO v_current_credits, v_reseller_status, v_reseller_role
    FROM public.users
    WHERE id = p_reseller_id
    FOR UPDATE;

    -- التحقق من وجود الموزع
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'المستخدم غير موجود بالنظام');
    END IF;

    -- التحقق من دور المستخدم (يجب أن يكون موزع أو مسؤول)
    IF v_reseller_role != 'reseller' AND v_reseller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'هذا الحساب لا يملك صلاحية الموزعين');
    END IF;

    -- التحقق من حالة حساب الموزع
    IF v_reseller_status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'الحساب موقوف حالياً');
    END IF;

    -- إذا كان الحساب موزع فرعي، نتحقق من رصيده ونخصم منه. أما إذا كان المسؤول (admin)، فلا نخصم أو نخصم شكلياً
    IF v_reseller_role = 'reseller' THEN
        IF v_current_credits < p_credits_deducted THEN
            RETURN json_build_object('success', false, 'error', 'رصيدك غير كافٍ لإتمام هذه العملية');
        END IF;

        -- خصم الرصيد
        UPDATE public.users
        SET credits = credits - p_credits_deducted
        WHERE id = p_reseller_id;
    END IF;

    -- تسجيل الاشتراك في سجل الاشتراكات
    INSERT INTO public.subscriptions_log (
        sub_reseller_id, panel_id, service_id, line_username, line_password, expire_date, credits_deducted, status
    ) VALUES (
        p_reseller_id, p_panel_id, p_service_id, p_line_username, p_line_password, p_expire_date, p_credits_deducted, 'active'
    ) RETURNING id INTO v_sub_id;

    -- تسجيل المعاملة المالية إذا كان موزعاً
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.credit_transactions (
            sub_reseller_id, amount, action_type, description
        ) VALUES (
            p_reseller_id, -p_credits_deducted, 'deduct', 'إنشاء اشتراك للعميل: ' || p_line_username
        );
    END IF;

    -- إرجاع النتيجة بنجاح
    RETURN json_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- دالة PostgreSQL آمنة لتجديد الاشتراك وخصم النقاط
-- ==========================================

CREATE OR REPLACE FUNCTION public.renew_subscription_deduct_credits(
    p_reseller_id UUID,
    p_subscription_id UUID,
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
    -- قفل السطر الخاص بالمسؤول أو الموزع
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

    -- التحقق والخصم للموزعين فقط
    IF v_reseller_role = 'reseller' THEN
        IF v_current_credits < p_credits_deducted THEN
            RETURN json_build_object('success', false, 'error', 'رصيدك غير كافٍ لتجديد هذا الاشتراك');
        END IF;

        -- خصم الرصيد
        UPDATE public.users
        SET credits = credits - p_credits_deducted
        WHERE id = p_reseller_id;
    END IF;

    -- جلب معلومات الاشتراك وتاريخ الانتهاء الحالي
    SELECT expire_date, line_username INTO v_expire_date, v_line_username
    FROM public.subscriptions_log
    WHERE id = p_subscription_id AND (sub_reseller_id = p_reseller_id OR v_reseller_role = 'admin');

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'الاشتراك غير موجود أو لا ينتمي لصلاحياتك');
    END IF;

    -- حساب تاريخ الانتهاء الجديد
    IF v_expire_date IS NULL OR v_expire_date < now() THEN
        v_new_expire := now() + (p_additional_days || ' days')::INTERVAL;
    ELSE
        v_new_expire := v_expire_date + (p_additional_days || ' days')::INTERVAL;
    END IF;

    -- تحديث الاشتراك
    UPDATE public.subscriptions_log
    SET expire_date = v_new_expire, status = 'active'
    WHERE id = p_subscription_id;

    -- تسجيل المعاملة للموزعين
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.credit_transactions (
            sub_reseller_id, amount, action_type, description
        ) VALUES (
            p_reseller_id, -p_credits_deducted, 'deduct', 'تجديد اشتراك العميل: ' || v_line_username
        );
    END IF;

    RETURN json_build_object('success', true, 'new_expire_date', v_new_expire);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- دالة PostgreSQL لاسترجاع النقاط في حال فشل الطلب الخارجي للوحة الـ Xtream
-- ==========================================

CREATE OR REPLACE FUNCTION public.refund_subscription_credits(
    p_reseller_id UUID,
    p_subscription_id UUID,
    p_amount NUMERIC,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line_username TEXT;
    v_reseller_role TEXT;
BEGIN
    SELECT role INTO v_reseller_role
    FROM public.users
    WHERE id = p_reseller_id;

    -- استرجاع الرصيد فقط إذا كان دور المستخدم موزع فرعي
    IF v_reseller_role = 'reseller' THEN
        UPDATE public.users
        SET credits = credits + p_amount
        WHERE id = p_reseller_id;
    END IF;

    -- جلب اسم المستخدم وتحديث حالة الاشتراك في السجل كموقف
    SELECT line_username INTO v_line_username
    FROM public.subscriptions_log
    WHERE id = p_subscription_id;

    UPDATE public.subscriptions_log
    SET status = 'disabled'
    WHERE id = p_subscription_id;

    -- تسجيل المعاملة كمرجع (Refund) للموزعين
    IF v_reseller_role = 'reseller' THEN
        INSERT INTO public.credit_transactions (
            sub_reseller_id, amount, action_type, description
        ) VALUES (
            p_reseller_id, p_amount, 'refund', 'إرجاع رصيد للعميل: ' || COALESCE(v_line_username, '') || ' - السبب: ' || p_reason
        );
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
