package studio.ai.literium.literium_app.util

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.remote.NetworkModule

/**
 * Shared `POST /api/media/upload` (purpose="tweet") call used from every tweet-image entry point —
 * the inline [studio.ai.literium.literium_app.ui.components.TweetComposerBar], the comment composer
 * inside [studio.ai.literium.literium_app.ui.components.TweetCard], and the standalone
 * [studio.ai.literium.literium_app.ui.screens.tweet.TweetComposerScreen] — instead of duplicating the
 * same multipart-building boilerplate three times (see e.g. ArticleEditorViewModel.uploadMedia for
 * the original pattern this mirrors).
 */
suspend fun uploadTweetImage(context: Context, uri: Uri): Result<String> = try {
    val resolver = context.contentResolver
    val mime = resolver.getType(uri) ?: "image/jpeg"
    val bytes = withContext(Dispatchers.IO) { resolver.openInputStream(uri)?.use { it.readBytes() } }
        ?: throw IllegalStateException("تعذّرت قراءة الصورة المحددة.")
    val requestBody = bytes.toRequestBody(mime.toMediaTypeOrNull())
    val part = MultipartBody.Part.createFormData("file", "tweet.jpg", requestBody)
    val purposePart = "tweet".toRequestBody("text/plain".toMediaTypeOrNull())
    val header = NetworkModule.authorizationHeader()
    val response = NetworkModule.api.uploadMedia(header, part, purposePart)
    Result.success(response.url)
} catch (e: Exception) {
    Result.failure(e)
}
