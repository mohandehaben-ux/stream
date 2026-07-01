import os
import sys
import json
import requests
import bcrypt
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import urllib.parse as _urlparse
_q = _urlparse.quote

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

# --- SECURITY: Rate Limiting Store ---
# Tracks recent create requests per reseller: { reseller_id: [timestamp, ...] }
_rate_limit_store = {}
RATE_LIMIT_MAX = 5        # max requests
RATE_LIMIT_WINDOW = 60    # per N seconds

def check_rate_limit(reseller_id):
    """Returns True if allowed, False if rate-limited."""
    import time
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    history = _rate_limit_store.get(reseller_id, [])
    # Keep only timestamps within window
    history = [t for t in history if t > window_start]
    if len(history) >= RATE_LIMIT_MAX:
        _rate_limit_store[reseller_id] = history
        return False
    history.append(now)
    _rate_limit_store[reseller_id] = history
    return True


# --- CONFIGURATION LOADER ---
SB_URL = ""
SB_KEY = ""
PORT = 5000

if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('=', 1)
            if len(parts) == 2:
                key, val = parts[0].strip(), parts[1].strip()
                if key == 'SB_URL':
                    SB_URL = val
                elif key == 'SB_KEY':
                    SB_KEY = val
                elif key == 'PORT':
                    try:
                        PORT = int(val)
                    except:
                        pass

# Fallback to Environment Variables
if not SB_URL:
    SB_URL = os.environ.get("SB_URL", "")
if not SB_KEY:
    SB_KEY = os.environ.get("SB_KEY", "")

print(f"[*] Starting Server...")
print(f"[*] Supabase URL: {SB_URL[:20]}..." if SB_URL else "[!] Warning: SB_URL not set in .env")
print(f"[*] Supabase Key: {SB_KEY[:20]}..." if SB_KEY else "[!] Warning: SB_KEY not set in .env")

# --- LOCAL DATABASE FALLBACK ---
DB_FILE = "database.json"
DEFAULT_DB = {
    "users": [
        {
            "id": "medo2026",
            "username": "medo2026",
            "role": "reseller",
            "credits": 100.0,
            "status": "active"
        },
        {
            "id": "admin",
            "username": "admin",
            "role": "admin",
            "credits": 99999.0,
            "status": "active"
        }
    ],
    "services": [
        { "id": 10,  "service_name": "تجريبي 24 ساعة - TEST",   "cost_credits": 0.0,   "package_id": 10,  "panel_id": 1 },
        { "id": 54,  "service_name": "باقة 3 أشهر",              "cost_credits": 55.0,  "package_id": 54,  "panel_id": 1 },
        { "id": 55,  "service_name": "باقة 6 أشهر",              "cost_credits": 110.0, "package_id": 55,  "panel_id": 1 },
        { "id": 56,  "service_name": "باقة 12 شهر",              "cost_credits": 220.0, "package_id": 56,  "panel_id": 1 },
        { "id": 119, "service_name": "باقة 15 شهر",              "cost_credits": 275.0, "package_id": 119, "panel_id": 1 }
    ],
    "subscriptions": [
        {
            "id": "sub_demo_1",
            "reseller_id": "medo2026",
            "line_username": "client_demo_m3u",
            "line_password": "pwd",
            "services": { "service_name": "12 Months ALL CHANNEL" },
            "xtream_panels": { "name": "MH IPTV Server" },
            "expire_date": "2027-06-29 12:00:00",
            "status": "active",
            "notes": "سجل تجريبي أولى"
        }
    ],
    "activity_logs": [],
    "code_categories": [
        { "id": "cat_hyper", "name": "Hyper IPTV", "cost_credits": 2.0 },
        { "id": "cat_nova", "name": "Nova IPTV", "cost_credits": 3.0 }
    ],
    "active_codes": [
        { "id": "code_1", "category_id": "cat_hyper", "code": "HYPER-8872-9901", "status": "available", "sold_to": None, "sold_at": None },
        { "id": "code_2", "category_id": "cat_hyper", "code": "HYPER-1245-7762", "status": "available", "sold_to": None, "sold_at": None },
        { "id": "code_3", "category_id": "cat_nova", "code": "NOVA-9901-1122", "status": "available", "sold_to": None, "sold_at": None }
    ],
    "xtream_panels": [
        {
            "id": 1,
            "name": "MH IPTV Server",
            "domain_url": "https://cms.streamcreed.com/d33e53c4d1dc",
            "api_username": "medo2026",
            "api_password": "0102110260777",
            "decryption_key": "mh123321",
            "status": "active"
        }
    ]
}

def read_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_DB, f, indent=4, ensure_ascii=False)
        return DEFAULT_DB
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            db = json.load(f)
            # Ensure new keys are initialized
            for key in ["code_categories", "active_codes", "xtream_panels"]:
                if key not in db:
                    db[key] = DEFAULT_DB[key]
            return db
    except:
        return DEFAULT_DB

def write_db(db):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

