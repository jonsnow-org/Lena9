package studio.ai.literium.literium_app.ui.screens.follow

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** قائمة المتابِعين/المتابَعين — FollowListModal.tsx: عنوان بالرأس، شريط إعلان، صفوف p-2.5 (صورة 44 دائرية + اسم + @معرّف) وزر متابعة rounded-xl. */
@Composable
fun FollowListScreen(
    userId: String,
    followers: Boolean,
    navController: NavController,
    viewModel: FollowListViewModel = viewModel(
        factory = viewModelFactory { initializer { FollowListViewModel(targetUserId = userId, showFollowers = followers) } }
    )
) {
    val state by viewModel.uiState.collectAsState()
    val dark = isDark
    TwPage(title = if (followers) "المتابِعون" else "يتابع", onClose = { navController.popBackStack() }, bodyPadding = 12) {
        when {
            state.isLoading -> TwLoading()
            state.errorMessage != null -> Text(state.errorMessage.orEmpty(), Modifier.fillMaxWidth().padding(24.dp), style = twText(12, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.rose500)
            else -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (state.users.isNotEmpty()) AdTickerBar(slotId = "follow_list", externalPriority = true, minHeightDp = 68.dp, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp))
                if (state.users.isEmpty()) Column(Modifier.fillMaxWidth().padding(vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    LuIcon(Lu.Users, 32.dp, if (dark) Tw.slate700 else Tw.slate300)
                    Text("لا يوجد أحد هنا بعد.", Modifier.padding(top = 8.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
                state.users.forEach { u ->
                    val isFollowing = state.followedByMeIds.contains(u.id)
                    val isSelf = u.id == state.currentUserId
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.weight(1f).twClickable { navController.navigate(Screen.WriterProfile.of(u.id)) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AsyncImage(u.avatarUrl, u.fullName, Modifier.size(44.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(u.penName ?: u.companyName ?: u.fullName, style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                                    if (u.isVerified == true) LuIcon(Lu.CheckCircle2, 14.dp, androidx.compose.ui.graphics.Color(0xFF14B8A6))
                                }
                                Text("@${u.username}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1)
                            }
                        }
                        if (!isSelf && state.currentUserId.isNotBlank()) {
                            Box(
                                Modifier.clip(RoundedCornerShape(12.dp)).background(if (isFollowing) (if (dark) Tw.slate800 else Tw.slate100) else brand.s600)
                                    .twClickable(pressScale = 0.95f) { viewModel.toggleFollow(u.id) }.padding(horizontal = 12.dp, vertical = 6.dp)
                            ) { Text(if (isFollowing) "إلغاء المتابعة" else "متابعة", style = twText(11, FontWeight.Bold, 16), color = if (isFollowing) (if (dark) Tw.slate300 else Tw.slate600) else Tw.white) }
                        }
                    }
                }
            }
        }
    }
}
