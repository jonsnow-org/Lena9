package studio.ai.literium.literium_app.data.model

/**
 * Top-level article comment — collection `comments`. Field-for-field port
 * of `src/types.ts`'s `Comment` interface (note: replies are embedded
 * inline as an array on the same document, not a subcollection — matches
 * `addReplyToCommentInFirestore`'s `arrayUnion`).
 */
data class Comment(
    var id: String = "",
    var articleId: String = "",
    var userId: String = "",
    var userName: String = "",
    var userAvatar: String = "",
    /** One of [UserRole]'s constants. */
    var userRole: String = UserRole.READER,
    /** True if [userId] is the article's own writer (pinned author reply styling). */
    var isWriter: Boolean? = null,
    var content: String = "",
    var likesCount: Long = 0,
    /** Client-computed convenience flag from [likedBy], not stored authoritatively. */
    var isLiked: Boolean? = null,
    var likedBy: List<String>? = null,
    var isPinned: Boolean? = null,
    var createdAt: String = "",
    var replies: List<CommentReply> = emptyList()
)

data class CommentReply(
    var id: String = "",
    var userId: String = "",
    var userName: String = "",
    var userAvatar: String = "",
    var userRole: String = UserRole.READER,
    var content: String = "",
    var likesCount: Long = 0,
    var isLiked: Boolean? = null,
    var likedBy: List<String>? = null,
    var createdAt: String = ""
)
