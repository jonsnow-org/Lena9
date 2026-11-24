package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.DarkCard
import studio.ai.literium.literium_app.ui.theme.SlateMuted

/**
 * "حوكمة المحتوى والمقالات المنشورة" — Compose port of
 * `AdminContentTab.tsx`. Archive/republish goes through
 * [studio.ai.literium.literium_app.data.repository.ArticleRepository.setArticleStatus].
 */
@Composable
fun ModerationTab(
    viewModel: AdminViewModel,
    articles: List<Article>,
    users: List<User>,
    onOpenArticle: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf("all") }

    val filtered = articles.filter { a ->
        when (filterType) {
            "published" -> a.status == "published"
            "archived" -> a.status == "archived"
            "locked" -> a.isLocked
            "free" -> !a.isLocked
            else -> true
        }
    }.filter { a ->
        searchQuery.isBlank() || a.title.contains(searchQuery, ignoreCase = true) ||
            a.writerName.contains(searchQuery, ignoreCase = true)
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Text("إجمالي المقالات: ${articles.size}", fontWeight = FontWeight.Bold) }
        item {
            OutlinedTextField(
                value = searchQuery, onValueChange = { searchQuery = it },
                label = { Text("البحث في عنوان المقال أو اسم الكاتب...") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "الكل", "published" to "المنشورة", "locked" to "الحصرية", "free" to "المجانية", "archived" to "المؤرشفة")
                    .forEach { (key, label) ->
                        FilterChip(selected = filterType == key, onClick = { filterType = key }, label = { Text(label) })
                    }
            }
        }

        if (filtered.isEmpty()) {
            item { EmptyHint("لا توجد مقالات تطابق معايير البحث والفلترة.") }
        } else {
            items(filtered, key = { it.id }) { art ->
                val isArchived = art.status == "archived"
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Row {
                            if (art.featuredImage.isNotBlank()) {
                                AsyncImage(
                                    model = art.featuredImage, contentDescription = art.title,
                                    modifier = Modifier.size(56.dp)
                                )
                            }
                            Column(Modifier.padding(start = 8.dp).weight(1f)) {
                                Text(art.title, fontWeight = FontWeight.Bold, maxLines = 1)
                                Text(
                                    "الكاتب: ${art.writerName} • ${art.viewsCount} مشاهدة • ${art.likesCount} إعجاب",
                                    fontSize = 11.sp,
                                    color = SlateMuted
                                )
                                if (art.isLocked) {
                                    Text(
                                        "حصري ($${art.lockedPrice}) — ${art.purchasesCount} عملية شراء",
                                        fontSize = 11.sp,
                                        color = SlateMuted
                                    )
                                }
                                Text(
                                    if (isArchived) "مؤرشف / غير منشور" else "منشور نشط",
                                    fontSize = 11.sp,
                                    color = if (isArchived) SlateMuted else studio.ai.literium.literium_app.ui.theme.Emerald,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedButton(onClick = { onOpenArticle(art.id) }) { Text("معاينة المقال") }
                            if (isArchived) {
                                Button(onClick = { viewModel.setArticleStatus(art.id, "published") }) { Text("إعادة النشر") }
                            } else {
                                Button(onClick = { viewModel.setArticleStatus(art.id, "archived") }) { Text("أرشفة / حجب") }
                            }
                        }
                    }
                }
            }
        }
    }
}
