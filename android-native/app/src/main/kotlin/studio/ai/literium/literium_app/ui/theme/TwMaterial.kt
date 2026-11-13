package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonElevation
import androidx.compose.material3.CardColors
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CardElevation
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.TopAppBarColors
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties

/**
 * طبقة توافق بصرية: نفس أسماء ومعاملات مكوّنات Material3 لكن بقيم الويب الافتراضية
 * (rounded-xl للأزرار والحقول، rounded-2xl للبطاقات مع حدّ slate، rounded-3xl للحوارات، رأس صفحة مثل رأس النوافذ).
 * تُستورد من هذه الحزمة بدل androidx.compose.material3 في الشاشات القديمة فتتبدّل هيئتها دون تغيير منطقها.
 */
private val XL = RoundedCornerShape(12.dp)
private val X2L = RoundedCornerShape(16.dp)
private val X3L = RoundedCornerShape(24.dp)

@Composable private fun lineColor(): Color = if (isDark) Tw.slate700 else Tw.slate200

@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = XL,
    colors: ButtonColors = ButtonDefaults.buttonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit
) = androidx.compose.material3.Button(onClick, modifier, enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)

@Composable
fun OutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = XL,
    colors: ButtonColors = ButtonDefaults.outlinedButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = BorderStroke(1.dp, lineColor()),
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit
) = androidx.compose.material3.OutlinedButton(onClick, modifier, enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)

@Composable
fun TextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = XL,
    colors: ButtonColors = ButtonDefaults.textButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = ButtonDefaults.TextButtonContentPadding,
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit
) = androidx.compose.material3.TextButton(onClick, modifier, enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)

@Composable
fun Card(
    modifier: Modifier = Modifier,
    shape: Shape = X2L,
    colors: CardColors = CardDefaults.cardColors(),
    elevation: CardElevation = CardDefaults.cardElevation(),
    border: BorderStroke? = BorderStroke(1.dp, if (isDark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f)),
    content: @Composable ColumnScope.() -> Unit
) = androidx.compose.material3.Card(modifier, shape, colors, elevation, border, content)

@Composable
fun Card(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = X2L,
    colors: CardColors = CardDefaults.cardColors(),
    elevation: CardElevation = CardDefaults.cardElevation(),
    border: BorderStroke? = BorderStroke(1.dp, if (isDark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f)),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable ColumnScope.() -> Unit
) = androidx.compose.material3.Card(onClick, modifier, enabled, shape, colors, elevation, border, interactionSource, content)

@Composable
fun twFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = brand.s500,
    unfocusedBorderColor = lineColor(),
    focusedContainerColor = if (isDark) Tw.slate800 else Tw.slate50,
    unfocusedContainerColor = if (isDark) Tw.slate800 else Tw.slate50,
    cursorColor = brand.s500
)

@Composable
fun OutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    textStyle: TextStyle = androidx.compose.material3.LocalTextStyle.current,
    label: @Composable (() -> Unit)? = null,
    placeholder: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    prefix: @Composable (() -> Unit)? = null,
    suffix: @Composable (() -> Unit)? = null,
    supportingText: @Composable (() -> Unit)? = null,
    isError: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = false,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    minLines: Int = 1,
    shape: Shape = XL,
    colors: TextFieldColors = twFieldColors()
) = androidx.compose.material3.OutlinedTextField(
    value, onValueChange, modifier, enabled, readOnly, textStyle, label, placeholder, leadingIcon, trailingIcon, prefix, suffix,
    supportingText, isError, visualTransformation, keyboardOptions, keyboardActions, singleLine, maxLines, minLines, null, shape, colors
)

@Composable
fun AlertDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    dismissButton: @Composable (() -> Unit)? = null,
    icon: @Composable (() -> Unit)? = null,
    title: @Composable (() -> Unit)? = null,
    text: @Composable (() -> Unit)? = null,
    shape: Shape = X3L,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    properties: DialogProperties = DialogProperties()
) = androidx.compose.material3.AlertDialog(
    onDismissRequest, confirmButton, modifier, dismissButton, icon, title, text, shape, containerColor,
    androidx.compose.material3.AlertDialogDefaults.iconContentColor, androidx.compose.material3.AlertDialogDefaults.titleContentColor,
    androidx.compose.material3.AlertDialogDefaults.textContentColor, androidx.compose.material3.AlertDialogDefaults.TonalElevation, properties
)

/** رأس صفحة بنمط رؤوس نوافذ الويب: خلفية slate-50/80، حدّ سفلي، عنوان 16sp/ExtraBold، أيقونة رجوع وإجراءات. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopAppBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    expandedHeight: androidx.compose.ui.unit.Dp = androidx.compose.ui.unit.Dp.Unspecified,
    windowInsets: androidx.compose.foundation.layout.WindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
    colors: TopAppBarColors? = null,
    scrollBehavior: TopAppBarScrollBehavior? = null
) {
    val dark = isDark
    androidx.compose.foundation.layout.Column(modifier.fillMaxWidth().background(if (dark) Tw.slate900 else Tw.white)) {
        Row(
            Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            navigationIcon()
            Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                androidx.compose.runtime.CompositionLocalProvider(
                    androidx.compose.material3.LocalTextStyle provides twText(16, FontWeight.ExtraBold, 24).copy(color = if (dark) Tw.white else Tw.slate900)
                ) { title() }
            }
            actions()
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
    }
}
