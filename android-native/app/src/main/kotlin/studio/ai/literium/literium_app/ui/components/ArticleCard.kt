package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.util.DateFormatAr
import java.util.Locale

/** عناوين الأقسام الـ15 + العام — نفس `ArticleCard.tsx`'s `getCategoryLabel`. */
fun articleCategoryLabelAr(category: String): String = when (category) {
    ArticleCategory.LITERATURE -> "الأدب والشعر"
    ArticleCategory.TECHNOLOGY -> "التقنية والذكاء الاصطناعي"
    ArticleCategory.HISTORY -> "التاريخ والحضارات"
    ArticleCategory.PHILOSOPHY -> "الفلسفة والفكر"
    ArticleCategory.BUSINESS -> "ريادة الأعمال والمال"
    ArticleCategory.SCIENCE -> "العلوم والفضاء"
    ArticleCategory.HEALTH -> "الصحة والرفاهية"
    ArticleCategory.ARTS -> "الفنون والنقد"
    ArticleCategory.POLITICS -> "سياسي"
    ArticleCategory.EDUCATION -> "تعليمي"
    ArticleCategory.BEAUTY_FASHION -> "مكياج وموضة وجمال"
    ArticleCategory.SPORTS -> "رياضة"
    ArticleCategory.FOOD -> "طبخ وأكلات"
    ArticleCategory.TRAVEL -> "سفر وسياحة"
    ArticleCategory.FAMILY -> "تربية وأسرة"
    else -> "عام"
}

private fun formatCountAr(n: Long): String = studio.ai.literium.literium_app.ui.theme.arNum(n)

private fun cairo(size: Int, weight: FontWeight, lh: Int = 0) = TextStyle(
    fontFamily = CairoFamily, fontSize = size.sp, fontWeight = weight,
    lineHeight = if (lh > 0) lh.sp else androidx.compose.ui.unit.TextUnit.Unspecified
)

/**
 * بطاقة المقال — نسخة طبق الأصل من ArticleCard.tsx: rounded-3xl (24dp) بإطار slate-200/80 وخلفية
 * white (dark: slate-900/90)، صورة h-48 (192dp)، شارات علوية (القسم بخلفية slate-950/90 ونص teal-300،
 * و«قراءة مجانية» teal-600)، شارة الوقت أسفل-بداية، ثم جسم p-4: صف الكاتب، العنوان base/black سطران،
 * الوصف xs سطران، وتذييل بإحصاءات (teal/rose/blue) + حفظ + زر «قراءة الآن» بتدرّج teal→cyan.
 */
