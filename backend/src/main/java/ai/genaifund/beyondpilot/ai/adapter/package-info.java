/**
 * The APIs a chat provider can speak, one adapter each, behind {@link ai.genaifund.beyondpilot.ai.adapter.ChatAdapterRegistry},
 * and the APIs an OCR service can speak, behind {@link ai.genaifund.beyondpilot.ai.adapter.OcrAdapterRegistry}. Both
 * families are open: a new API is a new bean.
 */
@NullMarked
package ai.genaifund.beyondpilot.ai.adapter;

import org.jspecify.annotations.NullMarked;
