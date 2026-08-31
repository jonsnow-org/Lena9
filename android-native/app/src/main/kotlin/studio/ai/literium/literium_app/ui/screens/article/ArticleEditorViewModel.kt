package studio.ai.literium.literium_app.ui.screens.article

import android.app.Application
import android.net.Uri
import androidx.compose.ui.text.input.TextFieldValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.AiWritingAssistantRequest
import studio.ai.literium.literium_app.data.remote.AiSeoGeneratorRequest
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository

/** The 7 AI writing-assistant tools wired into the editor toolbar (spec §4.5), matching the exact
 *  `action` codes `ArticleEditorModal.tsx`'s `handleAiAction` sends to `/api/ai/writing-assistant`. */
object AiWritingTool {
    const val SUGGEST_TITLES = "suggest_titles"
    const val GENERATE_PARAGRAPH = "generate_paragraph"
    const val IMPROVE_STYLE = "improve_style"
    const val FIX_GRAMMAR = "fix_grammar"
    const val GENERATE_OUTLINE = "generate_outline"
    const val SUMMARIZE_ARTICLE = "summarize_article"
    const val SUGGEST_CATEGORIES = "suggest_categories"

    val ALL = listOf(SUGGEST_TITLES, GENERATE_PARAGRAPH, IMPROVE_STYLE, FIX_GRAMMAR, GENERATE_OUTLINE, SUMMARIZE_ARTICLE, SUGGEST_CATEGORIES)

    fun labelAr(action: String): String = when (action) {
        SUGGEST_TITLES -> "اقتراح عناوين"
        GENERATE_PARAGRAPH -> "توليد فقرة"
        IMPROVE_STYLE -> "تحسين الأسلوب"
        FIX_GRAMMAR -> "تدقيق لغوي"
        GENERATE_OUTLINE -> "مخطط مقال"
        SUMMARIZE_ARTICLE -> "تلخيص المقال"
        SUGGEST_CATEGORIES -> "اقتراح وسوم"
        else -> action
    }
}

val COVER_IMAGE_PRESETS = listOf(
    "أدب وكتابة كلاسيكية" to "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80",
    "فلسفة وفكر" to "https://images.unsplash.com/photo-1507842229451-79b1be897a27?w=1200&auto=format&fit=crop&q=80",
    "تكنولوجيا وذكاء اصطناعي" to "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
    "تاريخ وحضارات" to "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1200&auto=format&fit=crop&q=80",
    "علم وفضاء" to "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80"
)

data class ArticleEditorUiState(
    val isLoading: Boolean = false,
    val isEditingExisting: Boolean = false,
    val currentUser: User? = null,
    val title: String = "",
    val description: String = "",
    val content: TextFieldValue = TextFieldValue(""),
    val category: String = ArticleCategory.LITERATURE,
    val subCategory: String = "",
    val featuredImage: String = COVER_IMAGE_PRESETS[0].second,
    val videoUrl: String = "",
    val uploadedVideoUrl: String = "",
    val sourceUrl: String = "",
    val isLocked: Boolean = false,
    val lockedPrice: Double = 3.0,
    val tagsInput: String = "أدب, فكر, قراءات",
    val isUploadingImage: Boolean = false,
    val isUploadingVideo: Boolean = false,
    val uploadError: String? = null,
    val isSubmitting: Boolean = false,
    val submitError: String? = null,
    val isAiLoading: Boolean = false,
    val activeAiTool: String? = null,
    val aiOutput: String? = null,
    val aiError: String? = null,
    val isSeoLoading: Boolean = false,
    val seoSuccess: String? = null,
    val savedArticleId: String? = null
) {
    val wordCount: Int get() = content.text.trim().let { if (it.isEmpty()) 0 else it.split(Regex("\\s+")).size }
}

/**
 * Backs [ArticleEditorScreen] (spec §4.5) — create/edit article authoring: title/description/
 * category/tags, cover image + video upload (`POST /api/media/upload`, spec §11.4), the 7 AI
 * writing-assistant tools, and the locked/paid-article toggle. The body is kept as raw HTML in a
 * backing string (see [ArticleEditorScreen]'s formatting toolbar) — Compose has no native rich-text
 * editor, so a selection-wrapping toolbar + live [studio.ai.literium.literium_app.ui.components.HtmlContent]
 * preview is the pragmatic substitute (see final report for exactly how close this gets to the real
 * web editor's toolset).
 */
class ArticleEditorViewModel(application: Application) : AndroidViewModel(application) {

    private val articleRepository = ArticleRepository()
    private val authRepository = AuthRepository()