@Composable
fun ArticleCard(
    article: Article,
    onClick: (Article) -> Unit,
    modifier: Modifier = Modifier,
    isFollowingAuthor: Boolean = false,
    onFollowAuthor: ((String) -> Unit)? = null,
    isSaved: Boolean = false,
    onSaveBookmark: ((String) -> Unit)? = null,
    onWriterProfileClick: ((String) -> Unit)? = null
) {
    val dark = isDark
    val cardShape = RoundedCornerShape(24.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(1.dp, cardShape, clip = false)
            .clip(cardShape)
            .background(if (dark) Tw.slate900.copy(alpha = 0.90f) else Tw.white)
            .border(1.dp, if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.slate200.copy(alpha = 0.80f), cardShape)
            .twClickable(pressScale = 0.99f) { onClick(article) }
    ) {
        // ── الصورة + الشارات
        Box(Modifier.fillMaxWidth().height(192.dp).background(if (dark) Tw.slate800 else Tw.slate100)) {
            AsyncImage(
                model = article.featuredImage, contentDescription = article.title,
                contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()
            )
            Row(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    articleCategoryLabelAr(article.category),
                    modifier = Modifier.clip(CircleShape).background(Tw.slate950.copy(alpha = 0.90f))
                        .border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.20f), CircleShape).padding(horizontal = 12.dp, vertical = 4.dp),
                    style = cairo(11, FontWeight.Bold, 16), color = Tw.teal300
                )
                // WRITER_MONETIZATION_ENABLED=false ⇒ دائماً «قراءة مجانية»
                Text(
                    "قراءة مجانية",
                    modifier = Modifier.clip(CircleShape).background(Tw.teal600).padding(horizontal = 10.dp, vertical = 2.dp),
                    style = cairo(11, FontWeight.Black, 16), color = Tw.white
                )
            }
            Row(
                Modifier.align(Alignment.BottomStart).padding(start = 12.dp, bottom = 10.dp)
                    .clip(RoundedCornerShape(12.dp)).background(Tw.slate950.copy(alpha = 0.95f))
                    .border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LuIcon(Lu.Clock, 12.dp, Color(0xFF2DD4BF))
                Text(DateFormatAr.formatDateTimeAr(article.publishedAt), style = cairo(11, FontWeight.Bold, 16), color = Tw.teal300)
            }
        }

        // ── الجسم
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            // صف الكاتب
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier.weight(1f, fill = false).twClickable { onWriterProfileClick?.invoke(article.writerId) }.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    val av = RoundedCornerShape(16.dp)
                    AsyncImage(
                        model = article.writerAvatar, contentDescription = article.writerName, contentScale = ContentScale.Crop,
                        modifier = Modifier.size(40.dp).clip(av).border(2.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), av)
                    )
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(article.writerName, style = cairo(12, FontWeight.Black, 16), color = if (dark) Tw.slate100 else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (article.writerIsVerified) LuIcon(Lu.CheckCircle2, 14.dp, Color(0xFF14B8A6))
                        }
                        Text(DateFormatAr.formatDateAr(article.publishedAt), style = cairo(11, FontWeight.Medium, 16), color = if (dark) Tw.slate500 else Tw.slate400)
                    }
                }
                if (onFollowAuthor != null) {
                    val fs = RoundedCornerShape(12.dp)
                    Box(
                        Modifier.heightIn(min = 36.dp).clip(fs)
                            .then(
                                if (isFollowingAuthor) Modifier.background(if (dark) Tw.slate800 else Tw.slate100)
                                else Modifier.background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA))
                                    .border(1.dp, if (dark) Color(0xFF115E59).copy(alpha = 0.70f) else Color(0xFF99F6E4).copy(alpha = 0.70f), fs)
                            )
                            .twClickable(pressScale = 0.95f) { onFollowAuthor(article.writerId) }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            if (isFollowingAuthor) "مُتابَع" else "+ متابعة", style = cairo(12, FontWeight.Bold, 16),
                            color = if (isFollowingAuthor) (if (dark) Tw.slate300 else Tw.slate600) else (if (dark) Tw.teal300 else Tw.teal700)
                        )
                    }
                }
            }
            Text(
                article.title, modifier = Modifier.padding(bottom = 8.dp),
                style = cairo(16, FontWeight.Black, 22), color = if (dark) Tw.white else Tw.slate900, maxLines = 2, overflow = TextOverflow.Ellipsis
            )
            Text(
                article.description, modifier = Modifier.padding(bottom = 16.dp),
                style = cairo(12, FontWeight.Normal, 20), color = if (dark) Tw.slate400 else Tw.slate600, maxLines = 2, overflow = TextOverflow.Ellipsis
            )
            // تذييل: pt-3 border-t slate-100
            Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.slate100))
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                val metric = if (dark) Tw.slate400 else Tw.slate500
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Stat(Lu.Eye, Color(0xFF14B8A6), formatCountAr(article.viewsCount), metric)
                    Stat(Lu.Heart, Tw.rose500, formatCountAr(article.likesCount), metric)
                    Stat(Lu.MessageSquare, Tw.blue500, formatCountAr(article.commentsCount), metric)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (onSaveBookmark != null) {
                        val bs = RoundedCornerShape(12.dp)
                        Box(
                            Modifier.size(36.dp).clip(bs)
                                .then(if (isSaved) Modifier.background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)) else Modifier)
                                .twClickable(pressScale = 0.95f) { onSaveBookmark(article.id) },
                            contentAlignment = Alignment.Center
                        ) {
                            LuIcon(Lu.Bookmark, 16.dp, if (isSaved) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate400)
                        }
                    }
                    Row(
                        Modifier.heightIn(min = 38.dp).clip(RoundedCornerShape(12.dp))
                            .background(Brush.horizontalGradient(listOf(Tw.teal600, Tw.cyan600)))
                            .twClickable(pressScale = 0.95f) { onClick(article) }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("قراءة الآن", style = cairo(12, FontWeight.Bold, 16), color = Tw.white)
                        LuIcon(Lu.ArrowLeft, 14.dp, Tw.white)
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, text: String, textColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        LuIcon(icon, 14.dp, tint)
        Text(text, style = cairo(12, FontWeight.Medium, 16), color = textColor)
    }
}