# Supabase API Headers
def get_supabase_headers():
    return {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

# --- STATIC FILES ROUTING ---
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# --- API ENDPOINTS ---

# 1. Secure Authentication Login Endpoint
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password_plain = data.get('password', '').strip()  # Plain password sent over HTTPS

    if not username or not password_plain:
        return jsonify({"success": False, "error": "اسم المستخدم وكلمة المرور مطلوبة"}), 400

    if not SB_KEY:
        # Local mode: simple check from database.json
        db = read_db()
        user = next((u for u in db["users"] if u["username"] == username), None)
        if not user:
            role = "admin" if "admin" in username.lower() else "reseller"
            user = {
                "id": username,
                "username": username,
                "role": role,
                "credits": 99999.0 if role == "admin" else 100.0,
                "status": "active"
            }
            db["users"].append(user)
            write_db(db)
        return jsonify({"success": True, "session": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "credits": float(user["credits"])
        }})

    try:
        headers = get_supabase_headers()
        # Step 1: Find user by username only
        res = requests.get(
            f"{SB_URL}/rest/v1/users?username=eq.{_q(str(username))}&select=id,username,role,credits,status,password_hash",
            headers=headers
        )

        if res.status_code != 200:
            return jsonify({"success": False, "error": "فشل الاتصال بقاعدة البيانات"}), 500

        users = res.json()
        if not users:
            return jsonify({"success": False, "error": "اسم المستخدم أو كلمة المرور غير صحيحة"}), 401

        user = users[0]

        if user.get('status') != 'active':
            return jsonify({"success": False, "error": "حسابك موقوف حالياً، يرجى مراجعة المسؤول"}), 403

        # Step 2: Verify password using bcrypt
        stored_hash = user.get('password_hash', '')
        if not stored_hash:
            return jsonify({"success": False, "error": "لم يتم تعيين كلمة مرور لهذا الحساب"}), 401

        try:
            password_ok = bcrypt.checkpw(password_plain.encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            password_ok = False

        if not password_ok:
            return jsonify({"success": False, "error": "اسم المستخدم أو كلمة المرور غير صحيحة"}), 401

        # Step 3: Return session data (never include password_hash)
        return jsonify({"success": True, "session": {
            "id": user["id"],           # Real UUID from Supabase
            "username": user["username"],
            "role": user["role"],
            "credits": float(user["credits"])
        }})

    except Exception as e:
        return jsonify({"success": False, "error": f"خطأ داخلي بالخادم: {str(e)}"}), 500

@app.route('/api/auth/change-password', methods=['POST'])
def change_password():
    data = request.json
    username = data.get('username', '').strip()
    current_password = data.get('current_password', '').strip()
    new_password = data.get('new_password', '').strip()

    if not username or not current_password or not new_password:
        return jsonify({"success": False, "error": "جميع الحقول مطلوبة"}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "error": "كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف"}), 400

    if not SB_KEY:
        # Local mock mode
        db = read_db()
        user = next((u for u in db["users"] if u["username"] == username), None)
        if not user:
            return jsonify({"success": False, "error": "المستخدم غير موجود"}), 404
        
        user["password_hash"] = new_password
        write_db(db)
        return jsonify({"success": True, "message": "تم تغيير كلمة المرور بنجاح"})

    try:
        headers = get_supabase_headers()
        # Find user
        res = requests.get(
            f"{SB_URL}/rest/v1/users?username=eq.{_q(str(username))}&select=id,username,password_hash",
            headers=headers
        )
        if res.status_code != 200 or not res.json():
            return jsonify({"success": False, "error": "المستخدم غير موجود بالنظام"}), 404
        
        user = res.json()[0]
        stored_hash = user.get('password_hash', '')
        
        # Verify current password using bcrypt
        try:
            password_ok = bcrypt.checkpw(current_password.encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            password_ok = False

        if not password_ok:
            return jsonify({"success": False, "error": "كلمة المرور الحالية غير صحيحة"}), 401

        # Hash new password
        salt = bcrypt.gensalt(12)
        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')

        # Update in Supabase
        update_res = requests.patch(
            f"{SB_URL}/rest/v1/users?id=eq.{user['id']}",
            headers=headers,
            json={"password_hash": new_hash}
        )
        if update_res.status_code not in [200, 201, 204]:
            return jsonify({"success": False, "error": "فشل تحديث كلمة المرور في قاعدة البيانات"}), 400

        return jsonify({"success": True, "message": "تم تغيير كلمة المرور بنجاح ✅"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# 1b. Reseller Data Load Endpoint
@app.route('/api/reseller/data', methods=['GET'])
def get_reseller_data():
    reseller_id = request.args.get('reseller_id')
    if not reseller_id:
        return jsonify({"success": False, "error": "reseller_id is required"}), 400

    if not SB_KEY:
        db = read_db()
        user = next((u for u in db["users"] if u["id"] == reseller_id), None)
        credits = user["credits"] if user else 0.0
        subs = [s for s in db["subscriptions"] if s.get("reseller_id") == reseller_id]
        # Enrich local services with panel info
        panels = db.get("xtream_panels", [])
        enriched_services = []
        for s in db.get("services", []):
            s_copy = s.copy()
            panel_id = s_copy.get("panel_id", 1)  # Default to 1 (MH)
            panel = next((p for p in panels if p["id"] == panel_id), None)
            s_copy["panel_id"] = panel_id
            s_copy["xtream_panels"] = {
                "id": panel_id,
                "name": panel["name"] if panel else "MH IPTV Server",
                "domain_url": panel["domain_url"] if panel else "https://cms.streamcreed.com/d33e53c4d1dc/index.php"
            }
            enriched_services.append(s_copy)

        return jsonify({
            "success": True,
            "credits": credits,
            "services": enriched_services,
            "subscriptions": subs
        })

    # Fallback to Supabase if config is set
    try:
        headers = get_supabase_headers()
        # Query services
        services_res = requests.get(f"{SB_URL}/rest/v1/services?status=eq.active&select=*,xtream_panels(name)", headers=headers)
        services = services_res.json() if services_res.status_code == 200 else []

        # Query user credits
        user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers)
        user_data = user_res.json() if user_res.status_code == 200 else []
        credits = user_data[0]["credits"] if user_data else 0.0

        # Query subscriptions
        subs_res = requests.get(f"{SB_URL}/rest/v1/subscriptions_log?sub_reseller_id=eq.{_q(str(reseller_id))}&select=*,services(service_name),xtream_panels(id,name)", headers=headers)
        subs = subs_res.json() if subs_res.status_code == 200 else []

        return jsonify({
            "success": True,
            "credits": credits,
            "services": services,
            "subscriptions": [{
                "id": s["id"],
                "line_username": s["line_username"],
                "line_password": s["line_password"],
                "service_id": s.get("service_id"),
                "panel_id": s.get("panel_id"),
                "services": { "service_name": s.get("services", {}).get("service_name", "Unknown") } if s.get("services") else None,
                "xtream_panels": { "id": s.get("xtream_panels", {}).get("id"), "name": s.get("xtream_panels", {}).get("name", "Server") } if s.get("xtream_panels") else None,
                "expire_date": s["expire_date"],
                "status": s["status"],
                "notes": s.get("notes", "")
            } for s in subs]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# 2. Test Connection to Xtream Codes Panel
@app.route('/api/xtream/test-connection', methods=['POST'])
def test_connection():
    data = request.json
    domain_url = data.get('domain_url', '').strip('/')
    if domain_url.endswith('/index.php'):
        domain_url = domain_url[:-10]
    username = data.get('username', '')
    password = data.get('password', '')

    if not domain_url or not username or not password:
        return jsonify({"success": False, "error": "جميع البيانات مطلوبة لاختبار الاتصال"}), 400

    test_url = f"{domain_url}/api.php"
    params = {
        "action": "get_packages",
        "username": username,
        "password": password
    }

    try:
        response = requests.get(test_url, params=params, timeout=10)
        if response.status_code == 200:
            try:
                res_data = response.json()
                if isinstance(res_data, list) or (isinstance(res_data, dict) and "result" not in res_data):
                    return jsonify({"success": True, "message": "تم الاتصال بنجاح! السيرفر متصل وصالح."})
                elif isinstance(res_data, dict) and res_data.get("result") == "success":
                    return jsonify({"success": True, "message": "تم الاتصال بنجاح! السيرفر متصل وصالح."})
                else:
                    error_msg = res_data.get("message", "فشل التحقق من صحة الحساب (بيانات الدخول غير صحيحة)")
                    return jsonify({"success": False, "error": f"السيرفر استجاب بخطأ: {error_msg}"})
            except:
                if "invalid" in response.text.lower() or "fail" in response.text.lower():
                    return jsonify({"success": False, "error": "بيانات الدخول إلى اللوحة غير صحيحة"}), 400
                return jsonify({"success": True, "message": "تم الاتصال بنجاح باللوحة!"})
        else:
            return jsonify({"success": False, "error": f"فشل الاتصال بالخادم. رمز الحالة: {response.status_code}"}), 400
    except requests.exceptions.RequestException as e:
        print(f"[!] RequestException in test_connection: {str(e)}")
        return jsonify({"success": False, "error": "خطأ في الاتصال بالشبكة: تعذر الوصول إلى السيرفر الرئيسي."}), 500


# 3. Create Xtream Codes Line
@app.route('/api/xtream/create', methods=['POST'])
def create_line():
    import time, re
    data = request.json or {}
    reseller_id = data.get('reseller_id', '').strip()

    # --- SECURITY: Rate Limiting ---
    if reseller_id and not check_rate_limit(reseller_id):
        return jsonify({"success": False, "error": "⚠️ تجاوزت الحد المسموح من الطلبات. انتظر دقيقة وحاول مجدداً."}), 429

    # --- Input Validation ---
    try:
        service_id = int(data.get('service_id', 0))
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "معرف الخدمة غير صالح"}), 400

    line_username = data.get('line_username', '').strip()
    line_password = data.get('line_password', '').strip()
    line_type = data.get('line_type', 'official').strip()
    notes = data.get('notes', '').strip()

    # Sanitize username/password (alphanumeric + _ -)
    if not re.match(r'^[a-zA-Z0-9_\-]{3,50}$', line_username):
        return jsonify({"success": False, "error": "اسم المستخدم يجب أن يكون 3-50 حرف (حروف/أرقام/_ -)"}), 400
    if len(line_password) < 4 or len(line_password) > 50:
        return jsonify({"success": False, "error": "كلمة المرور يجب أن تكون بين 4 و50 حرف"}), 400

    if not reseller_id or not service_id:
        return jsonify({"success": False, "error": "جميع الحقول مطلوبة لإنشاء الاشتراك"}), 400


    if not SB_KEY:
        try:
            db = read_db()
            user = next((u for u in db["users"] if u["id"] == reseller_id), None)
            if not user:
                return jsonify({"success": False, "error": "المستخدم غير موجود بالنظام"}), 404

            # SECURITY: Check user is active
            if user.get('status') == 'suspended':
                return jsonify({"success": False, "error": "⛔ حساب الموزع موقوف. تواصل مع الأدمن."}), 403

            service = next((s for s in db["services"] if s["id"] == service_id), None)
            if not service:
                return jsonify({"success": False, "error": "الخدمة غير موجودة أو محذوفة"}), 404

            # SECURITY: Cost comes from DB only - not from request
            is_trial = line_type == 'trial' or 'test' in service.get('service_name', '').lower()
            cost_credits = 0.0 if is_trial else float(service['cost_credits'])

            # SECURITY: Prevent duplicate active trial
            if is_trial:
                existing_trials = [
                    s for s in db.get("subscriptions", [])
                    if s.get("reseller_id") == reseller_id
                    and s.get("status") == "active"
                    and s.get("services", {}).get("service_name", "").lower().startswith("test")
                ]
                if existing_trials:
                    return jsonify({"success": False, "error": "⚠️ لديك اشتراك تجريبي نشط بالفعل. لا يمكن إضافة أكثر من تجريبي واحد."}), 400

            # SECURITY: Server-side balance check (cannot be bypassed by client)
            if user.get('role') == 'reseller' and float(user.get('credits', 0)) < cost_credits:
                balance = float(user.get('credits', 0))
                return jsonify({
                    "success": False,
                    "error": f"❌ رصيدك الحالي ({balance:.2f} ج.م) غير كافٍ. سعر الباقة: {cost_credits:.2f} ج.م"
                }), 400

            # Perform Playwright StreamCreed creation
            from playwright.sync_api import sync_playwright
            success = False
            error_msg = "فشل غير معروف"
            
            # Lookup Panel
            panel_id = service.get("panel_id", 1)
            panel = next((p for p in db.get("xtream_panels", []) if p["id"] == panel_id), None)
            if not panel and db.get("xtream_panels"):
                panel = db["xtream_panels"][0]
                
            if not panel:
                return jsonify({"success": False, "error": "السيرفر المرتبط بهذه الخدمة غير متاح حالياً"}), 400

            panel_user = panel["api_username"]
            panel_pass = panel["api_password"]
            panel_key = panel.get("decryption_key", "mh123321")
            base_url = panel["domain_url"].rstrip('/')
            panel_url = f"{base_url}/index.php?action=login"
            add_user_url = f"{base_url}/userpanel/add_user.php"
            
            print(f"[*] Automating StreamCreed creation for user: {line_username} on panel: {panel['name']}...")
            
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(viewport={'width': 1280, 'height': 800})
                page = context.new_page()
                
                try:
                    page.goto(panel_url)
                    page.fill('input#username', panel_user)
                    page.fill('input#password', panel_pass)
                    page.fill('input#decryption_key', panel_key)
                    page.click('button.btn-danger')
                    page.wait_for_load_state("networkidle")
                    
                    if "action=login" in page.url:
                        error_msg = "فشل تسجيل الدخول إلى لوحة سيرفر StreamCreed."
                    else:
                        page.goto(add_user_url)
                        page.wait_for_selector('input#username')
                        
                        page.fill('input#username', line_username)
                        page.fill('input#password', line_password)
                        
                        # Select Package
                        page.select_option('select#package_id', value=str(service['package_id']))
                        
                        # Wait for AJAX line type option to become available in DOM
                        page.wait_for_timeout(2000)
                        
                        # Select Line Type
                        if line_type == "trial":
                            page.select_option('select#line_type', value='trial')
                        else:
                            page.select_option('select#line_type', value='official')
                        
                        # Notes
                        notes = data.get('notes', '')
                        if notes:
                            page.fill('textarea#reseller_notes', notes)
                            
                        # Submit Form
                        page.click('button[type="submit"]')
                        page.wait_for_load_state("networkidle")
                        page.wait_for_timeout(3000)
                        
                        # Check success toast
                        content = page.locator('body').inner_text()
                        if "User added" in content or "added successfully" in content.lower():
                            success = True
                        else:
                            try:
                                toast_el = page.locator('.toast-message, .toast-error, .alert-danger')
                                if toast_el.count() > 0:
                                    error_msg = toast_el.first.inner_text().strip()
                                else:
                                    error_msg = "فشل إضافة المشترك (قد يكون الاسم مكرر أو الرصيد غير كافٍ في لوحة السيرفر)."
                            except:
                                error_msg = "لم يظهر إشعار نجاح إضافة المشترك في لوحة السيرفر."
                except Exception as ex:
                    error_msg = f"خطأ في متصفح الأتمتة: {str(ex)}"
                finally:
                    browser.close()
            
            if success:
                # Deduct credits
                user['credits'] = float(user['credits']) - cost_credits
                
                from datetime import timedelta
                import calendar
                
                expire_date = datetime.now()
                # Expiry calculations
                if line_type == 'trial':
                    expire_date = expire_date + timedelta(hours=24) # 24 Hours
                else:
                    # Depending on package (3, 6, 12, 15 Months)
                    months = 1
                    if service['id'] == 54: months = 3
                    elif service['id'] == 55: months = 6
                    elif service['id'] == 56: months = 12
                    elif service['id'] == 119: months = 15
                    
                    # Safe month addition
                    month_val = expire_date.month - 1 + months
                    year_val = expire_date.year + month_val // 12
                    month_val = month_val % 12 + 1
                    day_val = min(expire_date.day, calendar.monthrange(year_val, month_val)[1])
                    expire_date = datetime(year_val, month_val, day_val, expire_date.hour, expire_date.minute, expire_date.second)
                
                expire_date_str = expire_date.strftime('%Y-%m-%d %H:%M:%S')
                
                # Add subscription record
                new_sub = {
                    "id": "sub_" + str(int(time.time())),
                    "reseller_id": reseller_id,
                    "line_username": line_username,
                    "line_password": line_password,
                    "services": { "service_name": service["service_name"] },
                    "xtream_panels": { "name": "MH IPTV Server" },
                    "expire_date": expire_date_str,
                    "status": "active",
                    "notes": data.get('notes', '')
                }
                
                db["subscriptions"].insert(0, new_sub)
                
                # Log transaction
                new_log = {
                    "id": "log_" + str(int(time.time())),
                    "reseller_id": reseller_id,
                    "action": "create_line",
                    "credits_before": float(user['credits']) + cost_credits,
                    "credits_after": float(user['credits']),
                    "details": f"إنشاء اشتراك للمستخدم {line_username} (نوع: {line_type})",
                    "created_at": datetime.now().isoformat()
                }
                db["activity_logs"].insert(0, new_log)
                
                write_db(db)
                
                panel_stream_url = panel.get('stream_url') or panel.get('domain_url', '').split('/userpanel')[0].rstrip('/')
                return jsonify({
                    "success": True,
                    "message": "تم إنشاء الاشتراك بنجاح على سيرفر StreamCreed وتم خصم الرصيد!",
                    "subscription_id": new_sub["id"],
                    "expire_date": expire_date_str,
                    "stream_url": panel_stream_url
                })
            else:
                return jsonify({"success": False, "error": f"فشل السيرفر في إضافة المشترك: {error_msg}"}), 400
                
        except Exception as e:
            return jsonify({"success": False, "error": f"خطأ داخلي بالخادم المحلي: {str(e)}"}), 500

    try:
        headers = get_supabase_headers()
        
        # Verify user role and status
        user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers)
        if user_res.status_code != 200 or not user_res.json():
            return jsonify({"success": False, "error": "المستخدم غير موجود بالنظام"}), 404
        user = user_res.json()[0]

        # Fetch Service Details
        service_res = requests.get(f"{SB_URL}/rest/v1/services?id=eq.{_q(str(service_id))}&select=*,xtream_panels(*)", headers=headers)
        if service_res.status_code != 200 or not service_res.json():
            return jsonify({"success": False, "error": "الخدمة المطلوبة غير موجودة في السيستم"}), 404
        
        service = service_res.json()[0]
        panel = service.get('xtream_panels')
        if not panel or panel.get('status') != 'active':
            return jsonify({"success": False, "error": "السيرفر التابع لهذه الخدمة غير متاح أو متوقف"}), 400

        # SECURITY: Check user is active
        if user.get('status') == 'suspended':
            return jsonify({"success": False, "error": "⛔ حساب الموزع موقوف. تواصل مع الأدمن."}), 403

        package_id = service['package_id']
        # SECURITY: Cost from DB only — not from client request
        is_trial = line_type == 'trial' or 'test' in service.get('service_name', '').lower()
        cost_credits = 0.0 if is_trial else float(service['cost_credits'])

        # SECURITY: Server-side balance check
        if user.get('role') == 'reseller' and float(user.get('credits', 0)) < cost_credits:
            balance = float(user.get('credits', 0))
            return jsonify({
                "success": False,
                "error": f"❌ رصيدك الحالي ({balance:.2f} ج.م) غير كافٍ. سعر الباقة: {cost_credits:.2f} ج.م"
            }), 400

        # SECURITY: Prevent duplicate active trial
        if is_trial:
            trial_res = requests.get(
                f"{SB_URL}/rest/v1/subscriptions_log?reseller_id=eq.{_q(str(reseller_id))}&status=eq.active&select=id,services(service_name)",
                headers=headers
            )
            if trial_res.status_code == 200:
                existing = [s for s in trial_res.json()
                           if 'test' in (s.get('services') or {}).get('service_name', '').lower()]
                if existing:
                    return jsonify({"success": False, "error": "⚠️ لديك اشتراك تجريبي نشط بالفعل. لا يمكن إضافة أكثر من تجريبي واحد."}), 400

        panel_id = int(panel['id'])
        domain_url = panel['domain_url'].strip('/')
        if domain_url.endswith('/index.php'):
            domain_url = domain_url[:-10]
        api_username = panel['api_username']
        api_password = panel['api_password']

        # Call Supabase RPC to deduct credits atomically
        rpc_payload = {
            "p_reseller_id": reseller_id,
            "p_panel_id": panel_id,
            "p_service_id": service_id,
            "p_line_username": line_username,
            "p_line_password": line_password,
            "p_expire_date": None,
            "p_credits_deducted": cost_credits
        }

        rpc_res = requests.post(f"{SB_URL}/rest/v1/rpc/create_subscription_deduct_credits", headers=headers, json=rpc_payload)
        if rpc_res.status_code != 200:
            return jsonify({"success": False, "error": f"فشلت عملية خصم الرصيد: {rpc_res.text}"}), 400
        
        rpc_result = rpc_res.json()
        if not rpc_result.get('success'):
            return jsonify({"success": False, "error": rpc_result.get('error', 'خطأ غير معروف في الخصم')}), 400

        subscription_id = rpc_result['subscription_id']

        # Call Xtream Codes API to create the user line
        is_success = False
        error_msg = "فشل غير معروف"
        expire_date_str = None

        create_url = f"{domain_url}/api.php"
        params = {
            "action": "create_line",
            "username": api_username,
            "password": api_password,
            "customer_username": line_username,
            "customer_password": line_password,
            "package_id": package_id
        }

        try:
            print(f"[*] Trying standard api.php create for {line_username}...")
            xtream_res = requests.get(create_url, params=params, timeout=10)
            if xtream_res.status_code == 200:
                try:
                    xtream_data = xtream_res.json()
                    if isinstance(xtream_data, dict):
                        if xtream_data.get('result') == 'success' or xtream_data.get('status') == 'success':
                            is_success = True
                            exp_ts = xtream_data.get('expire_date')
                            if exp_ts:
                                try:
                                    expire_date_str = datetime.utcfromtimestamp(int(exp_ts)).strftime('%Y-%m-%d %H:%M:%S')
                                except:
                                    pass
                        else:
                            error_msg = xtream_data.get('message', 'فشل من لوحة السيرفر')
                    else:
                        error_msg = "استجابة غير صالحة من لوحة السيرفر"
                except Exception as je:
                    error_msg = f"فشل فك استجابة السيرفر كـ JSON: {str(je)}"
            else:
                error_msg = f"HTTP {xtream_res.status_code}"
        except Exception as e:
            print(f"[!] Exception during standard api.php create_line: {str(e)}")
            error_msg = "فشل الاتصال بالشبكة لتشغيل رابط الـ API."

        # Fallback to Playwright automation if standard API returned 404/Not Found
        if not is_success and ("404" in error_msg or "not found" in error_msg.lower() or "connection" in error_msg.lower() or "invalid" in error_msg.lower()):
            print(f"[*] Standard API returned error ({error_msg}). Falling back to Playwright automation...")
            from playwright.sync_api import sync_playwright
            
            panel_key = panel.get("decryption_key", "mh123321")
            base_url = panel["domain_url"].split('/userpanel')[0].rstrip('/')
            panel_url = f"{base_url}/index.php?action=login"
            add_user_url = f"{base_url}/userpanel/add_user.php"
            
            try:
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    context = browser.new_context(viewport={'width': 1280, 'height': 800})
                    page = context.new_page()
                    try:
                        page.goto(panel_url)
                        page.fill('input#username', api_username)
                        page.fill('input#password', api_password)
                        page.fill('input#decryption_key', panel_key)
                        page.click('button.btn-danger')
                        page.wait_for_load_state("networkidle")
                        
                        if "action=login" in page.url:
                            error_msg = "فشل تسجيل الدخول إلى لوحة سيرفر StreamCreed عبر الأتمتة."
                        else:
                            page.goto(add_user_url)
                            page.wait_for_selector('input#username')
                            page.fill('input#username', line_username)
                            page.fill('input#password', line_password)
                            page.select_option('select#package_id', value=str(package_id))
                            page.wait_for_timeout(2000)
                            
                            if line_type == "trial":
                                page.select_option('select#line_type', value='trial')
                            else:
                                page.select_option('select#line_type', value='official')
                                
                            if notes:
                                page.fill('textarea#reseller_notes', notes)
                                
                            page.click('button[type="submit"]')
                            page.wait_for_load_state("networkidle")
                            page.wait_for_timeout(3000)
                            
                            content = page.locator('body').inner_text()
                            if "User added" in content or "added successfully" in content.lower():
                                is_success = True
                                days = 1 if line_type == 'trial' else 30
                                if service_id == 54: days = 90
                                elif service_id == 55: days = 180
                                elif service_id == 56: days = 365
                                elif service_id == 119: days = 450
                                from datetime import timedelta
                                expire_date_str = (datetime.utcnow() + timedelta(days=days)).strftime('%Y-%m-%d %H:%M:%S')
                            else:
                                try:
                                    toast_el = page.locator('.toast-message, .toast-error, .alert-danger')
                                    if toast_el.count() > 0:
                                        error_msg = toast_el.first.inner_text().strip()
                                    else:
                                        error_msg = "فشل إضافة المشترك في لوحة السيرفر عبر الأتمتة."
                                except:
                                    error_msg = "لم يظهر إشعار نجاح في لوحة السيرفر عبر الأتمتة."
                    except Exception as ex:
                        error_msg = f"خطأ في متصفح الأتمتة: {str(ex)}"
                    finally:
                        browser.close()
            except Exception as pe:
                error_msg = f"فشل تشغيل متصفح الأتمتة: {str(pe)}"

        if is_success:
            # Update final expiry in DB
            update_payload = {"status": "active"}
            if expire_date_str:
                update_payload["expire_date"] = expire_date_str
            
            requests.patch(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}", headers=headers, json=update_payload)
            stream_url = panel.get('stream_url') or panel.get('domain_url', '').split('/userpanel')[0].rstrip('/')
            return jsonify({
                "success": True, 
                "message": "تم إنشاء الاشتراك بنجاح على السيرفر!",
                "subscription_id": subscription_id,
                "expire_date": expire_date_str or "غير محدد",
                "stream_url": stream_url
            })
        else:
            # Refund credits
            refund_payload = {
                "p_reseller_id": reseller_id,
                "p_subscription_id": subscription_id,
                "p_amount": cost_credits,
                "p_reason": f"فشل إنشاء السطر على السيرفر: {error_msg}"
            }
            requests.post(f"{SB_URL}/rest/v1/rpc/refund_subscription_credits", headers=headers, json=refund_payload)
            return jsonify({"success": False, "error": f"فشل السيرفر في إنشاء الحساب: {error_msg}"}), 400

    except Exception as e:
        return jsonify({"success": False, "error": f"خطأ داخلي بالخادم: {str(e)}"}), 500


# 4. Renew / Extend Xtream Codes Line
@app.route('/api/xtream/renew', methods=['POST'])
def renew_line():
    data = request.json
    reseller_id = data.get('reseller_id')
    subscription_id = data.get('subscription_id')
    service_id = int(data.get('service_id'))
    additional_days = int(data.get('additional_days', 30))

    if not reseller_id or not subscription_id or not service_id:
        return jsonify({"success": False, "error": "جميع الحقول مطلوبة لتجديد الاشتراك"}), 400

    try:
        headers = get_supabase_headers()
        # Fetch Service Details
        service_res = requests.get(f"{SB_URL}/rest/v1/services?id=eq.{_q(str(service_id))}&select=*,xtream_panels(*)", headers=headers)
        if service_res.status_code != 200 or not service_res.json():
            return jsonify({"success": False, "error": "الخدمة المطلوبة غير موجودة في السيستم"}), 404
        
        service = service_res.json()[0]
        panel = service.get('xtream_panels')
        if not panel or panel.get('status') != 'active':
            return jsonify({"success": False, "error": "السيرفر التابع لهذه الخدمة غير متاح أو متوقف"}), 400

        package_id = service['package_id']
        cost_credits = float(service['cost_credits'])
        domain_url = panel['domain_url'].strip('/')
        if domain_url.endswith('/index.php'):
            domain_url = domain_url[:-10]
        api_username = panel['api_username']
        api_password = panel['api_password']

        # Fetch current sub details to get username
        sub_res = requests.get(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}", headers=headers)
        if sub_res.status_code != 200 or not sub_res.json():
            return jsonify({"success": False, "error": "الاشتراك غير موجود بالسجلات"}), 404
        line_username = sub_res.json()[0]['line_username']

        # Call Supabase RPC to deduct credits atomically
        rpc_payload = {
            "p_reseller_id": reseller_id,
            "p_subscription_id": subscription_id,
            "p_service_id": service_id,
            "p_credits_deducted": cost_credits,
            "p_additional_days": additional_days
        }

        rpc_res = requests.post(f"{SB_URL}/rest/v1/rpc/renew_subscription_deduct_credits", headers=headers, json=rpc_payload)
        if rpc_res.status_code != 200:
            return jsonify({"success": False, "error": f"فشلت عملية خصم الرصيد: {rpc_res.text}"}), 400
        
        rpc_result = rpc_res.json()
        if not rpc_result.get('success'):
            return jsonify({"success": False, "error": rpc_result.get('error', 'خطأ غير معروف في الخصم')}), 400

        # Call Xtream Codes API to extend the line
        extend_url = f"{domain_url}/api.php"
        params = {
            "action": "extend_line",
            "username": api_username,
            "password": api_password,
            "customer_username": line_username,
            "package_id": package_id
        }

        try:
            xtream_res = requests.get(extend_url, params=params, timeout=15)
            if xtream_res.status_code == 200:
                try:
                    xtream_data = xtream_res.json()
                    is_success = False
                    new_exp_ts = None

                    if isinstance(xtream_data, dict):
                        if xtream_data.get('result') == 'success':
                            is_success = True
                            new_exp_ts = xtream_data.get('expire_date')
                        else:
                            error_msg = xtream_data.get('message', 'فشل التجديد من لوحة Xtream')
                    else:
                        error_msg = "استجابة غير صالحة من لوحة السيرفر"

                    if is_success:
                        if new_exp_ts:
                            try:
                                final_date = datetime.utcfromtimestamp(int(new_exp_ts)).strftime('%Y-%m-%d %H:%M:%S')
                                requests.patch(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}", headers=headers, json={"expire_date": final_date})
                            except:
                                pass
                        
                        return jsonify({"success": True, "message": "تم تجديد الاشتراك بنجاح على السيرفر!"})
                    else:
                        # Refund
                        refund_payload = {
                            "p_reseller_id": reseller_id,
                            "p_subscription_id": subscription_id,
                            "p_amount": cost_credits,
                            "p_reason": f"فشل التجديد على السيرفر: {error_msg}"
                        }
                        requests.post(f"{SB_URL}/rest/v1/rpc/refund_subscription_credits", headers=headers, json=refund_payload)
                        return jsonify({"success": False, "error": f"فشل السيرفر في تجديد الحساب: {error_msg}"}), 400

                except Exception as ex:
                    # Refund
                    refund_payload = {
                        "p_reseller_id": reseller_id,
                        "p_subscription_id": subscription_id,
                        "p_amount": cost_credits,
                        "p_reason": f"خطأ في معالجة استجابة التجديد: {str(ex)}"
                    }
                    requests.post(f"{SB_URL}/rest/v1/rpc/refund_subscription_credits", headers=headers, json=refund_payload)
                    return jsonify({"success": False, "error": f"فشل معالجة استجابة السيرفر: {str(ex)}"}), 500
            else:
                # Refund
                refund_payload = {
                    "p_reseller_id": reseller_id,
                    "p_subscription_id": subscription_id,
                    "p_amount": cost_credits,
                    "p_reason": f"سيرفر التجديد استجاب بكود HTTP {xtream_res.status_code}"
                }
                requests.post(f"{SB_URL}/rest/v1/rpc/refund_subscription_credits", headers=headers, json=refund_payload)
                return jsonify({"success": False, "error": f"استجاب سيرفر اللوحة بخطأ شبكة: {xtream_res.status_code}"}), 400

        except requests.exceptions.RequestException as e:
            # Refund
            refund_payload = {
                "p_reseller_id": reseller_id,
                "p_subscription_id": subscription_id,
                "p_amount": cost_credits,
                "p_reason": f"فشل شبكة عند التجديد: {str(e)}"
            }
            requests.post(f"{SB_URL}/rest/v1/rpc/refund_subscription_credits", headers=headers, json=refund_payload)
            return jsonify({"success": False, "error": f"انتهى وقت الاتصال باللوحة للتجديد. تم استرجاع ج.مك تلقائياً."}), 504

    except Exception as e:
        return jsonify({"success": False, "error": f"خطأ داخلي بالخادم: {str(e)}"}), 500


# 5. Enable / Disable / Delete Line
@app.route('/api/xtream/status', methods=['POST'])
def manage_status():
    data = request.json
    reseller_id = data.get('reseller_id')
    subscription_id = data.get('subscription_id')
    action = data.get('action') # 'enable', 'disable', 'delete'

    if not subscription_id or not action or action not in ['enable', 'disable', 'delete']:
        return jsonify({"success": False, "error": "البيانات المدخلة غير صالحة"}), 400

    try:
        headers = get_supabase_headers()
        
        # Verify permission: Admin can edit anything. Reseller can only edit their own subscriptions.
        user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers)
        if user_res.status_code != 200 or not user_res.json():
            return jsonify({"success": False, "error": "المستخدم غير مصرح له بالنظام"}), 401
        user = user_res.json()[0]

        # Fetch subscription, service, and panel info
        sub_res = requests.get(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}&select=*,xtream_panels(*)", headers=headers)
        if sub_res.status_code != 200 or not sub_res.json():
            return jsonify({"success": False, "error": "الاشتراك غير موجود بالسجلات"}), 404
        
        subscription = sub_res.json()[0]
        panel = subscription.get('xtream_panels')
        if not panel:
            return jsonify({"success": False, "error": "السيرفر التابع لهذا الاشتراك غير متاح"}), 400

        # Permission check
        if user['role'] != 'admin' and subscription['sub_reseller_id'] != reseller_id:
            return jsonify({"success": False, "error": "غير مصرح لك بتعديل هذا الاشتراك"}), 403

        line_username = subscription['line_username']
        domain_url = panel['domain_url'].strip('/')
        if domain_url.endswith('/index.php'):
            domain_url = domain_url[:-10]
        api_username = panel['api_username']
        api_password = panel['api_password']

        # Call Xtream Codes API
        xtream_action = f"{action}_line"
        action_url = f"{domain_url}/api.php"
        params = {
            "action": xtream_action,
            "username": api_username,
            "password": api_password,
            "customer_username": line_username
        }

        try:
            xtream_res = requests.get(action_url, params=params, timeout=10)
            if xtream_res.status_code == 200:
                # Update status in local Supabase DB
                if action == 'delete':
                    requests.delete(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}", headers=headers)
                else:
                    new_status = 'active' if action == 'enable' else 'disabled'
                    requests.patch(f"{SB_URL}/rest/v1/subscriptions_log?id=eq.{_q(str(subscription_id))}", headers=headers, json={"status": new_status})

                return jsonify({"success": True, "message": f"تم تنفيذ عملية ({action}) بنجاح على السيرفر وفي قاعدة البيانات."})
            else:
                return jsonify({"success": False, "error": f"فشل السيرفر في تنفيذ العملية. كود HTTP: {xtream_res.status_code}"}), 400
        except requests.exceptions.RequestException as e:
            print(f"[!] RequestException in manage_status (action={action}): {str(e)}")
            action_map = {'enable': 'تفعيل', 'disable': 'تعطيل', 'delete': 'حذف'}
            act_name = action_map.get(action, action)
            return jsonify({"success": False, "error": f"فشل الاتصال بالسيرفر لتنفيذ عملية ({act_name}) بسبب مهلة الشبكة."}), 504

    except Exception as e:
        return jsonify({"success": False, "error": f"خطأ داخلي بالخادم: {str(e)}"}), 500


