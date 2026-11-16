package studio.ai.literium.literium_app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.CreatorEligibility
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.blur
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(navController: NavController, viewModel: ProfileViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val dark = isDark

    when {
        state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
        state.notSignedIn || state.currentUser == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("يجب تسجيل الدخول لعرض ملفك الشخصي.", style = twText(14, FontWeight.Medium, 20), color = Tw.slate500)
        }
        else -> {
            val user = state.currentUser!!
            LaunchedEffect(state.activeTab, state.blogSubTab) {
                if (state.activeTab == ProfileTab.BLOG && state.blogSubTab == BlogSubTab.BOOKMARKS) viewModel.refreshBookmarks()
            }
            val isAdmin = user.role == UserRole.ADMIN
            LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                // بطاقة الهوية
                item {
                    val cs = RoundedCornerShape(24.dp)
                    val glow = if (user.role == UserRole.WRITER) Color(0xFF14B8A6) else if (user.role == UserRole.ADVERTISER) Color(0xFF06B6D4) else Tw.teal600
                    Box(Modifier.fillMaxWidth().shadow(2.dp, cs, clip = false).clip(cs).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), cs)) {
                        Box(Modifier.align(Alignment.TopEnd).size(320.dp).offset(x = 160.dp, y = (-160).dp).clip(CircleShape).blur(48.dp).background(glow.copy(alpha = 0.20f)))
                        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Box {
                                    AsyncImage(user.avatarUrl, user.fullName, Modifier.size(80.dp).shadow(3.dp, RoundedCornerShape(24.dp), clip = false).clip(RoundedCornerShape(24.dp)).border(4.dp, glow.copy(alpha = 0.20f), RoundedCornerShape(24.dp)), contentScale = ContentScale.Crop)
                                    if (user.isVerified == true) Box(Modifier.align(Alignment.BottomEnd).clip(CircleShape).background(if (dark) Tw.slate900 else Tw.white).padding(2.dp).clip(CircleShape).background(Tw.teal600).padding(4.dp)) { LuIcon(Lu.CheckCircle2, 16.dp, Tw.white) }
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(user.penName ?: user.companyName ?: user.fullName, style = twText(20, FontWeight.Black, 28), color = if (dark) Tw.white else Tw.slate900)
                                        Row(Modifier.clip(CircleShape).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)).border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), CircleShape).padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            LuIcon(if (state.eligibility?.isEligible == true) Lu.Award else Lu.PenTool, 12.dp, if (dark) Tw.teal300 else Tw.teal700)
                                            Text(state.memberStatusLabel, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700)
                                        }
                                        Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable { navController.navigate(Screen.EditProfile.route) }.padding(6.dp)) { LuIcon(Lu.Edit3, 14.dp, Tw.slate400) }
                                    }
                                    Text("@${user.username}" + if (user.email.isNotBlank()) " • ${user.email}" else "", Modifier.padding(horizontal = 8.dp), style = twText(12, FontWeight.Normal, 16).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace), color = Tw.slate400)
                                    Text(user.bio?.takeIf { it.isNotBlank() } ?: "مرحباً بك في ليتيريوم! استمتع بأفضل تجربة أدبية وثقافية متكاملة.", style = twText(12, FontWeight.Normal, 20).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = if (dark) Tw.slate300 else Tw.slate600)
                                    if (user.role == UserRole.WRITER && !user.specialties.isNullOrEmpty()) FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        user.specialties!!.forEach { spec ->
                                            val ss = RoundedCornerShape(8.dp)
                                            Box(Modifier.clip(ss).background(if (dark) Tw.slate800 else Tw.slate100).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, ss).padding(horizontal = 10.dp, vertical = 2.dp)) { Text(spec, style = twText(11, FontWeight.Medium, 16), color = if (dark) Tw.slate400 else Tw.slate600) }
                                        }
                                    }
                                    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        ProfileStatBtn(arNum(state.followersCount.toLong()), "متابعون", dark) { navController.navigate(Screen.FollowList.of(user.id, followers = true)) }
                                        ProfileStatBtn(arNum(state.followingCount.toLong()), "يتابع", dark) { navController.navigate(Screen.FollowList.of(user.id, followers = false)) }
                                    }
                                    if (user.isKycVerified == true || !user.specialties.isNullOrEmpty()) FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text("معلومات عن الكاتب:", style = twText(10, FontWeight.Bold, 15), color = Tw.slate400)
                                        if (user.isKycVerified == true) Row(Modifier.clip(CircleShape).background(if (dark) Color(0xFF022C22).copy(alpha = 0.60f) else Tw.emerald50).border(1.dp, Tw.emerald500.copy(alpha = 0.20f), CircleShape).padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            LuIcon(Lu.ShieldCheck, 12.dp, if (dark) Tw.emerald400 else Tw.emerald600)
                                            Text("هوية موثقة", style = twText(10, FontWeight.Bold, 15), color = if (dark) Tw.emerald400 else Tw.emerald600)
                                        }
                                        user.specialties.orEmpty().forEach { spec ->
                                            val ss = RoundedCornerShape(8.dp)
                                            Box(Modifier.clip(ss).background(if (dark) Tw.slate800 else Tw.slate100).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, ss).padding(horizontal = 8.dp, vertical = 2.dp)) { Text(spec, style = twText(10, FontWeight.Medium, 15), color = if (dark) Tw.slate400 else Tw.slate600) }
                                        }
                                    }
                                }
                            }
                            if (!isAdmin) FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                val bs = RoundedCornerShape(12.dp)
                                Row(Modifier.shadow(4.dp, bs, ambientColor = Color(0xFF06B6D4).copy(alpha = 0.2f), spotColor = Color(0xFF06B6D4).copy(alpha = 0.2f)).clip(bs).background(Color(0xFF0891B2)).twClickable(pressScale = 0.95f) { navController.navigate(Screen.NewCampaign.route) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LuIcon(Lu.Plus, 14.dp, Tw.white); Text("إنشاء إعلان جديد", style = twText(12, FontWeight.ExtraBold, 16), color = Tw.white)
                                }
                                Row(Modifier.clip(bs).background(if (dark) Tw.slate800 else Tw.slate100).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, bs).twClickable(pressScale = 0.95f) { navController.navigate(Screen.Wallet.route) }.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LuIcon(Lu.Wallet, 14.dp, Tw.teal600); Text("المحفظة ($${"%.2f".format(user.walletBalance ?: 0.0)})", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate800)
                                }
                            }
                        }
                    }
                }

                if (!isAdmin) item { AdTickerBar(slotId = "profile_top", externalPriority = true, minHeightDp = 56.dp, modifier = Modifier.fillMaxWidth()) }

                if (isAdmin) item {
                    val s = RoundedCornerShape(24.dp)
                    Row(Modifier.fillMaxWidth().clip(s).background(if (dark) Color(0xFF022C22).copy(alpha = 0.30f) else Tw.emerald50).border(1.dp, Tw.emerald500.copy(alpha = 0.30f), s).twClickable { navController.navigate(Screen.Admin.route) }.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LuIcon(Lu.ShieldCheck, 20.dp, Tw.emerald600)
                        Text("لوحة إدارة المنصة", style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.emerald400 else Tw.emerald600)
                    }
                }

                if (!isAdmin) {
                    // مدونة / تغريد / لوحة التحكم
                    item {
                        val ts = RoundedCornerShape(16.dp)
                        Row(Modifier.fillMaxWidth().clip(ts).background(if (dark) Tw.slate900 else Tw.slate100).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, ts).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(Triple(ProfileTab.BLOG, "مدونة", Lu.FileText), Triple(ProfileTab.TWEET, "تغريد", Lu.MessageSquare), Triple(ProfileTab.CONTROL_PANEL, "لوحة التحكم", Lu.Sliders)).forEach { (tab, label, icon) ->
                                val active = state.activeTab == tab
                                val xs = RoundedCornerShape(12.dp)
                                Row(
                                    Modifier.weight(1f).then(if (active) Modifier.shadow(2.dp, xs, clip = false) else Modifier).clip(xs).background(if (active) (if (dark) Tw.slate800 else Tw.white) else Color.Transparent)
                                        .twClickable { viewModel.selectTab(tab) }.padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
                                ) {
                                    LuIcon(icon, 16.dp, if (active) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate500)
                                    Text(label, style = twText(12, FontWeight.ExtraBold, 16), color = if (active) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate500, maxLines = 1)
                                }
                            }
                        }
                    }

                    when (state.activeTab) {
                        ProfileTab.BLOG -> {
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SubPill("مقالاتي", Lu.FileText, state.blogSubTab == BlogSubTab.ARTICLES, dark) { viewModel.selectBlogSubTab(BlogSubTab.ARTICLES) }
                                    SubPill("المقالات المحفوظة (${arNum(state.bookmarkedArticles.size.toLong())})", Lu.Bookmark, state.blogSubTab == BlogSubTab.BOOKMARKS, dark) { viewModel.selectBlogSubTab(BlogSubTab.BOOKMARKS) }
                                }
                            }
                            when (state.blogSubTab) {
                                BlogSubTab.ARTICLES -> articleRows(state.ownArticles, dark, insertAdEvery6 = true) { navController.navigate(Screen.ArticleReader.of(it.id)) }
                                BlogSubTab.BOOKMARKS -> articleRows(state.bookmarkedArticles, dark) { navController.navigate(Screen.ArticleReader.of(it.id)) }
                            }
                        }
                        ProfileTab.TWEET -> {
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SubPill("تغريداتي (${arNum(state.ownTweets.size.toLong())})", Lu.MessageSquare, state.tweetSubTab == TweetSubTab.MINE, dark) { viewModel.selectTweetSubTab(TweetSubTab.MINE) }
                                    SubPill("المفضلة (${arNum(state.favoritedTweets.size.toLong())})", Lu.Star, state.tweetSubTab == TweetSubTab.FAVORITES, dark) { viewModel.selectTweetSubTab(TweetSubTab.FAVORITES) }
                                }
                            }
                            when (state.tweetSubTab) {
                                TweetSubTab.MINE -> tweetRows(state.ownTweets, dark) { navController.navigate(Screen.TweetDetail.of(it.id)) }
                                TweetSubTab.FAVORITES -> tweetRows(state.favoritedTweets, dark) { navController.navigate(Screen.TweetDetail.of(it.id)) }
                            }
                        }
                        ProfileTab.CONTROL_PANEL -> {
                            item {
                                val rated = state.ownArticles.filter { it.ratingsCount > 0 }
                                val rc = rated.sumOf { it.ratingsCount }
                                val avg = if (rc > 0) rated.sumOf { it.rating * it.ratingsCount } / rc else null
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        KpiCard("إجمالي المشاهدات", Lu.Eye, Color(0xFF14B8A6), arNum(state.totalOwnViews), if (state.ownArticles.isNotEmpty()) "بمعدل ${arNum(state.totalOwnViews / state.ownArticles.size)} قراءة لكل مقال" else "مشاهدات موثقة من القرّاء", Tw.teal600, dark, Modifier.weight(1f))
                                        KpiCard("إجمالي المكافآت", Lu.DollarSign, Tw.amber500, "$${"%.2f".format(user.lifetimeEarnings ?: 0.0)}", "من مهام الحملات الإعلانية", Tw.amber600, dark, Modifier.weight(1f))
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        KpiCard("متوسط التقييم", Lu.Award, Tw.rose500, if (avg != null) "${"%.1f".format(avg)} ★" else "—", if (rc > 0) "من ${arNum(rc.toLong())} تقييم موثق" else "لا تقييمات حقيقية بعد", Tw.slate400, dark, Modifier.weight(1f))
                                        KpiCard("المقالات المنشورة", Lu.FileText, Tw.amber500, arNum(state.ownArticles.size.toLong()), "جاهزة للجمهور", Tw.amber600, dark, Modifier.weight(1f))
                                    }
                                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        SubPill("إعلاناتي وترويجي", Lu.Megaphone, false, dark) { navController.navigate(Screen.AdvertiserDashboard.route) }
                                        SubPill("الرصيد والسحب", Lu.DollarSign, false, dark) { navController.navigate(Screen.Wallet.route) }
                                        SubPill("إعدادات الملف الأدبي والتوثيق", Lu.PenTool, false, dark) { navController.navigate(Screen.EditProfile.route) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileStatBtn(value: String, label: String, dark: Boolean, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Column(Modifier.widthIn(min = 68.dp).clip(s).background(if (dark) Tw.slate800 else Tw.slate100).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).twClickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
        Text(label, style = twText(10, FontWeight.Bold, 15), color = if (dark) Tw.slate400 else Tw.slate500)
    }
}

@Composable
private fun SubPill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, dark: Boolean, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Row(
        Modifier.clip(s).background(if (active) Tw.teal600 else (if (dark) Tw.slate800 else Tw.slate100)).twClickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        LuIcon(icon, 14.dp, if (active) Tw.white else Tw.slate500)
        Text(label, style = twText(11, FontWeight.Bold, 16), color = if (active) Tw.white else Tw.slate500, maxLines = 1)
    }
}

