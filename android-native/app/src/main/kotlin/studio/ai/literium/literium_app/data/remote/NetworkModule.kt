package studio.ai.literium.literium_app.data.remote

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import studio.ai.literium.literium_app.AppErrorLog
import studio.ai.literium.literium_app.LiteriumApplication
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Singleton Retrofit/OkHttp wiring for [LiteriumApiService], talking to the
 * live `server.ts` deployment at `https://literium-wjct.onrender.com`
 * (Render — replaces the AI Studio "Publish" host, which never ran the
 * Node/Express backend at all, so every `/api/*` call there silently
 * failed; static-asset-only client writes like Firestore deletes still
 * worked, which is why only server-authoritative actions looked broken).
 *
 * This does NOT attach an `Authorization` header globally via an
 * interceptor — unlike a typical "always attach the bearer token" setup,
 * roughly half of `server.ts`'s endpoints (see [ApiErrorBody]'s file KDoc)
 * take no auth header at all and trust a client-supplied `userId` instead,
 * so a blanket interceptor would be misleading about what the server
 * actually checks. Instead, [authorizationHeader] is a small suspend
 * helper repositories call explicitly before hitting an endpoint that
 * genuinely requires it (per [LiteriumApiService]'s per-method KDoc).
 */
object NetworkModule {

    const val BASE_URL = "https://literium-wjct.onrender.com"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    /**
     * يسجّل كل فشل شبكة (انقطاع اتصال، مهلة، استجابة خطأ من الخادم) تلقائياً في
     * [AppErrorLog] — بلا حاجة لإضافة try/catch يدوي في كل مستودع يستدعي [api]. يمرّر
     * الاستثناء/الاستجابة كما وصلت دون أي تعديل على سلوك الاستدعاء الأصلي (تسجيل فقط).
     */
    private val errorLoggingInterceptor = okhttp3.Interceptor { chain ->
        val request = chain.request()
        try {
            val response = chain.proceed(request)
            if (!response.isSuccessful) {
                AppErrorLog.record(
                    LiteriumApplication.instance,
                    "شبكة (${request.method} ${request.url.encodedPath})",
                    "HTTP ${response.code}: ${response.message}"
                )
            }
            response
        } catch (e: IOException) {
            AppErrorLog.record(LiteriumApplication.instance, "شبكة (${request.method} ${request.url.encodedPath})", e)
            throw e
        }
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor(errorLoggingInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        val contentType = "application/json".toMediaType()
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    val api: LiteriumApiService by lazy { retrofit.create(LiteriumApiService::class.java) }

    /**
     * Builds an `"Bearer <idToken>"` value for the currently-signed-in Firebase user, for repositories
     * to pass into any [LiteriumApiService] method whose KDoc says it requires one.
     *
     * @param forceRefresh pass true to force a fresh token from Firebase (e.g. after a 401), matching
     *   `getIdToken(true)` on the web side — otherwise a cached-but-still-valid token is reused.
     * @throws IllegalStateException if there is no signed-in Firebase user at all (including an
     *   anonymous/guest session, which does have a valid token — only a fully signed-out app state
     *   throws here).
     */
    suspend fun authorizationHeader(forceRefresh: Boolean = false): String {
        val user = FirebaseAuth.getInstance().currentUser
            ?: throw IllegalStateException("No signed-in Firebase user — cannot build an Authorization header.")
        val result = user.getIdToken(forceRefresh).await()
        val token = result.token
            ?: throw IllegalStateException("Firebase returned a null ID token for the current user.")
        return "Bearer $token"
    }
}