# --- ACTIVE CODES STORE ENDPOINTS ---

@app.route('/api/codes/categories', methods=['GET', 'POST'])
def handle_categories():
    import time
    if request.method == 'GET':
        if SB_KEY:
            try:
                headers = get_supabase_headers()
                cat_res = requests.get(f"{SB_URL}/rest/v1/code_categories?select=*", headers=headers)
                if cat_res.status_code != 200:
                    return jsonify({"success": False, "error": f"Failed to load categories: {cat_res.text}"}), 400
                cats = cat_res.json()
                
                codes_res = requests.get(f"{SB_URL}/rest/v1/active_codes?status=eq.active&select=category_id", headers=headers)
                codes = codes_res.json() if codes_res.status_code == 200 else []
                
                counts = {}
                for c in codes:
                    cid = c.get('category_id')
                    counts[cid] = counts.get(cid, 0) + 1
                    
                categories = []
                for cat in cats:
                    categories.append({
                        "id": cat["id"],
                        "name": cat["name"],
                        "cost_credits": float(cat["price"]),
                        "available_count": counts.get(cat["id"], 0)
                    })
                return jsonify({"success": True, "categories": categories})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        else:
            db = read_db()
            categories = []
            for cat in db.get("code_categories", []):
                available_count = len([c for c in db.get("active_codes", []) if c.get("category_id") == cat["id"] and c.get("status") == "available"])
                categories.append({
                    "id": cat["id"],
                    "name": cat["name"],
                    "cost_credits": float(cat["cost_credits"]),
                    "available_count": available_count
                })
            return jsonify({"success": True, "categories": categories})
    
    elif request.method == 'POST':
        # Admin only
        data = request.json
        name = data.get('name', '').strip()
        cost_credits = float(data.get('cost_credits', 0))
        if not name or cost_credits < 0:
            return jsonify({"success": False, "error": "اسم الفئة والتكلفة مطلوبة"}), 400
        
        if SB_KEY:
            try:
                headers = get_supabase_headers()
                payload = {
                    "name": name,
                    "price": cost_credits
                }
                res = requests.post(f"{SB_URL}/rest/v1/code_categories", headers=headers, json=payload)
                if res.status_code not in [200, 201]:
                    return jsonify({"success": False, "error": f"Failed to save category: {res.text}"}), 400
                res_json = res.json()
                new_cat = res_json[0] if res_json else payload
                return jsonify({
                    "success": True, 
                    "category": {
                        "id": new_cat.get("id"),
                        "name": new_cat.get("name"),
                        "cost_credits": float(new_cat.get("price", 0))
                    }
                })
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        else:
            db = read_db()
            cat_id = int(time.time())
            new_cat = {
                "id": cat_id,
                "name": name,
                "cost_credits": cost_credits
            }
            db["code_categories"].append(new_cat)
            write_db(db)
            return jsonify({"success": True, "category": new_cat})

