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

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ProfileScreen(navController: NavController, viewModel: ProfileViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ملفي") },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.Wallet.route) }) {
                        Icon(Icons.Filled.AccountBalanceWallet, contentDescription = "المحفظة")
                    }
                    IconButton(onClick = { navController.navigate(Screen.EditProfile.route) }) {
                        Icon(Icons.Filled.Edit, contentDescription = "تعديل الملف الشخصي")
                    }
                }
            )
        }
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.notSignedIn || state.currentUser == null -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text("يجب تسجيل الدخول لعرض ملفك الشخصي.")
            }
            else -> {
                val user = state.currentUser!!
                // إعادة قراءة إشارات مرجعية محلية (SharedPreferences، لا Firestore — نفس سلوك
                // الويب) عند دخول تبويب "المدونة › المحفوظات" تحديداً، لأن تفعيلها من شاشة
                // أخرى (الخلاصة، القارئ) لا يُخطر هذا ViewModel تلقائياً بخلاف بقية البيانات.
                LaunchedEffect(state.activeTab, state.blogSubTab) {
                    if (state.activeTab == ProfileTab.BLOG && state.blogSubTab == BlogSubTab.BOOKMARKS) {
                        viewModel.refreshBookmarks()
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                    item {
                        ProfileHeader(
                            avatarUrl = user.avatarUrl,
                            coverUrl = user.coverUrl,
                            fullName = user.penName ?: user.fullName,
                            username = user.username,
                            isVerified = user.isVerified == true,
                            bio = user.bio,
                            memberStatusLabel = state.memberStatusLabel,
                            followersCount = state.followersCount,
                            followingCount = state.followingCount,
                            joinedDate = user.joinedDate,
                            onFollowers = { navController.navigate(Screen.FollowList.of(user.id, followers = true)) },
                            onFollowing = { navController.navigate(Screen.FollowList.of(user.id, followers = false)) }
                        )
                    }

                    item {
                        RoleSwitcher(
                            currentRole = user.role,
                            onSwitch = viewModel::switchRole
                        )
                    }

                    if (user.role != UserRole.ADMIN) {
                        item {
                            state.eligibility?.let { eligibility ->
                                CreatorEligibilityCard(
                                    eligibility = eligibility,
                                    onOpenKyc = { navController.navigate(Screen.Kyc.route) }
                                )
                            }
                        }
                    }

                    if (user.role == UserRole.ADMIN) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(16.dp).clickable {
                                    navController.navigate(Screen.Admin.route)
                                },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Filled.AdminPanelSettings, contentDescription = null)
                                    Text("لوحة إدارة المنصة", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    // ثلاثة تبويبات فقط أسفل المحفظة/بطاقة الأهلية — مطابق حرفياً لـ
                    // UserProfileView.tsx (مدونة/تغريد/لوحة التحكم)، لا شريط تبويبات مسطّح
                    // بأربعة أزرار كما كان سابقاً: "مدونة" و"تغريد" هما المحتوى المنشور،
                    // و"لوحة التحكم" تجمع كل ما هو إدارة/مال/إعدادات خلف مدخل واحد.
                    if (user.role != UserRole.ADMIN) {
                        item {
                            ProfileTopTabs(activeTab = state.activeTab, onSelect = viewModel::selectTab)
                        }

                        when (state.activeTab) {
                            ProfileTab.BLOG -> {
                                item {
                                    BlogSubTabRow(
                                        activeSubTab = state.blogSubTab,
                                        articlesCount = state.ownArticles.size,
                                        bookmarksCount = state.bookmarkedArticles.size,
                                        onSelect = viewModel::selectBlogSubTab
                                    )
                                }
                                when (state.blogSubTab) {
                                    BlogSubTab.ARTICLES -> articleRows(
                                        state.ownArticles,
                                        // reader_profile — كل 6 مقالات داخل "مقالاتي" نفسها، ومستبعد
                                        // تماماً من ملف الأدمن (نفس شرط UserProfileView.tsx بالضبط).
                                        insertAdEvery6 = true
                                    ) { navController.navigate(Screen.ArticleReader.of(it.id)) }
                                    BlogSubTab.BOOKMARKS -> articleRows(state.bookmarkedArticles) {
                                        navController.navigate(Screen.ArticleReader.of(it.id))
                                    }
                                }
                            }
                            ProfileTab.TWEET -> {
                                item {
                                    TweetSubTabRow(
                                        activeSubTab = state.tweetSubTab,
                                        mineCount = state.ownTweets.size,
                                        favoritesCount = state.favoritedTweets.size,
                                        onSelect = viewModel::selectTweetSubTab
                                    )
                                }
                                when (state.tweetSubTab) {
                                    TweetSubTab.MINE -> tweetRows(state.ownTweets) { navController.navigate(Screen.TweetDetail.of(it.id)) }
                                    TweetSubTab.FAVORITES -> tweetRows(state.favoritedTweets) { navController.navigate(Screen.TweetDetail.of(it.id)) }
                                }
                            }
                            ProfileTab.CONTROL_PANEL -> {
                                item {
                                    ControlPanelSection(
                                        totalViews = state.totalOwnViews,
                                        articlesCount = state.ownArticles.size,
                                        followersCount = state.followersCount,
                                        onOpenAds = { navController.navigate(Screen.AdvertiserDashboard.route) },
                                        onOpenEarnings = { navController.navigate(Screen.Wallet.route) },
                                        onOpenLiterarySettings = { navController.navigate(Screen.EditProfile.route) }
                                    )
                                }
                            }
                        }
                    }

                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@Composable
private fun ProfileHeader(
    avatarUrl: String,
    coverUrl: String?,
    fullName: String,
    username: String,
    isVerified: Boolean,
    bio: String?,
    memberStatusLabel: String,
    followersCount: Int,
    followingCount: Int,
    joinedDate: String?,
    onFollowers: () -> Unit,
    onFollowing: () -> Unit
) {
    Column(Modifier.fillMaxWidth()) {
        AsyncImage(
            model = coverUrl,
            contentDescription = null,
            modifier = Modifier.fillMaxWidth().height(140.dp).background(MaterialTheme.colorScheme.surfaceVariant)
        )
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = fullName,
                    modifier = Modifier.size(84.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                        if (isVerified) {
                            Spacer(Modifier.width(4.dp))
                            Icon(Icons.Filled.Verified, contentDescription = "موثق", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        }
                    }
                    Text("@$username", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Text(memberStatusLabel, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            if (!bio.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(bio, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                StatCounter("$followersCount", "متابع", onFollowers)
                StatCounter("$followingCount", "متابَع", onFollowing)
                if (!joinedDate.isNullOrBlank()) {
                    Column {
                        Text(joinedDate, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                        Text("تاريخ الانضمام", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
    HorizontalDivider()
}

@Composable
private fun StatCounter(value: String, label: String, onClick: () -> Unit) {
    Column(modifier = Modifier.clickable(onClick = onClick)) {
        Text(value, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun RoleSwitcher(currentRole: String, onSwitch: (String) -> Unit) {
    if (currentRole == UserRole.ADMIN) return
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val labels = mapOf(
            UserRole.READER to "قارئ",
            UserRole.WRITER to "كاتب",
            UserRole.ADVERTISER to "معلن"
        )
        UserRole.SELF_ASSIGNABLE.forEach { role ->
            FilterChip(
                selected = currentRole == role,
                onClick = { onSwitch(role) },
                label = { Text(labels[role] ?: role) }
            )
        }
    }
}

/** "مدونة / تغريد / لوحة التحكم" — exact port of `UserProfileView.tsx`'s three-button segmented
 *  row (spec §4.19): a single flat container with three equal-width buttons, the active one raised
 *  on a surface chip — not a Material [TabRow]/[Tab] pair, which renders as an underlined strip and
 *  reads as a completely different navigation idiom than the web's pill-segmented control. */
@Composable
private fun ProfileTopTabs(activeTab: ProfileTab, onSelect: (ProfileTab) -> Unit) {
    val tabs = listOf(
        Triple(ProfileTab.BLOG, "مدونة", Icons.Filled.Article),
        Triple(ProfileTab.TWEET, "تغريد", Icons.Filled.Chat),
        Triple(ProfileTab.CONTROL_PANEL, "لوحة التحكم", Icons.Filled.Tune)
    )
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Row(modifier = Modifier.padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            tabs.forEach { (tab, label, icon) ->
                val active = activeTab == tab
                Surface(
                    color = if (active) MaterialTheme.colorScheme.surface else Color.Transparent,
                    contentColor = if (active) BrandTeal else MaterialTheme.colorScheme.onSurfaceVariant,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).clickable { onSelect(tab) }
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

/** "مقالاتي / المقالات المحفوظة" pill row under the مدونة tab — matches web's `blogSubView`. */
@Composable
private fun BlogSubTabRow(activeSubTab: BlogSubTab, articlesCount: Int, bookmarksCount: Int, onSelect: (BlogSubTab) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        SubTabPill(label = "مقالاتي ($articlesCount)", icon = Icons.Filled.Article, active = activeSubTab == BlogSubTab.ARTICLES) {
            onSelect(BlogSubTab.ARTICLES)
        }
        SubTabPill(label = "المحفوظة ($bookmarksCount)", icon = Icons.Filled.Bookmark, active = activeSubTab == BlogSubTab.BOOKMARKS) {
            onSelect(BlogSubTab.BOOKMARKS)
        }
    }
}

/** "تغريداتي / المفضلة" pill row under the تغريد tab — matches web's `tweetSubView`. */
@Composable
private fun TweetSubTabRow(activeSubTab: TweetSubTab, mineCount: Int, favoritesCount: Int, onSelect: (TweetSubTab) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        SubTabPill(label = "تغريداتي ($mineCount)", icon = Icons.Filled.Chat, active = activeSubTab == TweetSubTab.MINE) {
            onSelect(TweetSubTab.MINE)
        }
        SubTabPill(label = "المفضلة ($favoritesCount)", icon = Icons.Filled.Star, active = activeSubTab == TweetSubTab.FAVORITES) {
            onSelect(TweetSubTab.FAVORITES)
        }
    }
}

@Composable
private fun SubTabPill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (active) BrandTeal else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(14.dp))
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** "لوحة التحكم": overview stat grid + three navigation entries (إعلاناتي/الأرباح/الإعدادات
 *  الأدبية) — matches web's `writerTab === 'control_panel'` section (spec §4.19). The web embeds
 *  each sub-section's full form directly inline; this app instead routes to the equivalent existing
 *  standalone screen ([Screen.AdvertiserDashboard]/[Screen.Wallet]/[Screen.EditProfile]) rather than
 *  duplicating that already-built UI a second time inside this card. */
@Composable
private fun ControlPanelSection(
    totalViews: Int,
    articlesCount: Int,
    followersCount: Int,
    onOpenAds: () -> Unit,
    onOpenEarnings: () -> Unit,
    onOpenLiterarySettings: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            ControlPanelStat(label = "إجمالي المشاهدات", value = "$totalViews", modifier = Modifier.weight(1f))
            ControlPanelStat(label = "المقالات", value = "$articlesCount", modifier = Modifier.weight(1f))
            ControlPanelStat(label = "المتابعون", value = "$followersCount", modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        ControlPanelNavCard(label = "الإعلانات والترويج", icon = Icons.Filled.Campaign, onClick = onOpenAds)
        Spacer(Modifier.height(8.dp))
        ControlPanelNavCard(label = "الأرباح والمحفظة", icon = Icons.Filled.AccountBalanceWallet, onClick = onOpenEarnings)
        Spacer(Modifier.height(8.dp))
        ControlPanelNavCard(label = "الإعدادات الأدبية", icon = Icons.Filled.Edit, onClick = onOpenLiterarySettings)
    }
}

@Composable
private fun ControlPanelStat(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(value, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
            Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ControlPanelNavCard(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(icon, contentDescription = null, tint = BrandTeal)
                Text(label, fontWeight = FontWeight.Bold)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
        }
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
    insertAdEvery6: Boolean = false,
    onClick: (Article) -> Unit
) {
    if (articles.isEmpty()) {
        item { EmptyRow("لا يوجد شيء هنا بعد") }
    } else {
        itemsIndexed(articles, key = { _, it -> it.id }) { index, article ->
            if (insertAdEvery6 && index > 0 && index % 6 == 0) {
                AdSlot(slotId = AdSlotId.READER_PROFILE)
            }
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onClick(article) }.padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AsyncImage(
                    model = article.featuredImage,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(article.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        "${article.viewsCount} مشاهدة  •  ${article.likesCount} إعجاب",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.tweetRows(tweets: List<Tweet>, onClick: (Tweet) -> Unit) {
    if (tweets.isEmpty()) {
        item { EmptyRow("لا يوجد شيء هنا بعد") }
    } else {
        items(tweets, key = { it.id }) { tweet ->
            Column(
                modifier = Modifier.fillMaxWidth().clickable { onClick(tweet) }.padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Text(tweet.content, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Favorite, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${tweet.likesCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun EmptyRow(text: String) {
    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