@Composable
private fun KpiCard(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, iconTint: Color, value: String, sub: String, subTint: Color, dark: Boolean, modifier: Modifier) {
    val s = RoundedCornerShape(24.dp)
    Column(modifier.shadow(1.dp, s, clip = false).clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, s).padding(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Tw.slate400, maxLines = 1)
            LuIcon(icon, 16.dp, iconTint)
        }
        Text(value, style = twText(24, FontWeight.Black, 32), color = if (dark) Tw.white else Tw.slate900)
        Text(sub, Modifier.padding(top = 4.dp), style = twText(11, FontWeight.Bold, 16), color = subTint)
    }
}

/** Full 4-requirement stat grid + mandatory-KYC row — spec §4.19/§12.4. Self-profile-only, per source. */
@Composable
fun CreatorEligibilityCard(eligibility: CreatorEligibility.Status, onOpenKyc: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
        Column(Modifier.padding(16.dp)) {
            if (eligibility.isEligible) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Filled.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column {
                        Text("منشئ محتوى موثّق", fontWeight = FontWeight.Black)
                        Text(
                            "استوفيت كل الشروط وهويتك موثّقة — تُحتسب أرباحك من الإعلانات والمبيعات بشكل طبيعي.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "نسبتك من إعلانات الشبكات الخارجية (Adsterra وغيرها) تُحتسب فقط من الإعلانات التي " +
                                "تظهر داخل مقالاتك وصفحة ملفك الشخصي، بسعر تقديري ثابت لكل 1000 مشاهدة تعتمده " +
                                "إدارة المنصة — وليس السعر الحقيقي الذي تدفعه الشبكة نفسها. الإعلانات التي تظهر " +
                                "في الصفحة الرئيسية أو قسم التغريد أو الصفحة الأولى قبل تسجيل الدخول أو أي مكان " +
                                "آخر خارج مقالاتك وملفك الشخصي لا تُحتسب لك منها أي نسبة.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.HourglassEmpty, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary)
                    Text("شروط تفعيل احتساب الأرباح", fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "يمكنك الكتابة والنشر بحرية الآن، لكن احتساب أرباح الإعلانات والمبيعات لحسابك يبدأ فقط بعد استيفاء كل الشروط التالية معاً.",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(10.dp))
                RequirementRow(eligibility.meetsFollowers, "عدد المتابعين", "${eligibility.followersCount}/${CreatorEligibility.MIN_FOLLOWERS}")
                RequirementRow(eligibility.meetsViews, "مشاهدات صالحة", "${eligibility.validViewsCount}/${CreatorEligibility.MIN_VALID_VIEWS}")
                RequirementRow(eligibility.meetsAge, "عمر الحساب (أيام)", "${eligibility.accountAgeDays}/${CreatorEligibility.MIN_ACCOUNT_AGE_DAYS}")
                RequirementRow(eligibility.meetsArticles, "مقالات منشورة", "${eligibility.publishedArticlesCount}/${CreatorEligibility.MIN_PUBLISHED_ARTICLES}")
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(
                            if (eligibility.isKycVerified) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Text("التحقق من الهوية (KYC) — شرط إلزامي أخير", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                    }
                    if (!eligibility.isKycVerified) {
                        TextButton(onClick = onOpenKyc) { Text("تحقق الآن") }
                    }
                }
            }
        }
    }
}

