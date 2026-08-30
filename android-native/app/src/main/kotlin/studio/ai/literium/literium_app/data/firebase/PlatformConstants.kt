package studio.ai.literium.literium_app.data.firebase

/**
 * Small set of hardcoded platform constants that live directly in source
 * (`src/firebase.ts`, `firestore.rules`) rather than in a dedicated
 * constants file, ported here so they are not re-typed at each call site.
 */
object PlatformConstants {
    /**
     * The single hardcoded owner account email. Both `firestore.rules`'
     * `isAdmin()` and `src/firebase.ts` treat a Firebase Auth user with this
     * exact email (case-insensitively) as an admin unconditionally, even
     * before their `users/{uid}` document exists or has `role == 'admin'`
     * written on it yet — this is the bootstrap path that lets the very
     * first owner sign-in succeed.
     */
    const val OWNER_ADMIN_EMAIL = "brnardtsho@gmail.com"

    /** Default avatar shown for a user with no `avatarUrl` set — matches `firebase.ts`'s fallback. */
    const val DEFAULT_AVATAR_URL = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300"

    /** Default cover image shown for a user with no `coverUrl` set — matches `firebase.ts`'s fallback. */
    const val DEFAULT_COVER_URL = "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200"
}
