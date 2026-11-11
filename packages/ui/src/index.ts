// Systeme de design ForgeOffice (Office 2024 / Fluent 2). Point d'entree unique des modules.
import './tokens.css';
import './fonts.css';
import { FONT_SIZES as SIZES, parseFontSize as parseSize } from './logic/fonts.ts';
import type { ComboOption } from './ribbon-types.ts';

// Icones
export { Icon, isIconName } from './icons/Icon.tsx';
export type { IconProps } from './icons/Icon.tsx';
export type { IconName } from './icons/generated.ts';

// Schema du ruban
export type {
  TooltipContent, MenuItem, ControlSize, ButtonControl, SplitButtonControl, ToggleControl, MenuControl, ComboOption, ComboControl,
  FontControl, GalleryItem, GalleryControl, ColorControl, CheckboxControl, NumberControl, SeparatorControl, RowControl, CustomControl,
  RibbonControl, RibbonGroup, RibbonTab, GroupLevel, RibbonLayout,
} from './ribbon-types.ts';

// Composants
export { Ribbon } from './components/ribbon/Ribbon.tsx';
export type { RibbonProps } from './components/ribbon/Ribbon.tsx';
export { TitleBar, WindowButtons } from './components/TitleBar.tsx';
export type { TitleBarProps, QuickAccessItem, SaveState } from './components/TitleBar.tsx';
export { Backstage, BackstageHeading, BackstageSection, BackstageTile, BackstageAction, BACKSTAGE_PAGES } from './components/Backstage.tsx';
export type { BackstageProps, BackstagePage } from './components/Backstage.tsx';
export { StatusBar } from './components/StatusBar.tsx';
export type { StatusBarProps, StatusItem, StatusView, ZoomPreset } from './components/StatusBar.tsx';
export { Dialog } from './components/Dialog.tsx';
export { useConfirmDiscard } from './components/ConfirmDiscard.tsx';
export { useAsk } from './components/Ask.tsx';
export type { Ask } from './components/Ask.tsx';
export type { ConfirmDiscard } from './components/ConfirmDiscard.tsx';
export type { DialogProps, DialogAction } from './components/Dialog.tsx';
export { Menu, useContextMenu } from './components/Menu.tsx';
export { MiniToolbar, useSelectionMiniToolbar } from './components/MiniToolbar.tsx';
export type { MiniToolbarProps, SelectionMiniToolbar, SelectionMiniToolbarOptions } from './components/MiniToolbar.tsx';
export { caretColor, DEFAULT_CARET, luminance, parseCaret } from './logic/caret.ts';
export type { CaretColor, CaretPrefs } from './logic/caret.ts';
export { miniToolbarVisible, placeMiniToolbar } from './logic/miniToolbar.ts';
export type { Box as MiniToolbarBox, Placement as MiniToolbarPlacement, MiniToolbarInput } from './logic/miniToolbar.ts';
export type { MenuProps } from './components/Menu.tsx';
export { Popover } from './components/Popover.tsx';
export type { PopoverProps } from './components/Popover.tsx';
export { KeyboardBar, colorMenuItems, itemsFromTab } from './components/KeyboardBar.tsx';
export { CommandSheet } from './components/CommandSheet.tsx';
export type { KeyboardBarItem, KeyboardBarProps } from './components/KeyboardBar.tsx';
export { Tooltip } from './components/Tooltip.tsx';
export type { TooltipProps } from './components/Tooltip.tsx';
export { Toaster, TaskPane, DocumentTabs } from './components/Panels.tsx';
export type { TaskPaneProps, DocumentTab, DocumentTabsProps } from './components/Panels.tsx';
export { ColorPicker, ColorPalette } from './components/ColorPicker.tsx';
export type { ColorPickerProps, ColorPaletteProps } from './components/ColorPicker.tsx';
export { ComboBox } from './components/ComboBox.tsx';
export type { ComboBoxProps } from './components/ComboBox.tsx';
export { FontPicker, listSystemFonts } from './components/FontPicker.tsx';
export type { FontPickerProps } from './components/FontPicker.tsx';
export { FileList } from './components/FileList.tsx';
export type { FileListProps, FileRow } from './components/FileList.tsx';
export { Button, Switch, TextField, Checkbox, NumberField, Spinner, ProgressBar, AppBadge } from './components/Controls.tsx';
export type { ButtonProps, SwitchProps, TextFieldProps, CheckboxProps, NumberFieldProps } from './components/Controls.tsx';

