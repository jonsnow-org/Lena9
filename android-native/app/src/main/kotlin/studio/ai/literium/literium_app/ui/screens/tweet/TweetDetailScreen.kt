package studio.ai.literium.literium_app.ui.screens.tweet

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.components.TweetCard
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * A single tweet's detail view, reached via `Screen.TweetDetail.of(tweetId)` — spec §4.18/§8. The
 * web app itself never navigates to a separate tweet page (comments expand inline in the feed
 * card), but a dedicated Android destination is genuinely useful (deep links from notifications,
 * "view thread" from a profile's tweets tab) — it reuses [TweetCard] with its comment thread forced
 * open, rather than re-implementing the same interaction surface twice.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TweetDetailScreen(
    tweetId: String,
    onBack: () -> Unit,
    onAuthorClick: (String) -> Unit
) {
    val viewModel: TweetViewModel = viewModel()
    val state by viewModel.detailState.collectAsState()

    LaunchedEffect(tweetId) { viewModel.loadTweet(tweetId) }
    LaunchedEffect(state.deleted) { if (state.deleted) onBack() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("التغريدة", fontSize = 15.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") } }
            )
        }
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandTeal)
            }
            state.notFound || state.tweet == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("تعذر العثور على هذه التغريدة.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> {
                val tweet = state.tweet!!
                val canDelete = state.currentUserId == tweet.authorId || state.isAdmin
                val deleteHandler: ((String) -> Unit)? = if (canDelete) { { _: String -> viewModel.deleteTweet() } } else null
                Box(modifier = Modifier.fillMaxSize().padding(padding).padding(14.dp)) {
                    TweetCard(
                        tweet = tweet,
                        currentUserId = state.currentUserId ?: "",
                        isLiked = state.isLiked,
                        isFavorited = state.isFavorited,
                        isAdmin = state.isAdmin,
                        comments = state.comments,
                        onToggleLike = { viewModel.toggleLike() },
                        onToggleFavorite = { viewModel.toggleFavorite() },
                        onShare = { viewModel.share() },
                        onDelete = deleteHandler,
                        onAddComment = { _, content -> viewModel.addComment(content) },
                        onLikeComment = { commentId, isLiking -> viewModel.likeComment(commentId, isLiking) },
                        onReplyToComment = { commentId, content -> viewModel.replyToComment(commentId, content) },
                        onSelectAuthor = onAuthorClick,
                        startExpanded = true
                    )
                }
            }
        }
    }
}
