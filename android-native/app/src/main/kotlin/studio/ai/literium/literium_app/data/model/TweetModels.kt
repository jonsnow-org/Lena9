package studio.ai.literium.literium_app.data.model

/**
 * Short post ("tweet") — collection `tweets`, max 280 characters (enforced
 * by firestore.rules on create). Available to any registered member, not
 * writers only (spec §8).
 */
data class Tweet(
    var id: String = "",
    var authorId: String = "",
    var authorName: String = "",
    var authorUsername: String = "",
    var authorAvatar: String = "",
    var authorRole: String = UserRole.READER,
    var content: String = "",
    var likesCount: Long = 0,
    var commentsCount: Long = 0,
    var sharesCount: Long = 0,
    var createdAt: String = ""
)

/** Flatter than article [Comment]/[CommentReply] nesting — same shape, no isPinned/isWriter. */
data class TweetComment(
    var id: String = "",
    var tweetId: String = "",
    var userId: String = "",
    var userName: String = "",
    var userAvatar: String = "",
    var userRole: String = UserRole.READER,
    var content: String = "",
    var likesCount: Long = 0,
    var likedBy: List<String>? = null,
    var createdAt: String = "",
    var replies: List<CommentReply> = emptyList()
)

/** Independent per-(tweet, user) like marker — collection `tweetLikes`, id `"{tweetId}_{userId}"`. */
data class TweetLike(
    var id: String = "",
    var tweetId: String = "",
    var userId: String = "",
    var createdAt: String = ""
)

/** Star/favorite marker (distinct from a like) — collection `tweetFavorites`, id `"{tweetId}_{userId}"`. */
data class TweetFavorite(
    var id: String = "",
    var tweetId: String = "",
    var userId: String = "",
    var createdAt: String = ""
)