@app.route('/api/codes/categories/update', methods=['POST'])
def update_code_category():
    data = request.json
    category_id = data.get('category_id')
    name = data.get('name', '').strip()
    cost_credits = float(data.get('cost_credits', 0))
    
    if not category_id or not name or cost_credits < 0:
        return jsonify({"success": False, "error": "جميع المدخلات مطلوبة"}), 400
        
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            payload = {
                "name": name,
                "price": cost_credits
            }
            res = requests.patch(f"{SB_URL}/rest/v1/code_categories?id=eq.{_q(str(category_id))}", headers=headers, json=payload)
            if res.status_code not in [200, 201, 204]:
                return jsonify({"success": False, "error": f"Failed to update category: {res.text}"}), 400
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        for c in db.get("code_categories", []):
            if str(c["id"]) == str(category_id):
                c["name"] = name
                c["cost_credits"] = cost_credits
                break
        write_db(db)
        return jsonify({"success": True})

@app.route('/api/codes/categories/delete', methods=['POST'])
def delete_code_category():
    data = request.json
    category_id = data.get('category_id')
    if not category_id:
        return jsonify({"success": False, "error": "category_id مطلوب"}), 400
        
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            res = requests.delete(f"{SB_URL}/rest/v1/code_categories?id=eq.{_q(str(category_id))}", headers=headers)
            if res.status_code not in [200, 204]:
                return jsonify({"success": False, "error": f"Failed to delete category: {res.text}"}), 400
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        db["code_categories"] = [c for c in db.get("code_categories", []) if str(c["id"]) != str(category_id)]
        write_db(db)
        return jsonify({"success": True})

