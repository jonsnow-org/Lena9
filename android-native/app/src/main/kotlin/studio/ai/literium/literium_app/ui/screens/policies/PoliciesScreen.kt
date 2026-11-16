package studio.ai.literium.literium_app.ui.screens.policies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import studio.ai.literium.literium_app.ui.theme.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.util.PayoutRules
import studio.ai.literium.literium_app.util.RevenueShares

/**
 * Static legal/info pages — Compose port of `LegalPages.tsx` (the real,
 * full-page destination the app's footer/drawer link to; `PoliciesModal.tsx`
 * is a shorter in-app modal summary of the same three legal sections and is
 * not separately ported — this screen supersedes it with the complete text).
 *
 * Real page set, verified against `LegalPages.tsx`'s own `LegalSection`
 * union (not the task brief's guess of "privacy + AdSense policy" — there
 * is no separate standalone AdSense-policy page in the source; AdSense/
 * Google-partner disclosure is folded into the "الإعلانات وخدمات الطرف
 * الثالث" section of the privacy policy itself, and into the ad-revenue
 * clause of the terms page): `privacy`, `terms`, `about`, `contact`.
 * [Screen.Policies.of] accepts any of these four; an unrecognized value
 * falls back to `privacy`.
 *
 * Every dollar figure / percentage / day-count below is read live from
 * [RevenueShares]/[PayoutRules] (never a separately hand-typed number), so
 * this page can never silently drift from the numbers enforced elsewhere
 * in the app.
 */
private const val LAST_UPDATED = "21 أغسطس 2026"
private val CONTACT_EMAIL = PlatformConstants.OWNER_ADMIN_EMAIL

private data class PolicyPage(val key: String, val label: String)

private val PAGES = listOf(
    PolicyPage("privacy", "سياسة الخصوصية"),
    PolicyPage("terms", "شروط الاستخدام"),
    PolicyPage("about", "من نحن"),
    PolicyPage("contact", "اتصل بنا")
)

@Composable private fun bodyColor() = if (isDark) Tw.slate300 else Tw.slate600
@Composable private fun titleColor() = if (isDark) Tw.white else Tw.slate900

/** السياسات — LegalPages.tsx: زر عودة، شرائح الأقسام (rounded-2xl)، ثم مقالة داخل بطاقة rounded-3xl (H2 18sp black، P 14sp سطر 1.9، قوائم). */
@Composable
fun PoliciesScreen(navController: NavController, page: String) {
    var section by remember { mutableStateOf(if (PAGES.any { it.key == page }) page else "privacy") }
    val dark = isDark
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp).padding(top = 16.dp, bottom = 12.dp)) {
        Row(Modifier.twClickable { navController.popBackStack() }.padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LuIcon(Lu.ArrowRight, 16.dp, if (dark) Tw.slate400 else Tw.slate500)
            Text("العودة إلى المنصة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PAGES.forEach { pg ->
                val active = section == pg.key
                val icon = when (pg.key) { "privacy" -> Lu.Shield; "terms" -> Lu.FileText; "about" -> Lu.Info; else -> Lu.Mail }
                Row(
                    Modifier.clip(RoundedCornerShape(16.dp)).background(if (active) brand.s600 else (if (dark) Tw.slate800 else Tw.slate100)).twClickable { section = pg.key }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    LuIcon(icon, 16.dp, if (active) Tw.white else (if (dark) Tw.slate300 else Tw.slate600))
                    Text(pg.label, style = twText(12, FontWeight.Bold, 16), color = if (active) Tw.white else (if (dark) Tw.slate300 else Tw.slate600), maxLines = 1)
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
        val card = RoundedCornerShape(24.dp)
        Box(Modifier.padding(top = 16.dp).weight(1f).fillMaxWidth().clip(card).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, card)) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                when (section) {
                    "privacy" -> privacyContent(this)
                    "terms" -> termsContent(this)
                    "about" -> aboutContent(this)
                    "contact" -> contactContent(this)
                }
            }
        }
    }
}

