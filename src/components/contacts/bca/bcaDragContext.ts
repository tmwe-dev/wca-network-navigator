/**
 * BCA Drag&Drop — shared dataTransfer key + light context for the unified hub.
 * Drop targets check `e.dataTransfer.types.includes(BCA_DRAG_MIME)` to decide
 * whether to highlight themselves; the unified hub looks up the dragged id in
 * the cards list to resolve the actual record.
 */
export const BCA_DRAG_MIME = "application/x-bca-card-id";
