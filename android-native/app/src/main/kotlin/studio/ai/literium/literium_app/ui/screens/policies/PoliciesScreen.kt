package studio.ai.literium.literium_app.ui.screens.policies

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
import androidx.compose.material3.TopAppBar
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PoliciesScreen(navController: NavController, page: String) {
    var section by remember { mutableStateOf(if (PAGES.any { it.key == page }) page else "privacy") }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                title = { Text(PAGES.first { it.key == section }.label) }
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
            ) {
                items(PAGES) { p ->
                    FilterChip(
                        selected = section == p.key,
                        onClick = { section = p.key },
                        label = { Text(p.label) },
                        modifier = Modifier.padding(end = 6.dp)
                    )
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
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
    scope.item {
        Text(
            text,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
        )
    }
}

private fun p(scope: androidx.compose.foundation.lazy.LazyListScope, text: String) {
    scope.item { Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(bottom = 6.dp)) }
}

private fun ul(scope: androidx.compose.foundation.lazy.LazyListScope, items: List<String>) {
    scope.items(items) { line ->
        Text("• $line", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(bottom = 4.dp))
    }
}

private fun privacyContent(scope: androidx.compose.foundation.lazy.LazyListScope) {
    scope.item {
        Column {
            Text("سياسة الخصوصية", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
            Text("آخر تحديث: $LAST_UPDATED", style = MaterialTheme.typography.labelSmall)
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
            Text("شروط الاستخدام", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
            Text("آخر تحديث: $LAST_UPDATED", style = MaterialTheme.typography.labelSmall)
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
    scope.item { Text("من نحن", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black) }
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
    scope.item { Text("اتصل بنا", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black) }
    p(scope, "يسعدنا تواصلك معنا.")
    listOf(
        "للاستفسارات العامة",
        "للكتّاب",
        "للمعلنين",
        "للإبلاغ عن مخالفة أو انتهاك حقوق ملكية فكرية"
    ).forEach { label ->
        scope.item {
            Column(Modifier.padding(bottom = 8.dp)) {
                Text(label, style = MaterialTheme.typography.labelSmall)
                Text(CONTACT_EMAIL, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
    p(scope, "نسعى للرد على جميع الرسائل خلال 48 ساعة عمل.")
}
