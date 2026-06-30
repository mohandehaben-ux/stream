// App Configuration
// البيانات دي بتتحفظ في المتصفح من إعدادات الموقع ⚙️
localStorage.removeItem('SB_URL');
localStorage.removeItem('SB_KEY');
window.APP_CONFIG = {
    GH_REPO: localStorage.getItem('GH_REPO') || 'mohanadehab7-sudo/crm'
};