@Composable
private fun RequirementRow(met: Boolean, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(
                if (met) Icons.Filled.CheckCircle else Icons.Filled.Circle,
                contentDescription = null,
                tint = if (met) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(16.dp)
            )
            Text(label, style = MaterialTheme.typography.bodySmall)
        }
        Text(value, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.articleRows(
    articles: List<Article>,
    dark: Boolean,
    insertAdEvery6: Boolean = false,
    onClick: (Article) -> Unit
) {
    if (articles.isEmpty()) {
        item { EmptyRow("لا يوجد شيء هنا بعد", dark) }
    } else {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                articles.forEachIndexed { index, article ->
                    if (insertAdEvery6 && index > 0 && index % 6 == 0) AdSlot(slotId = AdSlotId.READER_PROFILE)
                    val rs = RoundedCornerShape(16.dp)
                    Row(
                        Modifier.fillMaxWidth().shadow(1.dp, rs, clip = false).clip(rs).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), rs)
                            .twClickable(pressScale = 0.99f) { onClick(article) }.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        AsyncImage(article.featuredImage, null, Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100), contentScale = ContentScale.Crop)
                        Column(Modifier.weight(1f)) {
                            Text(article.title, Modifier.padding(bottom = 4.dp), style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { LuIcon(Lu.Eye, 12.dp, Color(0xFF14B8A6)); Text(arNum(article.viewsCount), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400) }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { LuIcon(Lu.Heart, 12.dp, Tw.rose500); Text("${article.likesCount}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400) }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.tweetRows(tweets: List<Tweet>, dark: Boolean, onClick: (Tweet) -> Unit) {
    if (tweets.isEmpty()) {
        item { EmptyRow("لا يوجد شيء هنا بعد", dark) }
    } else {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                tweets.forEach { tweet ->
                    val rs = RoundedCornerShape(16.dp)
                    Column(Modifier.fillMaxWidth().shadow(1.dp, rs, clip = false).clip(rs).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), rs).twClickable(pressScale = 0.99f) { onClick(tweet) }.padding(16.dp)) {
                        Text(tweet.content, style = twText(14, FontWeight.Normal, 22), color = if (dark) Tw.slate200 else Tw.slate800, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                            LuIcon(Lu.Heart, 12.dp, Tw.rose500)
                            Text("${tweet.likesCount}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyRow(text: String, dark: Boolean) {
    val s = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, s).padding(32.dp), contentAlignment = Alignment.Center) {
        Text(text, style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
    }
}
