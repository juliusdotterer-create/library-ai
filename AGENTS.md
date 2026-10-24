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

- Keep the mobile primary navigation in `AppShell` as a route-derived four-column control with one shared Motion lens, so visual state cannot diverge from navigation state.
- Keep `PdfCanvasViewer` zoom controlled by its parent so document-specific views can persist their own zoom preference.
- Use the opt-in left-aligned PDF mode for timetables to lock horizontal positioning without changing other document viewers; touch pinch updates the parent-controlled zoom.
- Calendar views (Tag/Woche/Monat/Jahr) live in `src/components/calendar/` and are selected via the `view`/`date` search params on `/kalender`, so navigation and back button stay in sync.
- Entry form fields use the solid `--field`/`--field-border` tokens (`bg-field border-field-border`) instead of transparent glass, so they stay readable over any backdrop.
- Keep timetable date detection opt-in to PdfCanvasViewer, with positioned PDF text parsed by a browser-safe pure helper; refresh the device-local date on a timer and resume so other PDF viewers remain unchanged.
- Position the timetable viewport once per document URL and local date after date detection, so zoom redraws and manual scrolling retain the user's position.
- PdfCanvasViewer uses a bundled PDF worker that imports the Map/WeakMap compatibility patch inside the worker realm; release its loading task and worker on cleanup because main-thread patches do not reach PDF workers.
- Load the embedded timetable through an authenticated storage download and a cleanup-managed Blob URL so later zoom redraws cannot fail on an expired signed URL.
