package studio.ai.literium.literium_app.ui.screens.tweet

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.BrandTeal

private const val MAX_TWEET_LENGTH = 280

/**
 * Standalone full-page tweet composer (spec §4.18/§8) — reached from the bottom-nav "Compose /
 * Write" entry point when the user's active feed mode is Tweet (§2.2), as opposed to the inline
 * [studio.ai.literium.literium_app.ui.components.TweetComposerBar] embedded atop the feed itself.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TweetComposerScreen(onBack: () -> Unit, onPosted: () -> Unit) {
    val viewModel: TweetViewModel = viewModel()
    val state by viewModel.composerState.collectAsState()
    var content by remember { mutableStateOf("") }

    LaunchedEffect(state.posted) { if (state.posted) onPosted() }

    val remaining = MAX_TWEET_LENGTH - content.length
    val isOverLimit = remaining < 0
    val canSubmit = content.isNotBlank() && !isOverLimit && !state.isPosting

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("تغريدة جديدة", fontSize = 15.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.Close, contentDescription = "إلغاء") } },
                actions = {
                    if (state.isPosting) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp).padding(end = 12.dp), strokeWidth = 2.dp, color = BrandTeal)
                    } else {
                        TextButton(onClick = { viewModel.postTweet(content) }, enabled = canSubmit) {
                            Text("تغريد", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (canSubmit) BrandTeal else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            val errorText = state.error
            if (errorText != null) {
                Text(errorText, fontSize = 11.sp, color = Color(0xFFE11D48), modifier = Modifier.padding(bottom = 8.dp))
            }

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                AsyncImage(
                    model = state.currentUser?.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.size(44.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
                Column(modifier = Modifier.padding(start = 10.dp).fillMaxWidth()) {
                    Text(state.currentUser?.fullName ?: "", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it },
                        placeholder = { Text("بماذا تفكر؟ شارك خاطرة قصيرة...", fontSize = 14.sp) },
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        minLines = 6
                    )
                }
            }

            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                Text(
                    "$remaining",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        isOverLimit -> Color(0xFFE11D48)
                        remaining <= 20 -> Color(0xFFF59E0B)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}
