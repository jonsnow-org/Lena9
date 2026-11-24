package studio.ai.literium.literium_app.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.uploadTweetImage

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
    onSubmit: (String, String?) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "بماذا تفكر؟ شارك خاطرة قصيرة...",
    clearOnSubmit: Boolean = true
) {
    var content by remember { mutableStateOf("") }
    var imageUrl by remember { mutableStateOf<String?>(null) }
    var isUploadingImage by remember { mutableStateOf(false) }
    var imageError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        imageError = null
        isUploadingImage = true
        coroutineScope.launch {
            uploadTweetImage(context, uri).fold(
                onSuccess = { url -> isUploadingImage = false; imageUrl = url },
                onFailure = { e -> isUploadingImage = false; imageError = e.message ?: "تعذّر رفع الصورة." }
            )
        }
    }
    val remaining = MAX_TWEET_LENGTH - content.length
    val isOverLimit = remaining < 0
    val canSubmit = content.isNotBlank() && !isOverLimit && !isUploadingImage

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

                if (isUploadingImage) {
                    Row(modifier = Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = BrandTeal)
                        Text("جاري رفع الصورة...", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 6.dp))
                    }
                }
                imageError?.let { err -> Text(err, fontSize = 10.sp, color = Color(0xFFE11D48), modifier = Modifier.padding(top = 4.dp)) }
                imageUrl?.let { url ->
                    Box(modifier = Modifier.padding(top = 6.dp), contentAlignment = Alignment.TopEnd) {
                        AsyncImage(
                            model = url,
                            contentDescription = null,
                            modifier = Modifier.size(110.dp).clip(RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Surface(color = Color.Black.copy(alpha = 0.55f), shape = RoundedCornerShape(8.dp), modifier = Modifier.padding(4.dp)) {
                            IconButton(onClick = { imageUrl = null }, modifier = Modifier.size(22.dp)) {
                                Icon(Icons.Filled.Close, contentDescription = "إزالة الصورة", tint = Color.White, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { imagePicker.launch("image/*") }, enabled = !isUploadingImage, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Filled.Image, contentDescription = "إرفاق صورة", tint = BrandTeal, modifier = Modifier.size(16.dp))
                        }
                        Text(
                            "$remaining",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = when {
                                isOverLimit -> Color(0xFFE11D48)
                                remaining <= 20 -> Color(0xFFF59E0B)
                                else -> MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                    TextButton(
                        onClick = {
                            onSubmit(content.trim(), imageUrl)
                            if (clearOnSubmit) {
                                content = ""
                                imageUrl = null
                                imageError = null
                            }
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