@app.route('/api/codes/list', methods=['GET'])
def list_codes_by_category():
    category_id = request.args.get('category_id')
    if not category_id:
        return jsonify({"success": False, "error": "category_id مطلوب"}), 400
    
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            # Get codes with seller username via join
            res = requests.get(
                f"{SB_URL}/rest/v1/active_codes?category_id=eq.{_q(str(category_id))}&select=id,code,status,sold_to,sold_at&order=id.asc",
                headers=headers
            )
            if res.status_code != 200:
                return jsonify({"success": False, "error": res.text}), 400
            codes = res.json()
            
            # Enrich sold codes with username and transaction info
            sold_codes = [c for c in codes if c.get("sold_to")]
            if sold_codes:
                sold_to_ids = list(set(c["sold_to"] for c in sold_codes))
                # Build username map - use select=* to avoid column-not-found errors
                user_map = {}
                for uid in sold_to_ids:
                    ur = requests.get(
                        f"{SB_URL}/rest/v1/users?id=eq.{uid}&select=*",
                        headers=headers
                    )
                    if ur.status_code == 200 and ur.json():
                        u = ur.json()[0]
                        user_map[uid] = (
                            u.get("username") or u.get("name") or
                            u.get("full_name") or u.get("display_name") or
                            str(uid)[:12] + "..."
                        )
                    else:
                        user_map[uid] = str(uid)[:12] + "..."
                
                # Get activity logs for financial info
                logs_res = requests.get(
                    f"{SB_URL}/rest/v1/activity_logs?action=eq.buy_code&select=reseller_id,credits_before,credits_after,details,created_at&order=created_at.desc&limit=500",
                    headers=headers
                )
                logs = logs_res.json() if logs_res.status_code == 200 else []
                
                for code in codes:
                    uid = code.get("sold_to")
                    if uid:
                        code["sold_to_username"] = user_map.get(uid, str(uid)[:12] + "...")
                        # Match log by code value appearing in details
                        matching_log = next(
                            (l for l in logs
                             if code.get("code", "") in l.get("details", "")
                             and str(l.get("reseller_id", "")) == str(uid)),
                            None
                        )
                        if matching_log:
                            code["cost_credits"] = round(float(matching_log["credits_before"]) - float(matching_log["credits_after"]), 4)
                            code["credits_before"] = matching_log["credits_before"]
                            code["credits_after"] = matching_log["credits_after"]
                        else:
                            code["cost_credits"] = None
                            code["credits_before"] = None
                            code["credits_after"] = None
            
            return jsonify({"success": True, "codes": codes})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        codes = [c for c in db.get("active_codes", []) if str(c.get("category_id")) == str(category_id)]
        
        # Enrich with username and log data from local db
        user_map = {u["id"]: u.get("username") or u.get("name") or u["id"] for u in db.get("users", [])}
        logs = [l for l in db.get("activity_logs", []) if l.get("action") == "buy_code"]
        
        for code in codes:
            if code.get("status") == "sold" and code.get("sold_to"):
                uid = code["sold_to"]
                code["sold_to_username"] = user_map.get(uid, uid)
                matching_log = next(
                    (l for l in logs if code.get("code", "") in l.get("details", "") and str(l.get("reseller_id", "")) == str(uid)),
                    None
                )
                if matching_log:
                    code["cost_credits"] = round(float(matching_log.get("credits_before", 0)) - float(matching_log.get("credits_after", 0)), 4)
                    code["credits_before"] = matching_log.get("credits_before")
                    code["credits_after"] = matching_log.get("credits_after")
                else:
                    code["cost_credits"] = None
                    code["credits_before"] = None
                    code["credits_after"] = None
        
        return jsonify({"success": True, "codes": codes})

@app.route('/api/codes/delete_code', methods=['POST'])
def delete_single_code():
    data = request.json
    code_id = data.get('code_id')
    if not code_id:
        return jsonify({"success": False, "error": "code_id مطلوب"}), 400
    
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            res = requests.delete(f"{SB_URL}/rest/v1/active_codes?id=eq.{_q(str(code_id))}", headers=headers)
            if res.status_code not in [200, 204]:
                return jsonify({"success": False, "error": res.text}), 400
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        db["active_codes"] = [c for c in db.get("active_codes", []) if str(c.get("id")) != str(code_id)]
        write_db(db)
        return jsonify({"success": True})