    private val _uiState = MutableStateFlow(ArticleEditorUiState())
    val uiState: StateFlow<ArticleEditorUiState> = _uiState.asStateFlow()

    private var existingArticle: Article? = null
    private var loadedFor: String? = "__unset__"

    init {
        viewModelScope.launch {
            authRepository.authState().collect { fbUser ->
                if (fbUser == null) {
                    _uiState.value = _uiState.value.copy(currentUser = null)
                } else {
                    authRepository.fetchUserFromFirestore(fbUser.uid).getOrNull()?.let { user ->
                        _uiState.value = _uiState.value.copy(currentUser = user)
                    }
                }
            }
        }
    }

    /** [articleId] null = new article; non-null = load for editing. Safe to call repeatedly with the
     *  same argument (e.g. on recomposition) — only the first call per distinct argument does work. */
    fun load(articleId: String?) {
        if (loadedFor == articleId) return
        loadedFor = articleId
        if (articleId == null) {
            _uiState.value = ArticleEditorUiState(currentUser = _uiState.value.currentUser)
            return
        }
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            articleRepository.fetchArticle(articleId).fold(
                onSuccess = { article ->
                    if (article == null) {
                        _uiState.value = _uiState.value.copy(isLoading = false, submitError = "تعذر العثور على هذا المقال للتعديل.")
                    } else {
                        existingArticle = article
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isEditingExisting = true,
                            title = article.title,
                            description = article.description,
                            content = TextFieldValue(article.content),
                            category = article.category,
                            subCategory = article.subCategory ?: "",
                            featuredImage = article.featuredImage.ifBlank { COVER_IMAGE_PRESETS[0].second },
                            videoUrl = article.videoUrl ?: "",
                            uploadedVideoUrl = article.uploadedVideoUrl ?: "",
                            sourceUrl = article.sourceUrl ?: "",
                            isLocked = article.isLocked,
                            lockedPrice = article.lockedPrice ?: 3.0,
                            tagsInput = article.tags.joinToString(", ")
                        )
                    }
                },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isLoading = false, submitError = e.message) }
            )
        }
    }

    fun setTitle(v: String) { _uiState.value = _uiState.value.copy(title = v) }
    fun setDescription(v: String) { _uiState.value = _uiState.value.copy(description = v) }
    fun setContent(v: TextFieldValue) { _uiState.value = _uiState.value.copy(content = v) }
    fun setCategory(v: String) { _uiState.value = _uiState.value.copy(category = v) }
    fun setSubCategory(v: String) { _uiState.value = _uiState.value.copy(subCategory = v) }
    fun setFeaturedImageUrl(v: String) { _uiState.value = _uiState.value.copy(featuredImage = v) }
    fun setVideoUrl(v: String) { _uiState.value = _uiState.value.copy(videoUrl = v) }
    fun setSourceUrl(v: String) { _uiState.value = _uiState.value.copy(sourceUrl = v) }
    fun setTagsInput(v: String) { _uiState.value = _uiState.value.copy(tagsInput = v) }
    fun setLocked(v: Boolean) { _uiState.value = _uiState.value.copy(isLocked = v) }
    fun setLockedPrice(v: Double) { _uiState.value = _uiState.value.copy(lockedPrice = v) }
    fun selectPresetCover(url: String) { _uiState.value = _uiState.value.copy(featuredImage = url) }

    /** Wraps the current selection in [openTag]/[closeTag] (e.g. `"<b>"`/`"</b>"`), or — with no
     *  selection — inserts an empty pair with the cursor placed between them, exactly the pragmatic
     *  "wrap selected plain-text range in an HTML tag" toolbar behavior described in task scope. */
    fun applyInlineTag(openTag: String, closeTag: String) {
        val current = _uiState.value.content
        val text = current.text
        val start = current.selection.min
        val end = current.selection.max
        val selected = text.substring(start, end)
        val newText = text.substring(0, start) + openTag + selected + closeTag + text.substring(end)
        val newCursor = if (selected.isEmpty()) start + openTag.length else start + openTag.length + selected.length + closeTag.length
        _uiState.value = _uiState.value.copy(
            content = TextFieldValue(newText, androidx.compose.ui.text.TextRange(newCursor))
        )
    }

    /** Wraps each non-blank line of the selection (or a single empty placeholder line) as `<li>`
     *  items inside a `<ul>`/`<ol>` block. */
    fun applyListTag(ordered: Boolean) {
        val current = _uiState.value.content
        val text = current.text
        val start = current.selection.min
        val end = current.selection.max
        val selected = text.substring(start, end)
        val lines = if (selected.isBlank()) listOf("") else selected.split("\n").filter { it.isNotBlank() }.ifEmpty { listOf("") }
        val tag = if (ordered) "ol" else "ul"
        val block = "<$tag>\n" + lines.joinToString("\n") { "<li>${it.trim()}</li>" } + "\n</$tag>"
        val newText = text.substring(0, start) + block + text.substring(end)
        _uiState.value = _uiState.value.copy(content = TextFieldValue(newText, androidx.compose.ui.text.TextRange(start + block.length)))
    }

    fun applyHeading() = applyInlineTag("<h2>", "</h2>")

    // ---- Media upload (POST /api/media/upload, spec §11.4) ----

    fun uploadCoverImage(uri: Uri) = uploadMedia(uri, isVideo = false)
    fun uploadArticleVideo(uri: Uri) = uploadMedia(uri, isVideo = true)

    private fun uploadMedia(uri: Uri, isVideo: Boolean) {
        _uiState.value = if (isVideo) _uiState.value.copy(isUploadingVideo = true, uploadError = null)
        else _uiState.value.copy(isUploadingImage = true, uploadError = null)

        viewModelScope.launch {
            try {
                val context = getApplication<Application>()
                val resolver = context.contentResolver
                val mime = resolver.getType(uri) ?: if (isVideo) "video/mp4" else "image/jpeg"
                val bytes = withContext(Dispatchers.IO) { resolver.openInputStream(uri)?.use { it.readBytes() } }
                    ?: throw IllegalStateException("تعذّرت قراءة الملف المحدد.")

                val requestBody = bytes.toRequestBody(mime.toMediaTypeOrNull())
                val ext = if (isVideo) "mp4" else "jpg"
                val part = MultipartBody.Part.createFormData("file", "upload.$ext", requestBody)
                val purposePart = "article".toRequestBody("text/plain".toMediaTypeOrNull())

                val header = NetworkModule.authorizationHeader()
                val response = NetworkModule.api.uploadMedia(header, part, purposePart)

                _uiState.value = if (isVideo) {
                    _uiState.value.copy(isUploadingVideo = false, uploadedVideoUrl = response.url)
                } else {
                    _uiState.value.copy(isUploadingImage = false, featuredImage = response.url)
                }
            } catch (e: Exception) {
                _uiState.value = if (isVideo) {
                    _uiState.value.copy(isUploadingVideo = false, uploadError = e.message ?: "تعذّر رفع الفيديو.")
                } else {
                    _uiState.value.copy(isUploadingImage = false, uploadError = e.message ?: "تعذّر رفع الصورة.")
                }
            }
        }
    }

    // ---- AI writing assistant (7 tools, spec §4.5) ----

    fun runAiTool(action: String) {
        val user = _uiState.value.currentUser
        if (_uiState.value.isAiLoading) return
        _uiState.value = _uiState.value.copy(isAiLoading = true, activeAiTool = action, aiOutput = null, aiError = null)
        viewModelScope.launch {
            try {
                val response = NetworkModule.api.writingAssistant(
                    AiWritingAssistantRequest(
                        action = action,
                        text = _uiState.value.content.text.ifBlank { _uiState.value.description },
                        title = _uiState.value.title,
                        category = _uiState.value.category,
                        userId = user?.id,
                        isSubscriber = user?.aiQuota?.plan != null && user.aiQuota?.plan != "none",
                        plan = user?.aiQuota?.plan ?: "none"
                    )
                )
                _uiState.value = _uiState.value.copy(isAiLoading = false, aiOutput = response.result)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isAiLoading = false, aiError = e.message ?: "تعذر الاتصال بالخدمة الذكية.")
            }
        }
    }

    fun dismissAiOutput() {
        _uiState.value = _uiState.value.copy(aiOutput = null, activeAiTool = null)
    }

    /** Applies [aiOutput] into the relevant field, exactly matching `handleApplyAiOutput`'s per-tool routing. */
    fun applyAiOutput() {
        val output = _uiState.value.aiOutput ?: return
        when (_uiState.value.activeAiTool) {
            AiWritingTool.SUGGEST_TITLES -> {
                val firstLine = output.lineSequence().firstOrNull()
                    ?.replace(Regex("^\\d+[.\\-\\s]+"), "")
                    ?.trim('"', '\'') ?: output
                _uiState.value = _uiState.value.copy(title = firstLine)
            }
            AiWritingTool.GENERATE_PARAGRAPH, AiWritingTool.GENERATE_OUTLINE -> {
                val current = _uiState.value.content
                val appended = if (current.text.isBlank()) output else current.text + "\n\n" + output
                _uiState.value = _uiState.value.copy(content = TextFieldValue(appended, androidx.compose.ui.text.TextRange(appended.length)))
            }
            AiWritingTool.IMPROVE_STYLE, AiWritingTool.FIX_GRAMMAR -> {
                _uiState.value = _uiState.value.copy(content = TextFieldValue(output, androidx.compose.ui.text.TextRange(output.length)))
            }
            AiWritingTool.SUMMARIZE_ARTICLE -> {
                _uiState.value = _uiState.value.copy(description = output)
            }
            AiWritingTool.SUGGEST_CATEGORIES -> {
                val tags = Regex("#[^\\s,]+").findAll(output).map { it.value.removePrefix("#") }.joinToString(", ")
                if (tags.isNotBlank()) _uiState.value = _uiState.value.copy(tagsInput = tags)
            }
        }
        _uiState.value = _uiState.value.copy(aiOutput = null, activeAiTool = null)
    }

    /** The separate SEO generator (`/api/ai/seo-generator`) — not one of the 7 writing-assistant
     *  tools, but present alongside them in the real editor's "التصنيف والوسوم الذكية" section. */
    fun generateAiSeo() {
        val user = _uiState.value.currentUser ?: return
        if (_uiState.value.title.isBlank() && _uiState.value.content.text.isBlank()) {
            _uiState.value = _uiState.value.copy(aiError = "يرجى كتابة عنوان المقال أو جزء من محتواه أولاً.")
            return
        }
        _uiState.value = _uiState.value.copy(isSeoLoading = true, seoSuccess = null, aiError = null)
        viewModelScope.launch {
            try {
                val response = NetworkModule.api.seoGenerator(
                    AiSeoGeneratorRequest(
                        title = _uiState.value.title,
                        content = _uiState.value.content.text,
                        category = _uiState.value.category,
                        userId = user.id,
                        isSubscriber = user.aiQuota?.plan != null && user.aiQuota?.plan != "none",
                        plan = user.aiQuota?.plan ?: "none"
                    )
                )
                var next = _uiState.value.copy(isSeoLoading = false, seoSuccess = "تم توليد الوسوم والوصف والتصنيف بنجاح!")
                if (response.tags.isNotEmpty()) next = next.copy(tagsInput = response.tags.joinToString(", "))
                if (response.metaDescription.isNotBlank() && next.description.isBlank()) next = next.copy(description = response.metaDescription)
                if (response.suggestedCategory.isNotBlank()) next = next.copy(category = response.suggestedCategory)
                _uiState.value = next
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSeoLoading = false, aiError = e.message ?: "تعذر توليد وسوم السيو.")
            }
        }
    }

    // ---- Save / publish ----

    fun save(status: String) {
        val user = _uiState.value.currentUser
        val state = _uiState.value
        if (user == null) {
            _uiState.value = state.copy(submitError = "يجب تسجيل الدخول لحفظ المقال.")
            return
        }
        if (state.title.isBlank() || state.content.text.isBlank()) {
            _uiState.value = state.copy(submitError = "يرجى ملء عنوان المقال ومحتواه أولاً.")
            return
        }
        _uiState.value = state.copy(isSubmitting = true, submitError = null)

        val tags = state.tagsInput.split(",").map { it.trim().trimStart('#') }.filter { it.isNotBlank() }
        val base = existingArticle ?: Article()
        val article = base.copy(
            writerId = user.id,
            writerName = user.penName?.takeIf { it.isNotBlank() } ?: user.fullName,
            writerUsername = user.username,
            writerAvatar = user.avatarUrl,
            writerIsVerified = user.isVerified == true,
            title = state.title.trim(),
            description = state.description.trim().ifBlank { state.title.trim().take(120) },
            content = state.content.text.trim(),
            category = state.category,
            subCategory = state.subCategory.trim().ifBlank { null },
            featuredImage = state.featuredImage,
            videoUrl = state.videoUrl.trim().ifBlank { null },
            uploadedVideoUrl = state.uploadedVideoUrl.trim().ifBlank { null },
            sourceUrl = state.sourceUrl.trim().ifBlank { null },
            isLocked = state.isLocked,
            lockedPrice = if (state.isLocked) state.lockedPrice else 0.0,
            tags = tags.ifEmpty { listOf("أدب", "ثقافة") },
            status = status,
            readingTimeMinutes = (state.wordCount / 200).coerceAtLeast(1).toLong()
        )

        viewModelScope.launch {
            articleRepository.saveArticle(article, isNew = existingArticle == null).fold(
                onSuccess = { id -> _uiState.value = _uiState.value.copy(isSubmitting = false, savedArticleId = id) },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isSubmitting = false, submitError = e.message ?: "تعذر حفظ المقال.") }
            )
        }
    }
}
