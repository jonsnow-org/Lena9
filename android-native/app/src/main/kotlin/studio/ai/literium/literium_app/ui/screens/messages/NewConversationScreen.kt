package studio.ai.literium.literium_app.ui.screens.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.navigation.Screen

/**
 * "Start a new conversation" — see [NewConversationViewModel]'s file KDoc for why this screen has no
 * direct 1:1 web counterpart. Respects block state in both directions: a row where either side has
 * blocked the other is shown but disabled, exactly like [ChatScreen]'s `canChat` gate.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun NewConversationScreen(
    navController: NavController,
    viewModel: NewConversationViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("محادثة جديدة") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::updateQuery,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                placeholder = { Text("ابحث بالاسم أو اسم المستخدم...") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true
            )

            when {
                state.isLoading -> Box(Modifier.fillMaxSize()) { CircularProgressIndicator(Modifier.align(Alignment.Center)) }
                state.errorMessage != null -> Box(Modifier.fillMaxSize()) {
                    Text(
                        state.errorMessage.orEmpty(),
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        color = MaterialTheme.colorScheme.error
                    )
                }
                state.results.isEmpty() -> Box(Modifier.fillMaxSize()) {
                    Text(
                        "لا يوجد أحد هنا بعد.",
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(items = state.results, key = { it.user.id }) { row ->
                        val u = row.user
                        val displayName = u.penName?.takeIf { it.isNotBlank() }
                            ?: u.companyName?.takeIf { it.isNotBlank() }
                            ?: u.fullName.ifBlank { "مستخدم ليتيريوم" }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = row.canMessage) {
                                    scope.launch {
                                        viewModel.startConversation(u.id).onSuccess { conversationId ->
                                            navController.navigate(Screen.Chat.of(conversationId)) {
                                                popUpTo(Screen.NewConversation.route) { inclusive = true }
                                            }
                                        }
                                    }
                                }
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = u.avatarUrl.ifBlank { PlatformConstants.DEFAULT_AVATAR_URL },
                                contentDescription = displayName,
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        displayName,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = if (row.canMessage) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    if (u.isVerified == true) {
                                        Spacer(Modifier.width(4.dp))
                                        Icon(
                                            Icons.Filled.CheckCircle,
                                            contentDescription = "موثّق",
                                            modifier = Modifier.size(14.dp),
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                                Text(
                                    text = if (!row.canMessage) {
                                        if (row.isBlockedByMe) "لقد حظرت هذا المستخدم" else "لا يمكنك مراسلة هذا المستخدم"
                                    } else {
                                        "@${u.username}"
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (!row.canMessage) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            if (!row.canMessage) {
                                Icon(
                                    Icons.Filled.Block,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }
}