private fun h2(scope: androidx.compose.foundation.lazy.LazyListScope, text: String) {
    scope.item { Text(text, Modifier.padding(top = 28.dp, bottom = 10.dp), style = twText(18, FontWeight.Black, 26), color = titleColor()) }
}

private fun p(scope: androidx.compose.foundation.lazy.LazyListScope, text: String) {
    scope.item { Text(text, Modifier.padding(bottom = 12.dp), style = twText(14, FontWeight.Normal, 27), color = bodyColor()) }
}

private fun ul(scope: androidx.compose.foundation.lazy.LazyListScope, items: List<String>) {
    scope.items(items) { line ->
        Text("• $line", Modifier.padding(bottom = 6.dp, start = 0.dp, end = 16.dp), style = twText(14, FontWeight.Normal, 27), color = bodyColor())
    }
}

private fun privacyContent(scope: androidx.compose.foundation.lazy.LazyListScope) {
    scope.item {
        Column {
            Text("سياسة الخصوصية", style = twText(22, FontWeight.Black, 30), color = titleColor())
            Text("آخر تحديث: $LAST_UPDATED", style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
        }
    }

    h2(scope, "مقدمة")
    p(
        scope,
        "نحن في منصة ليتيريوم نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيف نجمع " +
            "معلوماتك ونستخدمها ونحميها عند استخدامك للمنصة. باستخدامك للمنصة، فإنك توافق على الممارسات الموضحة هنا."
    )

    h2(scope, "المعلومات التي نجمعها")
    p(scope, "معلومات تقدمها أنت مباشرة:")
    ul(
        scope,
        listOf(
            "البريد الإلكتروني واسم المستخدم عند إنشاء الحساب",
            "الاسم المعروض والصورة الشخصية والنبذة التعريفية",
            "المحتوى الذي تنشره من مقالات وتعليقات",
            "بيانات الحملات الإعلانية إن كنت معلناً"
        )
    )
    p(scope, "معلومات تُجمع تلقائياً:")
    ul(
        scope,
        listOf(
            "عنوان IP ونوع المتصفح ونظام التشغيل",
            "الصفحات التي تزورها ومدة بقائك فيها",
            "بيانات التفاعل مع الإعلانات (الظهور والنقرات)"
        )
    )

    h2(scope, "كيف نستخدم معلوماتك")
    ul(
        scope,
        listOf(
            "تشغيل حسابك وتقديم خدمات المنصة",
            "عرض المحتوى والإعلانات المناسبة لك",
            "حساب أرباح الكتّاب وإحصاءات الحملات الإعلانية",
            "كشف ومنع الاحتيال وإساءة الاستخدام",
            "تحسين المنصة وتطوير خدماتها",
            "التواصل معك بخصوص حسابك أو تحديثات الخدمة"
        )
    )

    h2(scope, "ملفات تعريف الارتباط (Cookies)")
    p(
        scope,
        "نستخدم ملفات تعريف الارتباط للحفاظ على جلسة تسجيل دخولك، وتذكّر تفضيلاتك، وقياس أداء المنصة، " +
            "وعرض الإعلانات. يمكنك تعطيلها من إعدادات متصفحك، لكن بعض ميزات المنصة قد لا تعمل بشكل صحيح عندئذ."
    )

    h2(scope, "الإعلانات وخدمات الطرف الثالث")
    p(
        scope,
        "تعتمد المنصة على شبكات إعلانية تابعة لجوجل (Google AdSense وخدمات مشابهة). قد تستخدم جوجل " +
            "والشركاء الإعلانيون ملفات تعريف ارتباط ومعرّفات مشابهة لعرض إعلانات مبنية على زياراتك لهذا " +
            "الموقع أو مواقع أخرى. بإمكانك مراجعة أو إلغاء الاشتراك في الإعلانات المخصصة من إعدادات إعلانات " +
            "جوجل (adssettings.google.com)، وقراءة تفاصيل استخدام جوجل لهذه البيانات عبر صفحة جوجل الرسمية " +
            "لهذا الغرض (policies.google.com/technologies/partner-sites)."
    )
    p(
        scope,
        "نستخدم كذلك خدمات Firebase من جوجل للمصادقة وتخزين البيانات، وخدمة reCAPTCHA لحماية المنصة من " +
            "الاستخدام الآلي المسيء. يخضع استخدامها لسياسة خصوصية جوجل وشروط خدمتها."
    )

    h2(scope, "مشاركة البيانات")
    p(scope, "لا نبيع بياناتك الشخصية لأي جهة. قد نشارك بعض البيانات في الحالات التالية فقط:")
    ul(
        scope,
        listOf(
            "مع مزودي الخدمات التقنية الذين نعتمد عليهم لتشغيل المنصة",
            "عند الضرورة القانونية أو استجابة لطلب رسمي من جهة مختصة",
            "لحماية حقوق المنصة أو مستخدميها أو منع نشاط احتيالي"
        )
    )

    h2(scope, "أمان البيانات")
    p(
        scope,
        "نتخذ إجراءات تقنية وتنظيمية معقولة لحماية بياناتك، بما في ذلك التشفير أثناء النقل وقواعد صلاحيات " +
            "صارمة للوصول إلى قاعدة البيانات. مع ذلك، لا توجد وسيلة نقل أو تخزين إلكتروني آمنة بشكل مطلق، " +
            "ولا يمكننا ضمان الأمان التام."
    )

    h2(scope, "حقوقك")
    ul(
        scope,
        listOf(
            "الوصول إلى بياناتك الشخصية المحفوظة لدينا",
            "تصحيح أي بيانات غير دقيقة",
            "طلب حذف حسابك وبياناتك",
            "الاعتراض على معالجة بياناتك لأغراض معينة",
            "سحب موافقتك في أي وقت"
        )
    )
    p(scope, "لممارسة أي من هذه الحقوق، تواصل معنا على: $CONTACT_EMAIL")

    h2(scope, "خصوصية الأطفال")
    p(
        scope,
        "المنصة غير موجهة لمن هم دون سن السادسة عشرة. لا نجمع عن قصد بيانات من الأطفال دون هذه السن. " +
            "إذا علمنا بذلك، سنحذف البيانات فوراً."
    )

    h2(scope, "التعديلات على هذه السياسة")
    p(scope, "قد نحدّث هذه السياسة من وقت لآخر. سننشر أي تعديل على هذه الصفحة مع تحديث تاريخ آخر تحديث في الأعلى.")
}

private fun termsContent(scope: androidx.compose.foundation.lazy.LazyListScope) {
    scope.item {
        Column {
            Text("شروط الاستخدام", style = twText(22, FontWeight.Black, 30), color = titleColor())
            Text("آخر تحديث: $LAST_UPDATED", style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
        }
    }

    h2(scope, "قبول الشروط")
    p(scope, "باستخدامك منصة ليتيريوم، فإنك توافق على الالتزام بهذه الشروط. إن لم توافق عليها، يرجى عدم استخدام المنصة.")

    h2(scope, "الحسابات")
    ul(
        scope,
        listOf(
            "يجب أن تكون المعلومات التي تقدمها عند التسجيل صحيحة ودقيقة",
            "أنت مسؤول عن الحفاظ على سرية بيانات دخولك وعن كل نشاط يتم من حسابك",
            "يُمنع إنشاء حسابات متعددة بغرض التلاعب بالإحصاءات أو الأرباح",
            "يحق للمنصة تعليق أو إغلاق أي حساب يخالف هذه الشروط"
        )
    )

    h2(scope, "المحتوى والملكية الفكرية")
    p(
        scope,
        "تحتفظ بملكية المحتوى الذي تنشره. وبنشرك إياه تمنح المنصة ترخيصاً غير حصري لعرضه وتوزيعه والترويج " +
            "له داخل المنصة. وتقرّ بأن المحتوى من إنتاجك أو تملك حقوق نشره، وأنه لا ينتهك حقوق أي طرف ثالث."
    )
    p(scope, "يُمنع نشر أي محتوى:")
    ul(
        scope,
        listOf(
            "ينتهك حقوق الملكية الفكرية للآخرين",
            "يحرّض على الكراهية أو العنف أو التمييز",
            "يحتوي على تشهير أو إساءة شخصية",
            "ينتهك القوانين المعمول بها",
            "يتضمن برمجيات ضارة أو محاولات اختراق",
            "مولّد آلياً بالكامل دون قيمة أو مراجعة بشرية"
        )
    )
    p(scope, "يحق للمنصة إزالة أي محتوى مخالف دون إشعار مسبق.")

    h2(scope, "حقوق النشر والعلامة التجارية للمنصة")
    p(
        scope,
        "اسم \"ليتيريوم\" وشعارها وهويتها البصرية وتصميم الواجهة والكود البرمجي الذي يشغّلها هي ملكية حصرية " +
            "لمنصة ليتيريوم ومحمية بموجب قوانين حقوق النشر والعلامات التجارية المعمول بها. يُمنع نسخ تصميم " +
            "المنصة أو هيكلها البرمجي أو محتواها بشكل جماعي أو إعادة نشره أو إنشاء نسخة مطابقة أو مشابهة له " +
            "لأغراض تجارية أو غير تجارية دون إذن كتابي صريح من إدارة المنصة."
    )
    p(
        scope,
        "هذا لا يشمل مقالات وتغريدات الكتّاب الفرديين أنفسهم، التي تبقى ملكاً لهم كما هو موضح أعلاه — المقصود " +
            "هو تصميم وبنية وعلامة المنصة ذاتها. أي انتهاك مشتبه به يُرجى الإبلاغ عنه عبر صفحة \"اتصل بنا\"."
    )

    h2(scope, "الأرباح والمدفوعات")
    p(scope, "يكسب الكاتب حصة من عائدات الإعلانات التي تظهر في صفحته الشخصية وداخل مقالاته، ومن مبيعات مقالاته الحصرية، وفق النسب التالية:")
    ul(
        scope,
        listOf(
            "إعلانات داخل المقالات: الكاتب ${RevenueShares.IN_ARTICLE_ADS.writerPercent}% والمنصة ${RevenueShares.IN_ARTICLE_ADS.platformPercent}%",
            "إعلانات صفحة الكاتب الشخصية: الكاتب ${RevenueShares.WRITER_PROFILE_ADS.writerPercent}% والمنصة ${RevenueShares.WRITER_PROFILE_ADS.platformPercent}%",
            "المقالات الحصرية المدفوعة: الكاتب ${RevenueShares.LOCKED_ARTICLES.writerPercent}% والمنصة ${RevenueShares.LOCKED_ARTICLES.platformPercent}%",
            "إعلانات الصفحة الرئيسية وصفحات التصنيفات: المنصة 100%"
        )
    )
    p(scope, "فترة التجميد: تبقى الأرباح في حالة معلّقة لمدة ${PayoutRules.EARNINGS_HOLD_DAYS} يوماً من تاريخ تسجيلها قبل أن تصبح قابلة للسحب، وذلك للتحقق من صحتها.")
    p(scope, "الحد الأدنى للسحب: ${PayoutRules.MIN_PAYOUT_USD.toInt()} دولاراً أمريكياً.")
    p(scope, "النقرات والمشاهدات الصالحة: تُحتسب الأرباح على أساس التفاعلات الصالحة فقط بعد تصفية الاحتيال. لا تُحتسب النقرات أو المشاهدات المرفوضة.")
    p(scope, "حق الإلغاء: تحتفظ المنصة بحق إلغاء أي أرباح يثبت أنها ناتجة عن نشاط احتيالي أو مخالف، حتى بعد إضافتها إلى الرصيد، وقبل صرفها.")
    p(scope, "سلوك محظور صراحةً:")
    ul(
        scope,
        listOf(
            "النقر على الإعلانات في صفحتك أو مقالاتك بنفسك",
            "الطلب من الآخرين النقر على إعلاناتك",
            "استخدام برامج آلية أو خدمات مدفوعة لزيادة الزيارات أو النقرات",
            "أي محاولة للتلاعب بأنظمة القياس"
        )
    )
    p(scope, "مخالفة أي مما سبق تؤدي إلى إلغاء الأرباح وإغلاق الحساب نهائياً.")

    h2(scope, "المعلنون")
    ul(
        scope,
        listOf(
            "كل حملة إعلانية تخضع لمراجعة واعتماد إدارة المنصة قبل نشرها",
            "يحق للمنصة رفض أي إعلان دون إبداء أسباب",
            "المبالغ المودعة في محفظة الإعلانات تُستخدم للحملات فقط",
            "المعلن مسؤول عن قانونية وصحة ما يعلن عنه",
            "لا يُخصم من المعلن مقابل تفاعلات مرفوضة كاحتيال"
        )
    )

    h2(scope, "إخلاء المسؤولية")
    p(
        scope,
        "تُقدَّم المنصة كما هي دون ضمانات من أي نوع. لا نضمن استمرارية الخدمة دون انقطاع أو خلوها من " +
            "الأخطاء. المنصة ليست مسؤولة عن آراء أو محتوى المستخدمين، ولا عن أي أضرار غير مباشرة ناتجة عن استخدام المنصة."
    )

    h2(scope, "القانون المطبق")
    p(scope, "تخضع هذه الشروط لقوانين الجمهورية التركية، وأي نزاع ينشأ عنها يخضع لاختصاص محاكمها.")

    h2(scope, "التواصل")
    p(scope, CONTACT_EMAIL)
}

private fun aboutContent(scope: androidx.compose.foundation.lazy.LazyListScope) {
    scope.item { Text("من نحن", style = twText(22, FontWeight.Black, 30), color = titleColor()) }
    p(scope, "ليتيريوم منصة عربية للأدب والمعرفة، تجمع بين القرّاء والكتّاب في مساحة واحدة تحتفي بالكلمة المكتوبة.")

    h2(scope, "رؤيتنا")
    p(scope, "أن نكون البيت الرقمي للمحتوى الأدبي والثقافي العربي الأصيل، حيث يجد القارئ ما يستحق وقته، ويجد الكاتب ما يستحق جهده.")

    h2(scope, "ما نقدمه")
    p(scope, "للقرّاء: مكتبة متنامية من المقالات والدراسات في الأدب والفلسفة والفكر والتكنولوجيا، بتجربة قراءة نقية ومريحة.")
    p(scope, "للكتّاب: منصة نشر احترافية تتيح الوصول إلى جمهور مهتم، مع نظام عادل لتحقيق دخل من المحتوى عبر الإعلانات والمقالات الحصرية.")
    p(scope, "للمعلنين: وصول دقيق إلى جمهور عربي مثقف ومتفاعل، بأدوات استهداف مرنة وحماية من الاحتيال.")

    h2(scope, "التزامنا")
    p(scope, "نلتزم بجودة المحتوى، وشفافية توزيع الأرباح، واحترام خصوصية مستخدمينا.")
}

private fun contactContent(scope: androidx.compose.foundation.lazy.LazyListScope) {
    scope.item { Text("اتصل بنا", style = twText(22, FontWeight.Black, 30), color = titleColor()) }
    p(scope, "يسعدنا تواصلك معنا.")
    listOf(
        "للاستفسارات العامة",
        "للكتّاب",
        "للمعلنين",
        "للإبلاغ عن مخالفة أو انتهاك حقوق ملكية فكرية"
    ).forEach { label ->
        scope.item {
            Column(Modifier.padding(bottom = 8.dp)) {
                Text(label, style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
                Text(CONTACT_EMAIL, style = twText(14, FontWeight.Normal, 27), color = bodyColor(), fontWeight = FontWeight.Bold)
            }
        }
    }
    p(scope, "نسعى للرد على جميع الرسائل خلال 48 ساعة عمل.")
}
