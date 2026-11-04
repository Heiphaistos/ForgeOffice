// Editeur de page reutilisable (Presentation, Publication) : une page = une taille + des formes du modele @forgeoffice/pptx.
// Voir packages/powerpoint/STATUS.md (section « API canvas »).
export { CanvasEditor, editorItems, type CanvasEditorProps, type EditorItem } from './CanvasEditor.tsx';
export { isTextCapable } from './keys.ts';
export { PageView, type PageViewProps, type PageLayer } from './PageView.tsx';
export { ShapeView, type ShapeViewProps, type TextEditing } from './render/ShapeView.tsx';
export { TextBlock, autoNumberLabel, paragraphNumbers, runStyle, DEFAULT_INSETS } from './render/TextBlock.tsx';
export { backgroundCss, fillPaint, strokeOf, effectsCss } from './render/paint.tsx';
export { deckPageContext, deckPageBackground, mediaUrl, isRenderableImage, fontFamily, css, type PageContext } from './context.ts';
export * from './types.ts';
export * from './math.ts';
export * from './ops.ts';
export * from './text.ts';
export { connectionPoints, lineBox, lineEnds, nearestSite, rerouteConnectors } from './connectors.ts';
export { TABLE_STYLES, tableStyleInfo, cellLook, type TableStyleInfo, type CellLook } from './table-style.ts';
export { buildGeometry, adjustFromPoint, isPresetKnown, LINE_PRESETS, type GeometryResult } from './geometry/index.ts';
export { renderChart, svgToString, niceScale, type SvgNode, type ChartRenderContext } from './chart/index.ts';
export { svgNodeToReact } from './render/svg-node.tsx';
