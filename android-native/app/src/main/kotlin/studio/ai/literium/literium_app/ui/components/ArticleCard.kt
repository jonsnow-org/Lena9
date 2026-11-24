package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Comment
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal
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

private fun formatCountAr(n: Long): String = String.format(Locale("ar"), "%,d", n)

/**
 * The atomic article-preview unit reused across Feed/Explore/Profile/writer-profile screens —
 * full-fidelity port of `src/components/ArticleCard.tsx`. Public API kept simple and stable per
 * task scope: [article] + [onClick] are the only required parameters; every other interaction is
 * an optional nullable callback so a screen that doesn't need follow/bookmark affordances (e.g. a
 * minimal profile list) can omit them entirely and get a read-only card.
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
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick(article) },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            // ---- Featured image + overlays ----
            Box(modifier = Modifier.fillMaxWidth().height(180.dp)) {
                AsyncImage(
                    model = article.featuredImage,
                    contentDescription = article.title,
                    modifier = Modifier.fillMaxWidth().height(180.dp),
                    contentScale = ContentScale.Crop
                )

                // Top badges row
                Row(
                    modifier = Modifier.fillMaxWidth().padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Surface(
                        color = Color(0xE6111827),
                        shape = RoundedCornerShape(50),
                        contentColor = Color(0xFF5EEAD4)
                    ) {
                        Text(
                            articleCategoryLabelAr(article.category),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    if (article.isLocked) {
                        Surface(color = BrandAmber, shape = RoundedCornerShape(50), contentColor = Color(0xFF0F172A)) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(12.dp))
                                Text(
                                    "مقال حصري (${article.lockedPrice ?: 2.99}$)",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    } else {
                        Surface(color = BrandTeal, shape = RoundedCornerShape(50), contentColor = Color.White) {
                            Text(
                                "قراءة مجانية",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }

                // Publish date/time overlay (bottom-start)
                Surface(
                    modifier = Modifier.align(Alignment.BottomStart).padding(8.dp),
                    color = Color(0xF2111827),
                    shape = RoundedCornerShape(10.dp),
                    contentColor = Color(0xFF5EEAD4)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Filled.Schedule, contentDescription = null, modifier = Modifier.size(10.dp))
                        Text(DateFormatAr.formatDateTimeAr(article.publishedAt), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ---- Content body ----
            Column(modifier = Modifier.padding(14.dp)) {
                // Author row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .weight(1f, fill = false)
                            .clickable(enabled = onWriterProfileClick != null) {
                                onWriterProfileClick?.invoke(article.writerId)
                            },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        AsyncImage(
                            model = article.writerAvatar,
                            contentDescription = article.writerName,
                            modifier = Modifier.size(38.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(
                                    article.writerName,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (article.writerIsVerified) {
                                    Icon(
                                        Icons.Filled.CheckCircle,
                                        contentDescription = "موثّق",
                                        tint = BrandTeal,
                                        modifier = Modifier.size(13.dp)
                                    )
                                }
                            }
                            Text(
                                DateFormatAr.formatDateAr(article.publishedAt),
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (onFollowAuthor != null) {
                        val bg = if (isFollowingAuthor) MaterialTheme.colorScheme.surfaceVariant else BrandTeal.copy(alpha = 0.1f)
                        val fg = if (isFollowingAuthor) MaterialTheme.colorScheme.onSurfaceVariant else BrandTeal
                        Surface(
                            color = bg,
                            contentColor = fg,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.clickable { onFollowAuthor(article.writerId) }
                        ) {
                            Text(
                                if (isFollowingAuthor) "مُتابَع" else "+ متابعة",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    article.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    article.description,
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Footer metrics
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        MetricChip(Icons.Filled.RemoveRedEye, formatCountAr(article.viewsCount), BrandTeal)
                        MetricChip(Icons.Filled.Favorite, formatCountAr(article.likesCount), Color(0xFFE11D48))
                        MetricChip(Icons.Filled.Comment, formatCountAr(article.commentsCount), Color(0xFF3B82F6))
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (onSaveBookmark != null) {
                            IconButton(onClick = { onSaveBookmark(article.id) }, modifier = Modifier.size(32.dp)) {
                                Icon(
                                    if (isSaved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                                    contentDescription = "حفظ",
                                    tint = if (isSaved) BrandTeal else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Surface(
                            color = BrandTeal,
                            contentColor = Color.White,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.clickable { onClick(article) }
                        ) {
                            Text(
                                "قراءة الآن",
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricChip(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, tint: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(13.dp))
        Text(value, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
