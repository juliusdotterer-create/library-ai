<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Load complete library trees through the browser-safe `loadAllPages` helper with bounded ranges and stable ID tie-break ordering, because backend row caps can omit root folders and their documents from pickers.

- Keep the mobile primary navigation in `AppShell` as a route-derived four-column control with one shared Motion lens, so visual state cannot diverge from navigation state.
- Keep `PdfCanvasViewer` zoom controlled by its parent so document-specific views can persist their own zoom preference.
- Use the opt-in left-aligned PDF mode for timetables to lock horizontal positioning without changing other document viewers; touch pinch updates the parent-controlled zoom.
- Calendar views (Tag/Woche/Monat/Jahr) live in `src/components/calendar/` and are selected via the `view`/`date` search params on `/kalender`, so navigation and back button stay in sync.
- Entry form fields use the solid `--field`/`--field-border` tokens (`bg-field border-field-border`) instead of transparent glass, so they stay readable over any backdrop.
- Keep timetable date detection opt-in to PdfCanvasViewer, with positioned PDF text parsed by a browser-safe pure helper; refresh the device-local date on a timer and resume so other PDF viewers remain unchanged.
- Position the timetable viewport once per document URL and local date after date detection, so zoom redraws and manual scrolling retain the user's position.
- PdfCanvasViewer uses a bundled PDF worker that imports the Map/WeakMap compatibility patch inside the worker realm; release its loading task and worker on cleanup because main-thread patches do not reach PDF workers.
- Load the embedded timetable through a storage download and a cleanup-managed Blob URL so later zoom redraws keep a stable source.
- PdfAnnotator only allocates page, highlight and ink canvases for pages near the viewport, and all PDF canvases go through `canvasRatio`/`maxCanvasPixels` in `src/lib/canvas-budget.ts`, because iPad Safari kills the tab when canvas memory gets too large.
- Standalone build: there is no backend, login, AI, Google Drive or MCP. `src/integrations/supabase/client.ts` exports the browser-only `localDb` from `src/integrations/local/db.ts` (IndexedDB tables and file blobs, fixed local user) typed as the supabase-js client, so existing queries keep working offline.
- Smart search lives in `LibrarySearch`: word-filters are parsed by the pure `src/lib/smart-search.ts`, and `src/lib/library-search.ts` searches names, folders and stored full text locally with the `search-relevance` helper; numeric tokens remain mandatory exact matches so hits cannot fall back to unrelated paragraphs.
- Settings screens use the collapsible `SettingsSection`/`SettingsField` pair in `src/components/SettingsSection.tsx` (closed by default, open state kept in localStorage per id) so panels stay content-only and never render their own card or heading.
- Keep the `AppShell` top bar's floating/docked state derived from window scroll with a constant header height, so docking never shifts page content; the docked surface keeps the frosted `--glass-docked` look (translucent fill plus heavy blur), never a solid fill.
- Document rotation is display-only, stored per document on the device (`src/lib/doc-rotation.ts`); PdfAnnotator rotates pages via CSS and maps pointer input back with `unrotatePoint`, so saved annotations stay in unrotated page coordinates.
- PDF page navigation uses existing page wrappers and instant scroll jumps independently of canvas rendering; keep the floating glass control outside the scrolling area so high-page jumps retain lazy canvas allocation.