@app.route('/api/codes/upload', methods=['POST'])
def upload_codes():
    data = request.json
    category_id = data.get('category_id')
    codes_str = data.get('codes', '').strip()
    if not category_id or not codes_str:
        return jsonify({"success": False, "error": "فئة الأكواد وقائمة الأكواد مطلوبة"}), 400
    
    codes_list = [c.strip() for c in codes_str.replace(',', '\n').split('\n') if c.strip()]
    if not codes_list:
        return jsonify({"success": False, "error": "لا توجد أكواد صالحة لرفعها"}), 400
        
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            existing_res = requests.get(f"{SB_URL}/rest/v1/active_codes?select=code", headers=headers)
            existing_codes = {c['code'] for c in existing_res.json()} if existing_res.status_code == 200 else set()
            
            payload = []
            added = 0
            for code_val in codes_list:
                if code_val not in existing_codes:
                    payload.append({
                        "code": code_val,
                        "category_id": int(category_id),
                        "status": "active"
                    })
                    added += 1
            
            if payload:
                res = requests.post(f"{SB_URL}/rest/v1/active_codes", headers=headers, json=payload)
                if res.status_code not in [200, 201]:
                    return jsonify({"success": False, "error": f"Failed to upload codes: {res.text}"}), 400
            
            return jsonify({"success": True, "message": f"تم بنجاح رفع {added} كود جديد لهذه الفئة!"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        cat = next((c for c in db.get("code_categories", []) if str(c["id"]) == str(category_id)), None)
        if not cat:
            return jsonify({"success": False, "error": "الفئة المحددة غير موجودة"}), 404
            
        added = 0
        import time
        for code_val in codes_list:
            exists = any(c["code"] == code_val and str(c["category_id"]) == str(category_id) for c in db.get("active_codes", []))
            if not exists:
                db["active_codes"].append({
                    "id": "code_" + str(int(time.time())) + "_" + str(added),
                    "category_id": category_id,
                    "code": code_val,
                    "status": "available",
                    "sold_to": None,
                    "sold_at": None
                })
                added += 1
                
        write_db(db)
        return jsonify({"success": True, "message": f"تم بنجاح رفع {added} كود جديد لهذه الفئة!"})

@app.route('/api/codes/buy', methods=['POST'])
def buy_code():
    data = request.json
    reseller_id = data.get('reseller_id')
    category_id = data.get('category_id')
    if not reseller_id or not category_id:
        return jsonify({"success": False, "error": "reseller_id و category_id مطلوبة"}), 400
        
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers)
            if user_res.status_code != 200 or not user_res.json():
                return jsonify({"success": False, "error": "المستخدم غير موجود بالنظام"}), 404
            user = user_res.json()[0]
            
            cat_res = requests.get(f"{SB_URL}/rest/v1/code_categories?id=eq.{_q(str(category_id))}", headers=headers)
            if cat_res.status_code != 200 or not cat_res.json():
                return jsonify({"success": False, "error": "الفئة غير موجودة بالسيستم"}), 404
            cat = cat_res.json()[0]
            
            cost_credits = float(cat["price"])
            current_credits = float(user["credits"])
            if user["role"] == "reseller" and current_credits < cost_credits:
                return jsonify({"success": False, "error": "رصيد الج.م لديك غير كافٍ لشراء هذا الكود!"}), 400
                
            codes_res = requests.get(f"{SB_URL}/rest/v1/active_codes?category_id=eq.{_q(str(category_id))}&status=eq.active&limit=1", headers=headers)
            if codes_res.status_code != 200 or not codes_res.json():
                return jsonify({"success": False, "error": "عذراً! نفذت الأكواد المتاحة في هذا القسم حالياً."}), 400
            
            purchased_code = codes_res.json()[0]
            code_id = purchased_code["id"]
            
            update_code_payload = {
                "status": "sold",
                "sold_to": reseller_id,
                "sold_at": datetime.now().isoformat()
            }
            update_res = requests.patch(f"{SB_URL}/rest/v1/active_codes?id=eq.{_q(str(code_id))}", headers=headers, json=update_code_payload)
            if update_res.status_code not in [200, 201, 204]:
                return jsonify({"success": False, "error": "فشل حجز الكود"}), 400
                
            new_credits = current_credits
            if user["role"] == "reseller":
                new_credits = current_credits - cost_credits
                update_user_res = requests.patch(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers, json={"credits": new_credits})
                if update_user_res.status_code not in [200, 201, 204]:
                    requests.patch(f"{SB_URL}/rest/v1/active_codes?id=eq.{_q(str(code_id))}", headers=headers, json={"status": "active", "sold_to": None, "sold_at": None})
                    return jsonify({"success": False, "error": "فشل خصم الرصيد"}), 400
                  
            log_payload = {
                "reseller_id": reseller_id,
                "action": "buy_code",
                "credits_before": current_credits,
                "credits_after": new_credits,
                "details": f"شراء كود تفعيل {cat['name']} ({purchased_code['code']})"
            }
            requests.post(f"{SB_URL}/rest/v1/activity_logs", headers=headers, json=log_payload)
            
            return jsonify({
                "success": True,
                "message": f"تم شراء الكود بنجاح لـ {cat['name']} وتم خصم {cost_credits} ج.م!",
                "code": purchased_code["code"],
                "category_name": cat["name"],
                "cost_credits": cost_credits,
                "credits_remaining": new_credits
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        user = next((u for u in db["users"] if u["id"] == reseller_id), None)
        if not user:
            return jsonify({"success": False, "error": "المستخدم غير موجود بالنظام المحلي"}), 404
            
        cat = next((c for c in db.get("code_categories", []) if str(c["id"]) == str(category_id)), None)
        if not cat:
            return jsonify({"success": False, "error": "الفئة غير موجودة بالسيستم"}), 404
            
        cost_credits = float(cat["cost_credits"])
        if user["role"] == "reseller" and float(user["credits"]) < cost_credits:
            return jsonify({"success": False, "error": "رصيد الج.م لديك غير كافٍ لشراء هذا الكود!"}), 400
            
        available_codes = [c for c in db.get("active_codes", []) if str(c["category_id"]) == str(category_id) and c["status"] == "available"]
        if not available_codes:
            return jsonify({"success": False, "error": "عذراً! نفذت الأكواد المتاحة في هذا القسم حالياً."}), 400
            
        purchased_code = available_codes[0]
        purchased_code["status"] = "sold"
        purchased_code["sold_to"] = reseller_id
        purchased_code["sold_at"] = datetime.now().isoformat()
        
        user["credits"] = float(user["credits"]) - cost_credits
        
        import time
        new_log = {
            "id": "log_code_" + str(int(time.time())),
            "reseller_id": reseller_id,
            "action": "buy_code",
            "credits_before": float(user["credits"]) + cost_credits,
            "credits_after": float(user["credits"]),
            "details": f"شراء كود تفعيل {cat['name']} ({purchased_code['code']})",
            "created_at": datetime.now().isoformat()
        }
        db["activity_logs"].insert(0, new_log)
        write_db(db)
        
        return jsonify({
            "success": True,
            "message": f"تم شراء الكود بنجاح لـ {cat['name']} وتم خصم {cost_credits} ج.م!",
            "code": purchased_code["code"],
            "category_name": cat["name"],
            "cost_credits": cost_credits,
            "credits_remaining": user["credits"]
        })

@app.route('/api/codes/history', methods=['GET'])
def get_codes_history():
    reseller_id = request.args.get('reseller_id')  # This is username (e.g. "medo2026")
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            
            # Resolve username or UUID -> reseller_uuid
            reseller_uuid = None
            if reseller_id:
                # If it's already a UUID (e.g. format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
                if len(reseller_id) == 36 and reseller_id.count('-') == 4:
                    reseller_uuid = reseller_id
                else:
                    user_res = requests.get(
                        f"{SB_URL}/rest/v1/users?username=eq.{_q(str(reseller_id))}&select=id",
                        headers=headers
                    )
                    if user_res.status_code == 200 and user_res.json():
                        reseller_uuid = user_res.json()[0]["id"]
            
            query = "select=*,code_categories(name)"
            if reseller_uuid:
                url = f"{SB_URL}/rest/v1/active_codes?status=eq.sold&sold_to=eq.{_q(str(reseller_uuid))}&{query}&order=sold_at.desc"
            elif reseller_id and not reseller_uuid:
                # UUID/username not found - return empty history gracefully
                return jsonify({"success": True, "history": []})
            else:
                url = f"{SB_URL}/rest/v1/active_codes?status=eq.sold&{query}&order=sold_at.desc"
                
            res = requests.get(url, headers=headers)
            if res.status_code != 200:
                return jsonify({"success": False, "error": f"Failed to fetch history: {res.text}"}), 400
            
            history = []
            for c in res.json():
                history.append({
                    "code": c["code"],
                    "category_name": c.get("code_categories", {}).get("name", "Unknown") if c.get("code_categories") else "Unknown",
                    "sold_to": c["sold_to"],
                    "sold_at": c["sold_at"]
                })
            return jsonify({"success": True, "history": history})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        sold_codes = [c for c in db.get("active_codes", []) if c["status"] == "sold"]
        if reseller_id:
            sold_codes = [c for c in sold_codes if str(c.get("sold_to", "")) == str(reseller_id)]
            
        history = []
        for c in sold_codes:
            cat = next((cat for cat in db.get("code_categories", []) if str(cat["id"]) == str(c["category_id"])), None)
            history.append({
                "code": c["code"],
                "category_name": cat["name"] if cat else "Unknown",
                "sold_to": c.get("sold_to", ""),
                "sold_at": c.get("sold_at", "")
            })
        return jsonify({"success": True, "history": history})


# --- XTREAM PANELS ENDPOINTS ---

@app.route('/api/panels', methods=['GET', 'POST'])
def handle_panels():
    if request.method == 'GET':
        if SB_KEY:
            try:
                headers = get_supabase_headers()
                res = requests.get(f"{SB_URL}/rest/v1/xtream_panels?select=*&order=id.asc", headers=headers)
                if res.status_code != 200:
                    return jsonify({"success": False, "error": res.text}), 400
                return jsonify({"success": True, "panels": res.json()})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        else:
            db = read_db()
            return jsonify({"success": True, "panels": db.get("xtream_panels", [])})
            
    elif request.method == 'POST':
        data = request.json
        panel_id = data.get('id')
        name = data.get('name')
        domain_url = data.get('domain_url')
        api_username = data.get('api_username')
        api_password = data.get('api_password')
        decryption_key = data.get('decryption_key', 'mh123321')
        stream_url = data.get('stream_url', '').strip()
        
        if not name or not domain_url or not api_username or not api_password:
            return jsonify({"success": False, "error": "جميع الحقول مطلوبة"}), 400
            
        if SB_KEY:
            try:
                headers = get_supabase_headers()
                
                payload = {
                    "name": name,
                    "domain_url": domain_url,
                    "api_username": api_username,
                    "api_password": api_password,
                    "status": "active"
                }
                if stream_url:
                    payload["stream_url"] = stream_url
                
                if panel_id:
                    res = requests.patch(f"{SB_URL}/rest/v1/xtream_panels?id=eq.{_q(str(panel_id))}", headers=headers, json=payload)
                    if res.status_code not in [200, 201, 204]:
                        return jsonify({"success": False, "error": res.text}), 400
                    payload['id'] = panel_id
                    new_panel = payload
                else:
                    check_res = requests.get(f"{SB_URL}/rest/v1/xtream_panels?name=eq.{name}", headers=headers)
                    existing = check_res.json() if check_res.status_code == 200 else []
                    if existing:
                        p_id = existing[0]['id']
                        res = requests.patch(f"{SB_URL}/rest/v1/xtream_panels?id=eq.{p_id}", headers=headers, json=payload)
                        if res.status_code not in [200, 201, 204]:
                            return jsonify({"success": False, "error": res.text}), 400
                        payload['id'] = p_id
                        new_panel = payload
                    else:
                        res = requests.post(f"{SB_URL}/rest/v1/xtream_panels", headers=headers, json=payload)
                        if res.status_code not in [200, 201]:
                            return jsonify({"success": False, "error": res.text}), 400
                        new_panel = res.json()[0] if res.json() else payload
                    
                return jsonify({"success": True, "panel": new_panel})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        else:
            db = read_db()
            if panel_id:
                existing = next((p for p in db.get("xtream_panels", []) if p["id"] == int(panel_id)), None)
            else:
                existing = next((p for p in db.get("xtream_panels", []) if p["name"] == name or p["domain_url"] == domain_url), None)
                
            if existing:
                existing["name"] = name
                existing["domain_url"] = domain_url
                existing["api_username"] = api_username
                existing["api_password"] = api_password
                existing["decryption_key"] = decryption_key
                if stream_url:
                    existing["stream_url"] = stream_url
                new_panel = existing
            else:
                new_panel = {
                    "id": len(db.get("xtream_panels", [])) + 1,
                    "name": name,
                    "domain_url": domain_url,
                    "api_username": api_username,
                    "api_password": api_password,
                    "decryption_key": decryption_key,
                    "stream_url": stream_url,
                    "status": "active"
                }
                db["xtream_panels"].append(new_panel)
                
            write_db(db)
            return jsonify({"success": True, "panel": new_panel})

@app.route('/api/panels/delete/<int:panel_id>', methods=['POST', 'DELETE'])
def delete_panel(panel_id):
    if SB_KEY:
        try:
            headers = get_supabase_headers()
            res = requests.delete(f"{SB_URL}/rest/v1/xtream_panels?id=eq.{_q(str(panel_id))}", headers=headers)
            if res.status_code not in [200, 201, 204]:
                return jsonify({"success": False, "error": res.text}), 400
            return jsonify({"success": True, "message": "تم حذف السيرفر بنجاح"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        db = read_db()
        db["xtream_panels"] = [p for p in db.get("xtream_panels", []) if p["id"] != panel_id]
        write_db(db)
        return jsonify({"success": True, "message": "تم حذف السيرفر بنجاح"})

# --- 100% SECURE MODE PROXY ENDPOINTS ---

def resolve_user_id(user_id):
    if not SB_KEY or not user_id:
        return user_id
    import uuid
    try:
        uuid.UUID(str(user_id))
        return user_id
    except ValueError:
        try:
            headers = get_supabase_headers()
            res = requests.get(f"{SB_URL}/rest/v1/users?username=eq.{_q(str(user_id))}", headers=headers)
            if res.status_code == 200 and res.json():
                return res.json()[0]['id']
        except Exception as e:
            print("resolve_user_id error:", e)
        return user_id

def get_verified_user():
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return None
    if SB_KEY:
        try:
            import urllib.parse
            encoded_id = urllib.parse.quote(str(user_id))
            headers = get_supabase_headers()
            res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(encoded_id))}&select=id,role,status", headers=headers)
            if res.status_code == 200 and res.json():
                user = res.json()[0]
                if user.get('status') == 'active':
                    return user
        except Exception as e:
            print("[!] get_verified_user check failed:", e)
    else:
        db = read_db()
        user = next((u for u in db.get("users", []) if u["id"] == user_id), None)
        if user and user.get('status') == 'active':
            return user
    return None

def is_admin_request():
    user = get_verified_user()
    return user is not None and user.get('role') == 'admin'

# 1. Admin Resellers Management
@app.route('/api/admin/resellers', methods=['GET'])
def admin_get_resellers():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    if not SB_KEY:
        db = read_db()
        resellers = [u for u in db.get("users", []) if u.get("role") == "reseller"]
        return jsonify(resellers)
    try:
        headers = get_supabase_headers()
        res = requests.get(f"{SB_URL}/rest/v1/users?role=eq.reseller&order=created_at.desc", headers=headers)
        if res.status_code != 200:
            return jsonify({"error": res.text}), 400
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/resellers', methods=['POST'])
def admin_create_reseller():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    username = data.get("username")
    password_plain = data.get("password")
    if not password_plain and data.get("password_hash"):
        password_plain = data.get("password_hash")
    credits = float(data.get("credits", 0.00))
    status = data.get("status", "active")
    
    if not username or not password_plain:
        return jsonify({"success": False, "error": "اسم المستخدم وكلمة المرور مطلوبة"}), 400

    # Hash using bcrypt
    password_hash = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    if not SB_KEY:
        db = read_db()
        if any(u["username"] == username for u in db.get("users", [])):
            return jsonify({"success": False, "error": "اسم المستخدم موجود بالفعل"}), 400
        new_reseller = {
            "id": username,
            "username": username,
            "password_hash": password_hash,
            "role": "reseller",
            "credits": credits,
            "status": status
        }
        db["users"].append(new_reseller)
        write_db(db)
        return jsonify({"success": True, "reseller": new_reseller})
        
    try:
        headers = get_supabase_headers()
        payload = {
            "username": username,
            "password_hash": password_hash,
            "role": "reseller",
            "credits": credits,
            "status": status
        }
        res = requests.post(f"{SB_URL}/rest/v1/users", headers=headers, json=payload)
        if res.status_code not in [200, 201]:
            return jsonify({"success": False, "error": res.text}), 400
        
        user_data = res.json()
        new_user = user_data[0] if isinstance(user_data, list) and user_data else user_data
        
        if credits > 0:
            tx_payload = {
                "sub_reseller_id": new_user["id"],
                "amount": credits,
                "action_type": "deposit",
                "description": "رصيد ترحيبي عند إنشاء الحساب بواسطة المسؤول"
            }
            requests.post(f"{SB_URL}/rest/v1/credit_transactions", headers=headers, json=tx_payload)
            
        return jsonify({"success": True, "reseller": new_user})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/resellers/update', methods=['POST'])
def admin_update_reseller():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    reseller_id = data.get("id")
    new_username = data.get("username")
    new_password = data.get("password")
    new_credits = data.get("credits")
    new_status = data.get("status")

    if not reseller_id:
        return jsonify({"success": False, "error": "معرف الموزع مطلوب"}), 400

    if not SB_KEY:
        db = read_db()
        user = next((u for u in db.get("users", []) if u["id"] == reseller_id), None)
        if not user:
            return jsonify({"success": False, "error": "الموزع غير موجود"}), 404
        
        if new_username:
            user["username"] = new_username
            user["id"] = new_username
        if new_password:
            hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user["password_hash"] = hashed
        if new_credits is not None:
            user["credits"] = float(new_credits)
        if new_status:
            user["status"] = new_status
            
        write_db(db)
        return jsonify({"success": True})

    try:
        headers = get_supabase_headers()
        resolved_id = resolve_user_id(reseller_id)
        
        payload = {}
        if new_username:
            payload["username"] = new_username
        if new_password:
            hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            payload["password_hash"] = hashed
        if new_credits is not None:
            payload["credits"] = float(new_credits)
        if new_status:
            payload["status"] = new_status

        if not payload:
            return jsonify({"success": True, "message": "لا توجد تعديلات لتحديثها"})

        up_res = requests.patch(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(resolved_id))}", headers=headers, json=payload)
        if up_res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": up_res.text}), 400

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/resellers/transfer', methods=['POST'])
def admin_transfer_credits():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    reseller_id = data.get("resellerId")
    amount = float(data.get("amount", 0.0))
    
    if not SB_KEY:
        db = read_db()
        user = next((u for u in db.get("users", []) if u["id"] == reseller_id), None)
        if not user:
            return jsonify({"success": False, "error": "الموزع غير موجود"}), 404
        user["credits"] = float(user.get("credits", 0.0)) + amount
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        resolved_id = resolve_user_id(reseller_id)
        
        user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(resolved_id))}", headers=headers)
        if user_res.status_code != 200 or not user_res.json():
            return jsonify({"success": False, "error": "الموزع غير موجود"}), 404
            
        user = user_res.json()[0]
        new_credits = float(user["credits"]) + amount
        
        up_res = requests.patch(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(resolved_id))}", headers=headers, json={"credits": new_credits})
        if up_res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": up_res.text}), 400
            
        tx_payload = {
            "sub_reseller_id": resolved_id,
            "amount": amount,
            "action_type": "deposit" if amount >= 0 else "deduct",
            "description": f"شحن رصيد بقيمة {amount} بواسطة المسؤول"
        }
        requests.post(f"{SB_URL}/rest/v1/credit_transactions", headers=headers, json=tx_payload)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/resellers/status', methods=['POST'])
