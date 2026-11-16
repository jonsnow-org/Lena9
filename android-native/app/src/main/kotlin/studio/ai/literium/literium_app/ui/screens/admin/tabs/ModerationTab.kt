package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.AlertDialog
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.TextButton
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.twText

/** "حوكمة المحتوى والمقالات المنشورة" — ترجمة حرفية لـ AdminContentTab.tsx. */
@Composable
fun ModerationTab(
    viewModel: AdminViewModel,
    articles: List<Article>,
    users: List<User>,
    onOpenArticle: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf("all") }
    var categoryFilter by remember { mutableStateOf("all") }
    var pendingDelete by remember { mutableStateOf<Article?>(null) }

    val categories = articles.map { it.category }.filter { it.isNotBlank() }.distinct()
    val q = searchQuery.trim().lowercase()
    val filtered = articles.filter { a ->
        when (filterType) {
            "published" -> if (a.status != "published") return@filter false
            "archived" -> if (a.status != "archived") return@filter false
            "locked" -> if (!a.isLocked) return@filter false
            "free" -> if (a.isLocked) return@filter false
        }
        if (categoryFilter != "all" && a.category != categoryFilter) return@filter false
        if (q.isNotEmpty() && !(a.title.lowercase().contains(q) || a.writerName.lowercase().contains(q) || a.description.lowercase().contains(q))) return@filter false
        true
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.FileText, 20.dp, Adm.blue400)
                Text("حوكمة المحتوى والمقالات المنشورة", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("مراجعة المقالات، تصفية المحتوى الحصري والمجاني، الأرشفة، والتحقق من جودة النشر.", Modifier.padding(top = 2.dp, bottom = 16.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            Row(
                Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("إجمالي المقالات:", style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
                Text(articles.size.toString(), style = twText(12, FontWeight.Black, 16), color = Adm.blue400, fontFamily = Adm.mono)
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AdmSearch(searchQuery, { searchQuery = it }, "البحث في عنوان المقال أو اسم الكاتب...")
            AdmSegment(listOf("all" to "الكل", "published" to "المنشورة", "locked" to "الحصرية", "free" to "المجانية", "archived" to "المؤرشفة"), filterType, Color(0xFF2563EB)) { filterType = it }
            if (categories.isNotEmpty()) {
                AdmSegment(listOf("all" to "جميع التصنيفات") + categories.map { it to it }, categoryFilter, Color(0xFF2563EB)) { categoryFilter = it }
            }
        }

        if (filtered.isEmpty()) {
            AdmEmpty("لا توجد مقالات تطابق معايير البحث والفلترة.")
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                filtered.forEach { art ->
                    val author = users.find { it.id == art.writerId }
                    val archived = art.status == "archived"
                    AdmCard {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                            if (art.featuredImage.isNotBlank()) {
                                AsyncImage(art.featuredImage, art.title, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                            } else {
                                Box(Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                                    LuIcon(Lu.FileText, 24.dp, Tw.slate600)
                                }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                AdmFlow {
                                    if (art.isLocked) {
                                        Row(Modifier.clip(RoundedCornerShape(50)).background(Adm.amber500.copy(alpha = 0.2f)).border(1.dp, Adm.amber500.copy(alpha = 0.3f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 2.dp),
                                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            LuIcon(Lu.Lock, 12.dp, Adm.amber300)
                                            Text("حصري ($${art.lockedPrice ?: 0})", style = twText(10, FontWeight.Bold, 14), color = Adm.amber300)
                                        }
                                    } else {
                                        AdmBadge("مجاني", Tw.slate300, Tw.slate800, null, mono = false)
                                    }
                                    AdmBadge(if (archived) "مؤرشف / غير منشور" else "منشور نشط",
                                        if (archived) Adm.rose300 else Color(0xFF6EE7B7),
                                        (if (archived) Adm.rose500 else Adm.emerald500).copy(alpha = 0.2f),
                                        (if (archived) Adm.rose500 else Adm.emerald500).copy(alpha = 0.3f), mono = false)
                                    Text(art.category, style = twText(10, FontWeight.Bold, 14), color = Tw.slate500)
                                }
                                Text(art.title, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("الكاتب: ${author?.fullName ?: art.writerName} • ${art.viewsCount} مشاهدة • ${art.likesCount} إعجاب",
                                    style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                                if (art.isLocked) {
                                    Text("${art.purchasesCount} عملية شراء (${Adm.usd(art.revenueFromSales)})", style = twText(12, FontWeight.Bold, 16), color = Adm.amber400)
                                }
                            }
                        }
                        AdmFlow {
                            AdmButton("معاينة المقال", { onOpenArticle(art.id) }, Tw.slate800, Tw.slate200, icon = Lu.Eye)
                            if (archived) {
                                AdmButton("إعادة النشر", { viewModel.setArticleStatus(art.id, "published") }, Adm.emerald600, icon = Lu.CheckCircle2)
                            } else {
                                AdmButton("أرشفة / حجب", { viewModel.setArticleStatus(art.id, "archived") }, Tw.slate800, Tw.slate400, icon = Lu.Archive)
                            }
                            AdmButton("حذف نهائي", { pendingDelete = art }, Tw.slate800, Tw.slate400, icon = Lu.Trash2)
                        }
                    }
                }
            }
        }
    }

    pendingDelete?.let { art ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            text = { Text("سيتم حذف المقال «${art.title}» نهائياً. هذا الإجراء لا رجعة فيه. هل تريد المتابعة؟") },
            confirmButton = { TextButton(onClick = { viewModel.deleteArticleAsAdmin(art.id); pendingDelete = null }) { Text("حذف نهائي") } },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("إلغاء") } }
        )
    }
}