// Logique sans DOM
export { collectCommands, searchCommands, groupsToMenu } from './logic/commands.ts';
export type { CommandEntry } from './logic/commands.ts';
export { bandGroups, flattenControls, ribbonSchema, commandSections, scrollEdges, activeGroup, launcherId } from './logic/mobileRibbon.ts';
export type { SchemaTab, SchemaGroup, SchemaControl, BandGroup } from './logic/mobileRibbon.ts';
export { assignKeytips } from './logic/keytips.ts';
export { fitGroups } from './logic/fit.ts';
export { OFFICE_THEME_COLORS, STANDARD_COLORS, normalizeHex, shade, themeShades, readableOn, hexToRgb, rgbToHex } from './logic/color.ts';
export type { Swatch } from './logic/color.ts';
export { ZOOM_MIN, ZOOM_MAX, clampZoom, stepZoom, sliderToZoom, zoomToSlider, pinchZoom } from './logic/zoom.ts';
export { FONT_SIZES, THEME_FONTS, EMBEDDED_FONTS, ALIASED_FONTS, parseFontSize, nextFontSize, filterFonts } from './logic/fonts.ts';
export { whenFontsReady, remeasureWhenFontsReady, createFontsEpoch } from './logic/fontsReady.ts';
export type { FontSetLike, RemeasureOptions, FontsEpoch } from './logic/fontsReady.ts';
export { guardUnsaved } from './logic/discard.ts';
export type { DiscardAnswer } from './logic/discard.ts';
export { relativeDate, dateGroup } from './logic/dates.ts';
export { fold, matchScore } from './logic/text.ts';
export { placePopup } from './logic/position.ts';
export {
  TOUCH_TARGET, LONG_PRESS_MS, deviceMode, ribbonLayoutFor, isLongPress, swipeDirection, handleHitBox, pickHandle, rotationAngle, gridIntent,
  keyboardInset, scrollDeltaToReveal, foldToolbar, pinchGeometry, miniToolbarPosition,
} from './logic/touch.ts';
export type { DeviceMode, FormFactor, GridMode, GridIntent, SwipeDirection, ToolbarFold, Rect } from './logic/touch.ts';
export { installTouchSupport, useDeviceMode, useTouchEditing, isTextEditable, insertTextAtCaret } from './touch.ts';

// Dispositions
export * from './logic/layouts.ts';
export { useLayout, chooseLayout, layoutMenuItem } from './layoutHooks.ts';
export { DisplayOptions } from './components/DisplayOptions.tsx';

// Theme, crochets, textes
export { applyTheme, applyAppAccent, resolveTheme, savedTheme, isThemeChoice, THEME_SETTING } from './theme.ts';
export type { ThemeChoice, ResolvedTheme } from './theme.ts';
export { usePersistentState, useMediaQuery, useElementWidth, usePopupPosition, useDismiss, usePinchZoom, useFontsEpoch } from './hooks.ts';
export type { Anchor } from './hooks.ts';
export { S as UI_STRINGS, percentLabel } from './strings.ts';

/** Options pretes pour un controle « Taille de police » (kind: 'combo', editable, validate: validateFontSize). */
export const FONT_SIZE_OPTIONS: readonly ComboOption[] = SIZES.map((s) => ({ value: String(s), label: String(s).replace('.', ',') }));

/** Validation d'une taille saisie (« 10,5 » -> « 10.5 »). */
export function validateFontSize(text: string): string | null {
  const n = parseSize(text);
  return n === null ? null : String(n);
}

import './mobile.css';
import './touch.css'; // en dernier : surcharge les feuilles des composants (cibles tactiles, zones sures)
export { ribbonProbe } from './probe.ts';