def admin_toggle_reseller_status():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    reseller_id = data.get("resellerId")
    status = data.get("status")
    
    if not SB_KEY:
        db = read_db()
        user = next((u for u in db.get("users", []) if u["id"] == reseller_id), None)
        if not user:
            return jsonify({"success": False, "error": "الموزع غير موجود"}), 404
        user["status"] = status
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        resolved_id = resolve_user_id(reseller_id)
        up_res = requests.patch(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(resolved_id))}", headers=headers, json={"status": status})
        if up_res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": up_res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/resellers/delete', methods=['POST'])
def admin_delete_reseller():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    reseller_id = data.get("resellerId")
    
    if not SB_KEY:
        db = read_db()
        db["users"] = [u for u in db.get("users", []) if u["id"] != reseller_id]
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        resolved_id = resolve_user_id(reseller_id)
        del_res = requests.delete(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(resolved_id))}", headers=headers)
        if del_res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": del_res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# 2. Admin Services Management
@app.route('/api/admin/services', methods=['GET'])
def admin_get_services():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    if not SB_KEY:
        db = read_db()
        return jsonify(db.get("services", []))
    try:
        headers = get_supabase_headers()
        res = requests.get(f"{SB_URL}/rest/v1/services?select=*,xtream_panels(name)&order=id.asc", headers=headers)
        if res.status_code != 200:
            return jsonify({"error": res.text}), 400
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/services', methods=['POST'])
def admin_add_service():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    if not SB_KEY:
        db = read_db()
        new_svc = {
            "id": len(db.get("services", [])) + 1,
            "panel_id": int(data.get("panel_id")),
            "service_name": data.get("service_name"),
            "package_id": int(data.get("package_id")),
            "cost_credits": float(data.get("cost_credits", 1.0))
        }
        db["services"].append(new_svc)
        write_db(db)
        return jsonify({"success": True, "service": new_svc})
        
    try:
        headers = get_supabase_headers()
        res = requests.post(f"{SB_URL}/rest/v1/services", headers=headers, json=data)
        if res.status_code not in [200, 201]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/services/delete', methods=['POST'])
