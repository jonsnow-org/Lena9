package studio.ai.literium.literium_app.ui.screens.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

/** هامش علوي سالب (مثل -mt-16 في Tailwind) — يقلّص ارتفاع التخطيط دون قصّ المحتوى. */
private fun Modifier.negTop(amount: Dp): Modifier = layout { m, c ->
    val p = m.measure(c)
    val n = amount.roundToPx()
    layout(p.width, (p.height - n).coerceAtLeast(0)) { p.place(0, -n) }
}

/**
 * ملف الكاتب — WriterProfileView.tsx: زر عودة، بطاقة رأس (غلاف 176dp، صورة 96dp بحلقة 4dp، اسم + شارات،
 * أزرار رسالة/متابعة، نبذة، شريط إحصاءات، وسوم، تبويبان)، ثم قائمة المقالات أو «عن الكاتب والروابط».
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WriterProfileScreen(navController: NavController, userId: String) {
    val viewModel: WriterProfileViewModel = viewModel(
        key = "writer_profile_$userId",
        factory = viewModelFactory { initializer { WriterProfileViewModel(userId) } }
    )
    val state by viewModel.state.collectAsState()
    val ctx = LocalContext.current
    val dark = isDark

    LaunchedEffect(Unit) {
        viewModel.openConversation.collect { navController.navigate(Screen.Chat.of(it)) }
    }
    LaunchedEffect(state.error) {
        state.error?.let {
            android.widget.Toast.makeText(ctx, it, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearError()
        }
    }

    if (state.isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
        return
    }
    val writer = state.writer
    if (writer == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("تعذّر العثور على هذا الملف.", style = twText(14, FontWeight.Medium, 20), color = Tw.slate500)
        }
        return
    }
    fun open(url: String) = runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    val myId = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
    val cardBorder = if (dark) Tw.slate800 else Tw.slate200
    val cardBg = if (dark) Tw.slate900 else Tw.white
    val txt = if (dark) Tw.white else Tw.slate950
    val btnBg = if (dark) Tw.slate800 else Tw.slate100

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 64.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        // زر العودة
        item {
            val s = RoundedCornerShape(12.dp)
            Row(
                Modifier.shadow(1.dp, s, clip = false).clip(s).background(cardBg).border(1.dp, cardBorder, s)
                    .twClickable { navController.popBackStack() }.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LuIcon(Lu.ArrowRight, 16.dp, if (dark) Tw.slate300 else Tw.slate700)
                Text("العودة للمقالات", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            }
        }

        // بطاقة الرأس
        item {
            val cs = RoundedCornerShape(24.dp)
            Column(Modifier.fillMaxWidth().shadow(2.dp, cs, clip = false).clip(cs).background(cardBg).border(1.dp, cardBorder, cs)) {
                Box(Modifier.fillMaxWidth().height(176.dp).background(if (dark) Tw.slate800 else Tw.slate200)) {
                    AsyncImage(
                        writer.coverUrl?.takeIf { it.isNotBlank() } ?: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&auto=format&fit=crop&q=80",
                        "Cover", Modifier.fillMaxSize(), contentScale = ContentScale.Crop
                    )
                }
                Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 24.dp)) {
                    // صورة + الاسم (-mt-16)
                    Row(Modifier.fillMaxWidth().negTop(64.dp).padding(bottom = 16.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Box {
                            Box(Modifier.size(104.dp).clip(RoundedCornerShape(28.dp)).background(cardBg).padding(4.dp)) {
                                AsyncImage(writer.avatarUrl, writer.fullName, Modifier.fillMaxSize().clip(RoundedCornerShape(24.dp)).background(Tw.white), contentScale = ContentScale.Crop)
                            }
                            if (writer.isVerified == true) Box(Modifier.align(Alignment.BottomEnd).clip(CircleShape).background(Tw.teal600).padding(4.dp)) { LuIcon(Lu.CheckCircle2, 16.dp, Tw.white) }
                        }
                        Column(Modifier.weight(1f)) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(writer.fullName, style = twText(20, FontWeight.Black, 28), color = txt)
                                if (writer.isKycVerified == true) Pill(Lu.ShieldCheck, "KYC موثق", if (dark) Color(0xFF022C22).copy(alpha = 0.60f) else Tw.emerald50, if (dark) Tw.emerald400 else Tw.emerald600, Tw.emerald500.copy(alpha = 0.20f))
                                Pill(Lu.Award, state.memberStatusLabel, if (dark) Color(0xFF451A03).copy(alpha = 0.60f) else Tw.amber50, if (dark) Tw.amber400 else Tw.amber600, Tw.amber500.copy(alpha = 0.20f))
                            }
                            Text("@${writer.username}", style = twText(12, FontWeight.Medium, 16), color = Tw.slate400)
                        }
                    }
                    // أزرار الإجراء
                    if (myId != writer.id) Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalAlignment = Alignment.Top) {
                        Row(
                            Modifier.clip(RoundedCornerShape(12.dp)).background(btnBg).twClickable(enabled = !state.isMessageBusy) { viewModel.openDirectMessage() }.padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            LuIcon(Lu.Send, 14.dp, if (dark) Tw.slate200 else Tw.slate700)
                            Text("رسالة مباشرة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate700)
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            val fs = RoundedCornerShape(12.dp)
                            Box(
                                Modifier.then(if (!state.isFollowing) Modifier.shadow(4.dp, fs, ambientColor = Color(0xFF14B8A6).copy(alpha = 0.2f), spotColor = Color(0xFF14B8A6).copy(alpha = 0.2f)) else Modifier.shadow(3.dp, fs))
                                    .clip(fs).background(if (state.isFollowing) (if (dark) Tw.slate700 else Tw.slate200) else Tw.teal600)
                                    .twClickable { viewModel.toggleFollow() }.padding(horizontal = 24.dp, vertical = 10.dp)
                            ) { Text(if (state.isFollowing) "تتابعه" else "+ متابعة الكاتب", style = twText(12, FontWeight.Black, 16), color = if (state.isFollowing) (if (dark) Tw.slate200 else Tw.slate700) else Tw.white) }
                            if (state.isFollowingMe) Text("يتابعك", style = twText(10, FontWeight.Bold, 15), color = Tw.slate400)
                        }
                    }
                    // النبذة
                    if (!writer.bio.isNullOrBlank()) Text(writer.bio!!, Modifier.padding(bottom = 16.dp), style = twText(14, FontWeight.Normal, 23), color = if (dark) Tw.slate300 else Tw.slate700)

                    // شريط الإحصاءات
                    val lineC = if (dark) Tw.slate800 else Tw.slate100
                    Box(Modifier.fillMaxWidth().height(1.dp).background(lineC))
                    FlowRow(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatBtn(arNum(state.followersCount.toLong()), "متابِع", dark) { navController.navigate(Screen.FollowList.of(userId, followers = true)) }
                        StatBtn(arNum(state.followingCount.toLong()), "يتابع", dark) { navController.navigate(Screen.FollowList.of(userId, followers = false)) }
                        StatText(arNum((writer.articlesCount ?: state.articles.size.toLong())), "مقال منشور", dark)
                        StatText(arNum(state.totalViews), "قراءة", dark)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            LuIcon(Lu.Star, 14.dp, Tw.amber500)
                            val cnt = state.articles.sumOf { it.ratingsCount }
                            Text(if (cnt > 0) "${"%.1f".format(state.avgRating)} تقييم القراء (${arNum(cnt.toLong())})" else "لا تقييمات بعد", style = twText(12, FontWeight.Bold, 16), color = Tw.amber500)
                        }
                        if (!writer.joinedDate.isNullOrBlank()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            LuIcon(Lu.Calendar, 14.dp, Tw.slate400)
                            Text("انضم في ${writer.joinedDate}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(lineC))

                    // الشارات
                    if (!writer.badges.isNullOrEmpty()) FlowRow(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        writer.badges!!.forEach { b ->
                            val bs = RoundedCornerShape(12.dp)
                            Row(
                                Modifier.clip(bs).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)).border(1.dp, if (dark) Color(0xFF115E59) else Color(0xFF99F6E4), bs).padding(horizontal = 12.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                LuIcon(Lu.Award, 14.dp, if (dark) Tw.teal300 else Tw.teal700)
                                Text(b.name, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700)
                            }
                        }
                    }
                }
                // التبويبات
                Row(Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.50f) else Tw.slate50.copy(alpha = 0.50f)).padding(horizontal = 24.dp)) {
                    TabBtn("المقالات المنشورة (${arNum(state.articles.size.toLong())})", state.activeTab == WriterProfileTab.ARTICLES, dark) { viewModel.selectTab(WriterProfileTab.ARTICLES) }
                    TabBtn("عن الكاتب والروابط", state.activeTab == WriterProfileTab.ABOUT, dark) { viewModel.selectTab(WriterProfileTab.ABOUT) }
                }
            }
        }

        if (state.activeTab == WriterProfileTab.ARTICLES) {
            item { AdSlot(slotId = AdSlotId.WRITER_PROFILE_TOP, writerId = userId) }
            itemsIndexed(state.articles, key = { _, a -> a.id }) { idx, art ->
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (idx == 6 || (idx == state.articles.size - 1 && state.articles.size in 3..6)) AdSlot(slotId = AdSlotId.WRITER_PROFILE_FEED, writerId = userId)
                    val rs = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.fillMaxWidth().shadow(1.dp, rs, clip = false).clip(rs).background(cardBg).border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), rs)
                            .twClickable(pressScale = 0.99f) { navController.navigate(Screen.ArticleReader.of(art.id)) }.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            AsyncImage(art.featuredImage, art.title, Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                            Column(Modifier.weight(1f)) {
                                Box(Modifier.padding(bottom = 4.dp).clip(CircleShape).background(if (dark) Color(0xFF042F2E) else Color(0xFFCCFBF1)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                                    Text(articleCategoryLabelAr(art.category), style = twText(10, FontWeight.Bold, 15), color = if (dark) Tw.teal300 else Tw.teal700)
                                }
                                Text(art.title, Modifier.padding(bottom = 4.dp), style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(art.description, Modifier.padding(bottom = 8.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Meta(Lu.Eye, Color(0xFF14B8A6), arNum(art.viewsCount))
                                    Meta(Lu.Heart, Tw.rose500, "${art.likesCount}")
                                    Meta(Lu.MessageSquare, Color(0xFF06B6D4), "${art.commentsCount}")
                                    Text("•", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                                    Text(DateFormatAr.formatDateTimeAr(art.publishedAt), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                                }
                            }
                        }
                        Box(Modifier.align(Alignment.End).clip(RoundedCornerShape(12.dp)).background(Tw.teal600).padding(horizontal = 16.dp, vertical = 6.dp)) {
                            Text("قراءة المقال", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                        }
                    }
                }
            }
        } else item {
            val ps = RoundedCornerShape(24.dp)
            Column(Modifier.fillMaxWidth().clip(ps).background(cardBg).border(1.dp, cardBorder, ps).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Column {
                    Text("التخصص والاهتمامات الفكرية", Modifier.padding(bottom = 8.dp), style = twText(16, FontWeight.Bold, 24), color = if (dark) Tw.white else Tw.slate900)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        writer.specialties.orEmpty().forEach { s ->
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(btnBg).padding(horizontal = 12.dp, vertical = 6.dp)) {
                                Text(s, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                            }
                        }
                    }
                }
                Column {
                    Text("الروابط والموقع الشخصي", Modifier.padding(bottom = 12.dp), style = twText(16, FontWeight.Bold, 24), color = if (dark) Tw.white else Tw.slate900)
                    val l = writer.socialLinks
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        l?.website?.takeIf { it.isNotBlank() }?.let { LinkRow(Lu.Globe, "الموقع الرسمي للكاتب", if (dark) Tw.teal300 else Tw.teal600, if (dark) Tw.teal300 else Tw.teal600) { open(it) } }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            l?.youtube?.takeIf { it.isNotBlank() }?.let { SocialIcon(Lu.Youtube, btnBg, dark) { open(it) } }
                            l?.whatsapp?.takeIf { it.isNotBlank() }?.let { SocialIcon(Lu.MessageCircle, btnBg, dark) { open(it) } }
                            l?.telegram?.takeIf { it.isNotBlank() }?.let { SocialIcon(Lu.Send, btnBg, dark) { open(it) } }
                        }
                        l?.twitter?.takeIf { it.isNotBlank() }?.let { LinkRow(Lu.Twitter, "حساب منصة X (تويتر سابقاً)", Tw.sky500, if (dark) Tw.slate300 else Tw.slate700) { open(it) } }
                        l?.linkedin?.takeIf { it.isNotBlank() }?.let { LinkRow(Lu.Linkedin, "حساب LinkedIn", Tw.blue600, if (dark) Tw.slate300 else Tw.slate700) { open(it) } }
                        l?.instagram?.takeIf { it.isNotBlank() }?.let { LinkRow(Lu.Instagram, "إنستغرام", Color(0xFFEC4899), if (dark) Tw.slate300 else Tw.slate700) { open(it) } }
                    }
                }
                AdTickerBar(slotId = "writer_about", externalPriority = true, minHeightDp = 56.dp, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun Pill(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, bg: Color, fg: Color, ring: Color) {
    Row(Modifier.clip(CircleShape).background(bg).border(1.dp, ring, CircleShape).padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        LuIcon(icon, 14.dp, fg)
        Text(label, style = twText(11, FontWeight.Bold, 16), color = fg)
    }
}

@Composable
private fun StatBtn(value: String, label: String, dark: Boolean, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Row(
        Modifier.clip(s).background(if (dark) Tw.slate800 else Tw.slate100).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).twClickable(pressScale = 0.95f, onClick = onClick).padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(value, style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
        Text(label, style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate600)
    }
}

@Composable
private fun StatText(value: String, label: String, dark: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(value, style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
        Text(label, style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate600)
    }
}

@Composable
private fun TabBtn(label: String, active: Boolean, dark: Boolean, onClick: () -> Unit) {
    Column(Modifier.twClickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, Modifier.padding(horizontal = 16.dp, vertical = 12.dp), style = twText(12, FontWeight.Bold, 16), color = if (active) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate500)
        Box(Modifier.fillMaxWidth().height(2.dp).background(if (active) Tw.teal600 else Color.Transparent))
    }
}

@Composable
private fun Meta(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        LuIcon(icon, 12.dp, tint)
        Text(text, style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
    }
}

@Composable
private fun LinkRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, iconTint: Color, textColor: Color, onClick: () -> Unit) {
    Row(Modifier.twClickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LuIcon(icon, 16.dp, iconTint)
        Text(label, style = twText(12, FontWeight.Normal, 16), color = textColor)
    }
}

@Composable
private fun SocialIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, bg: Color, dark: Boolean, onClick: () -> Unit) {
    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(bg).twClickable(onClick = onClick).padding(8.dp)) {
        LuIcon(icon, 16.dp, if (dark) Tw.slate300 else Tw.slate600)
    }
}
