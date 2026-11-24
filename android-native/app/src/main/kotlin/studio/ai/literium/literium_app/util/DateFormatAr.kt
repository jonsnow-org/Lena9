package studio.ai.literium.literium_app.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Arabic date/time formatting — exact behavioral port of `src/utils/dateFormat.ts`'s
 * `timeAgoAr`/`formatDateAr`/`formatDateTimeAr`. All Article/Tweet/Comment timestamps in this
 * codebase are ISO-8601 strings (`java.time.Instant.now().toString()`, see every repository's
 * `Instant.now().toString()` writes), so unlike the web source (which has to defensively handle
 * Firestore Timestamp objects/numeric epochs/legacy human strings too) this only needs the ISO
 * string path — but degrades the same way source does: an unparsable value is returned as-is
 * rather than crashing or showing a raw exception string.
 */
object DateFormatAr {

    private val arabicLocale = Locale("ar", "EG")

    private fun parse(value: String): Instant? {
        if (value.isBlank()) return null
        return try {
            Instant.parse(value)
        } catch (e: Exception) {
            // بعض القيم القديمة قد تكون بصيغة "yyyy-MM-dd'T'HH:mm:ss" بلا منطقة زمنية صريحة.
            try {
                java.time.LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant()
            } catch (e2: Exception) {
                null
            }
        }
    }

    /** "قبل 3 ساعات"، "أمس"، "قبل يومين"... — exact port of `timeAgoAr`. */
    fun timeAgoAr(value: String): String {
        val instant = parse(value) ?: return value
        val seconds = (System.currentTimeMillis() / 1000) - instant.epochSecond
        if (seconds < 60) return "الآن"

        val minutes = seconds / 60
        if (minutes < 60) {
            return when {
                minutes == 1L -> "قبل دقيقة"
                minutes == 2L -> "قبل دقيقتين"
                minutes <= 10L -> "قبل $minutes دقائق"
                else -> "قبل $minutes دقيقة"
            }
        }

        val hours = minutes / 60
        if (hours < 24) {
            return when {
                hours == 1L -> "قبل ساعة"
                hours == 2L -> "قبل ساعتين"
                hours <= 10L -> "قبل $hours ساعات"
                else -> "قبل $hours ساعة"
            }
        }

        val days = hours / 24
        if (days < 30) {
            return when {
                days == 1L -> "أمس"
                days == 2L -> "قبل يومين"
                days <= 10L -> "قبل $days أيام"
                else -> "قبل $days يوماً"
            }
        }

        val months = days / 30
        if (months < 12) {
            return when {
                months == 1L -> "قبل شهر"
                months == 2L -> "قبل شهرين"
                months <= 10L -> "قبل $months أشهر"
                else -> "قبل $months شهراً"
            }
        }

        val years = months / 12
        return when {
            years == 1L -> "قبل سنة"
            years == 2L -> "قبل سنتين"
            years <= 10L -> "قبل $years سنوات"
            else -> "قبل $years سنة"
        }
    }

    private val arabicMonths = listOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    )

    /** "19 أغسطس 2026" — exact port of `formatDateAr`. */
    fun formatDateAr(value: String): String {
        val instant = parse(value) ?: return value
        val zoned = instant.atZone(ZoneId.systemDefault())
        return "${zoned.dayOfMonth} ${arabicMonths[zoned.monthValue - 1]} ${zoned.year}"
    }

    /** "19 أغسطس 2026، 10:45 م" — exact port of `formatDateTimeAr`. */
    fun formatDateTimeAr(value: String): String {
        val instant = parse(value) ?: return value
        val zoned = instant.atZone(ZoneId.systemDefault())
        val hour24 = zoned.hour
        val period = if (hour24 < 12) "ص" else "م"
        var hour12 = hour24 % 12
        if (hour12 == 0) hour12 = 12
        val minute = zoned.minute.toString().padStart(2, '0')
        return "${zoned.dayOfMonth} ${arabicMonths[zoned.monthValue - 1].take(3)} ${zoned.year}، $hour12:$minute $period"
    }
}