def admin_delete_service():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json
    service_id = data.get("serviceId")
    
    if not SB_KEY:
        db = read_db()
        db["services"] = [s for s in db.get("services", []) if s["id"] != service_id]
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.delete(f"{SB_URL}/rest/v1/services?id=eq.{_q(str(service_id))}", headers=headers)
        if res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/services/update_price', methods=['POST'])
def admin_update_service_price():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    data = request.json or {}
    service_id = data.get("serviceId")
    new_price = data.get("newPrice")
    
    if service_id is None or new_price is None:
        return jsonify({"success": False, "error": "جميع المدخلات مطلوبة"}), 400
        
    try:
        new_price = float(new_price)
        if new_price < 0:
            return jsonify({"success": False, "error": "السعر لا يمكن أن يكون سالباً"}), 400
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "السعر غير صالح"}), 400

    if not SB_KEY:
        db = read_db()
        found = False
        for s in db.get("services", []):
            if s["id"] == service_id:
                s["cost_credits"] = new_price
                found = True
                break
        if not found:
            return jsonify({"success": False, "error": "الخدمة غير موجودة"}), 404
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.patch(
            f"{SB_URL}/rest/v1/services?id=eq.{_q(str(service_id))}",
            headers=headers,
            json={"cost_credits": new_price}
        )
        if res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# 3. Admin Logs
@app.route('/api/admin/logs', methods=['GET'])
def admin_get_logs():
    if not is_admin_request():
        return jsonify({"success": False, "error": "غير مصرح بالدخول لغير المسؤول"}), 403
    if not SB_KEY:
        db = read_db()
        return jsonify({
            "subscriptions": db.get("subscriptions", []),
            "transactions": db.get("activity_logs", [])
        })
    try:
        headers = get_supabase_headers()
        subs_res = requests.get(
            f"{SB_URL}/rest/v1/subscriptions_log?select=*,users!subscriptions_log_sub_reseller_id_fkey(username),xtream_panels(name),services(service_name)&order=created_at.desc",
            headers=headers
        )
        txs_res = requests.get(
            f"{SB_URL}/rest/v1/credit_transactions?select=*,users(username)&order=created_at.desc",
            headers=headers
        )
        
        subs = subs_res.json() if subs_res.status_code == 200 else []
        txs = txs_res.json() if txs_res.status_code == 200 else []
        
        return jsonify({
            "subscriptions": subs,
            "transactions": txs
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 4. Customers Management
@app.route('/api/customers', methods=['GET'])
def get_customers():
    table = 'iptv_customers'
    
    if not SB_KEY:
        db = read_db()
        return jsonify(db.get(table, []))
        
    try:
        headers = get_supabase_headers()
        res = requests.get(f"{SB_URL}/rest/v1/{table}?select=*&order=created_at.desc", headers=headers)
        if res.status_code != 200:
            return jsonify({"error": res.text}), 400
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers', methods=['POST'])
def add_customer():
    table = 'iptv_customers'
    data = request.json
    
    if not SB_KEY:
        db = read_db()
        if table not in db:
            db[table] = []
        new_cust = {
            "id": f"cust_{int(datetime.now().timestamp())}_{len(db[table])}",
            **data,
            "created_at": datetime.now().isoformat()
        }
        db[table].append(new_cust)
        write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.post(f"{SB_URL}/rest/v1/{table}", headers=headers, json=data)
        if res.status_code not in [200, 201]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/customers/update', methods=['POST'])
def update_customer():
    table = 'iptv_customers'
    data = request.json
    customer_id = data.get('id')
    updates = data.get('updates', {})
    
    if not SB_KEY:
        db = read_db()
        if table in db:
            for c in db[table]:
                if c["id"] == customer_id:
                    c.update(updates)
            write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.patch(f"{SB_URL}/rest/v1/{table}?id=eq.{customer_id}", headers=headers, json=updates)
        if res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/customers/renew', methods=['POST'])
def renew_customer():
    table = 'iptv_customers'
    data = request.json
    customer_id = data.get('id')
    expire_date = data.get('expire_date')
    
    if not SB_KEY:
        db = read_db()
        if table in db:
            for c in db[table]:
                if c["id"] == customer_id:
                    c["expire_date"] = expire_date
            write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.patch(f"{SB_URL}/rest/v1/{table}?id=eq.{customer_id}", headers=headers, json={"expire_date": expire_date})
        if res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/customers/delete', methods=['POST'])
def delete_customer():
    table = 'iptv_customers'
    data = request.json
    customer_id = data.get('id')
    
    if not SB_KEY:
        db = read_db()
        if table in db:
            db[table] = [c for c in db[table] if c["id"] != customer_id]
            write_db(db)
        return jsonify({"success": True})
        
    try:
        headers = get_supabase_headers()
        res = requests.delete(f"{SB_URL}/rest/v1/{table}?id=eq.{customer_id}", headers=headers)
        if res.status_code not in [200, 204]:
            return jsonify({"success": False, "error": res.text}), 400
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# 5. Reseller Details for Admin Panel
@app.route('/api/admin/reseller/details', methods=['GET'])
def get_reseller_details():
    reseller_raw = request.args.get('reseller_id')
    if not reseller_raw:
        return jsonify({"error": "Missing reseller_id"}), 400
        
    reseller_id = resolve_user_id(reseller_raw)
    
    if not SB_KEY:
        db = read_db()
        user = next((u for u in db.get("users", []) if u["id"] == reseller_id), None)
        if not user:
            return jsonify({"error": "Reseller not found"}), 404
            
        subs = [s for s in db.get("subscriptions", []) if s.get("reseller_id") == reseller_id]
        txs = [t for t in db.get("credit_transactions", []) if t.get("sub_reseller_id") == reseller_id]
        
        codes = [c for c in db.get("active_codes", []) if c.get("sold_to") == reseller_id]
        for c in codes:
            cat = next((cat for cat in db.get("code_categories", []) if cat["id"] == c.get("category_id")), {})
            c["code_categories"] = cat
            
        return jsonify({
            "success": True,
            "reseller": user,
            "subscriptions": subs,
            "transactions": txs,
            "purchased_codes": codes
        })
        
    try:
        headers = get_supabase_headers()
        
        # Fetch user
        user_res = requests.get(f"{SB_URL}/rest/v1/users?id=eq.{_q(str(reseller_id))}", headers=headers)
        if user_res.status_code != 200 or not user_res.json():
            return jsonify({"error": "Reseller not found"}), 404
        user = user_res.json()[0]
        
        # Fetch subscriptions
        subs_res = requests.get(f"{SB_URL}/rest/v1/subscriptions_log?sub_reseller_id=eq.{_q(str(reseller_id))}&select=*,xtream_panels(name),services(service_name)&order=created_at.desc", headers=headers)
        subs = subs_res.json() if subs_res.status_code == 200 else []
        
        # Fetch transactions
        txs_res = requests.get(f"{SB_URL}/rest/v1/credit_transactions?sub_reseller_id=eq.{_q(str(reseller_id))}&select=*&order=created_at.desc", headers=headers)
        txs = txs_res.json() if txs_res.status_code == 200 else []
        
        # Fetch purchased codes
        codes_res = requests.get(f"{SB_URL}/rest/v1/active_codes?sold_to=eq.{_q(str(reseller_id))}&select=*,code_categories(name)&order=sold_at.desc", headers=headers)
        codes = codes_res.json() if codes_res.status_code == 200 else []
        
        return jsonify({
            "success": True,
            "reseller": user,
            "subscriptions": subs,
            "transactions": txs,
            "purchased_codes": codes
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print(f"[*] Starting local server on http://localhost:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
