package com.kanaanshop.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * سقف لتكبير الخط القادم من إعدادات النظام.
 *
 * المشكلة: WebView بأندرويد بيطبّق مقياس خط النظام على كل النصوص جوا
 * التطبيق. لما المستخدم يحط الخط على أكبر حجم (بعض الأجهزة بتوصل 200%)،
 * النصوص بتكبر بس الحاويات (شريط التنقّل، البادجات، بطاقات الفئات)
 * ما بتكبر معها بنفس النسبة — فالنص بيطلع برا مكانه وبينكسر الشكل.
 *
 * ليش سقف بدل تعطيل كامل: تعطيل تكبير الخط نهائياً (setTextZoom(100))
 * بيأذي فعلياً الناس يلي كبّروا الخط لأنهم بيحتاجوه — وهاد تراجع
 * بإمكانية الوصول مش حل. فمنسمح بالتكبير لحد 120%، وهو فرق ملموس
 * وبيساعد فعلاً، بس بيضل ضمن حدود التصميم بدون ما ينكسر.
 */
public class MainActivity extends BridgeActivity {
    private static final float MAX_FONT_SCALE = 1.20f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            float systemScale = getResources().getConfiguration().fontScale;
            float capped = Math.min(systemScale, MAX_FONT_SCALE);
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().getSettings().setTextZoom(Math.round(capped * 100));
            }
        } catch (Exception e) {
            // لو صار أي شي غير متوقع، منسيب السلوك الافتراضي — أهون
            // بكتير من إنو التطبيق يوقف عن الفتح أصلاً
        }
    }
}
