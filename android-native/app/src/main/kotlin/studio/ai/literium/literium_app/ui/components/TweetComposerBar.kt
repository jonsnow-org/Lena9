package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.BrandTeal

private const val MAX_TWEET_LENGTH = 280

/**
 * The tweet composer bar — full-fidelity port of `src/components/TweetComposer.tsx`. Used both
 * inline atop the tweet-mode feed ([studio.ai.literium.literium_app.ui.screens.feed.FeedScreen])
 * and standalone as a full-page composer
 * ([studio.ai.literium.literium_app.ui.screens.tweet.TweetComposerScreen]).
 */
@Composable
fun TweetComposerBar(
    avatarUrl: String,
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "بماذا تفكر؟ شارك خاطرة قصيرة...",
    clearOnSubmit: Boolean = true
) {
    var content by remember { mutableStateOf("") }
    val remaining = MAX_TWEET_LENGTH - content.length
    val isOverLimit = remaining < 0
    val canSubmit = content.isNotBlank() && !isOverLimit

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(38.dp).clip(CircleShape),
                contentScale = ContentScale.Crop
            )
            Column(modifier = Modifier.padding(start = 10.dp).fillMaxWidth()) {
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    placeholder = { Text(placeholder, fontSize = 13.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp)
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "$remaining",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            isOverLimit -> Color(0xFFE11D48)
                            remaining <= 20 -> Color(0xFFF59E0B)
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                    TextButton(
                        onClick = {
                            onSubmit(content.trim())
                            if (clearOnSubmit) content = ""
                        },
                        enabled = canSubmit
                    ) {
                        Text("تغريد", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}
